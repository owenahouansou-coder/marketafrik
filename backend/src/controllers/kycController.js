const { getDb, saveDb } = require('../config/database');

const submitKyc = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Aucun document fourni' });
  }

  const { document_type } = req.body;
  const validTypes = ['cni', 'passeport', 'permis', 'registre_commerce'];

  if (!document_type || !validTypes.includes(document_type)) {
    return res.status(400).json({
      success: false,
      message: `Type de document invalide. Valeurs acceptées : ${validTypes.join(', ')}`,
    });
  }

  try {
    const db = await getDb();

    const vendorCheck = db.exec(`SELECT id, kyc_status FROM vendor_profiles WHERE user_id = ${req.user.id}`);
    if (!vendorCheck.length || !vendorCheck[0].values.length) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const [, kyc_status] = vendorCheck[0].values[0];

    if (kyc_status === 'approved') {
      return res.status(400).json({ success: false, message: 'KYC déjà approuvé' });
    }

    db.run(`DELETE FROM kyc_documents WHERE vendor_id = ${req.user.id} AND status = 'pending'`);

    for (const file of req.files) {
      const document_path = `/uploads/${file.filename}`;
      db.run(
        `INSERT INTO kyc_documents (vendor_id, document_type, document_path) VALUES (?, ?, ?)`,
        [req.user.id, document_type, document_path]
      );
    }

    db.run(
      `UPDATE vendor_profiles SET kyc_status = 'submitted', kyc_submitted_at = datetime('now') WHERE user_id = ${req.user.id}`
    );
    saveDb();

    res.json({
      success: true,
      message: 'Documents soumis avec succès. Vérification en cours (24-48h).',
      data: {
        kyc_status: 'submitted',
        documents_count: req.files.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const getKycStatus = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  try {
    const db = await getDb();

    const result = db.exec(
      `SELECT vp.kyc_status, vp.kyc_submitted_at, vp.badge_verified,
              kd.document_type, kd.status as doc_status, kd.rejection_reason, kd.created_at as doc_submitted_at
       FROM vendor_profiles vp
       LEFT JOIN kyc_documents kd ON kd.vendor_id = vp.user_id
       WHERE vp.user_id = ${req.user.id}
       ORDER BY kd.created_at DESC`
    );

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const cols = result[0].columns;
    const rows = result[0].values.map(vals => {
      const r = {};
      cols.forEach((c, i) => (r[c] = vals[i]));
      return r;
    });

    res.json({
      success: true,
      data: {
        kyc_status: rows[0].kyc_status,
        kyc_submitted_at: rows[0].kyc_submitted_at,
        badge_verified: rows[0].badge_verified,
        documents: rows.filter(r => r.document_type).map(r => ({
          type: r.document_type,
          status: r.doc_status,
          rejection_reason: r.rejection_reason,
          submitted_at: r.doc_submitted_at,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const reviewKyc = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès admin requis' });
  }

  const { vendorId } = req.params;
  const { decision, rejection_reason } = req.body;

  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Décision invalide (approved ou rejected)' });
  }

  if (decision === 'rejected' && !rejection_reason) {
    return res.status(400).json({ success: false, message: 'Raison du rejet requise' });
  }

  try {
    const db = await getDb();

    if (decision === 'approved') {
      db.run(`UPDATE vendor_profiles SET kyc_status = 'approved', badge_verified = 1 WHERE user_id = ${parseInt(vendorId)}`);
      db.run(`UPDATE kyc_documents SET status = 'approved', reviewed_by = ${req.user.id}, reviewed_at = datetime('now') WHERE vendor_id = ${parseInt(vendorId)}`);
    } else {
      db.run(`UPDATE vendor_profiles SET kyc_status = 'rejected' WHERE user_id = ${parseInt(vendorId)}`);
      db.run(
        `UPDATE kyc_documents SET status = 'rejected', reviewed_by = ${req.user.id}, reviewed_at = datetime('now'), rejection_reason = ? WHERE vendor_id = ?`,
        [rejection_reason, parseInt(vendorId)]
      );
    }
    saveDb();

    res.json({
      success: true,
      message: `KYC ${decision === 'approved' ? 'approuvé' : 'rejeté'} avec succès`,
      data: { vendor_id: vendorId, decision },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const getPendingKyc = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès admin requis' });
  }

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT u.id, u.name, u.email, u.phone,
             vp.shop_name, vp.kyc_status, vp.kyc_submitted_at,
             COUNT(kd.id) as doc_count
      FROM users u
      JOIN vendor_profiles vp ON vp.user_id = u.id
      LEFT JOIN kyc_documents kd ON kd.vendor_id = u.id
      WHERE vp.kyc_status = 'submitted'
      GROUP BY u.id
      ORDER BY vp.kyc_submitted_at ASC
    `);

    const vendors = result.length && result[0].values.length
      ? result[0].values.map(vals => {
          const v = {};
          result[0].columns.forEach((c, i) => (v[c] = vals[i]));
          return v;
        })
      : [];

    res.json({ success: true, data: { vendors, total: vendors.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { submitKyc, getKycStatus, reviewKyc, getPendingKyc };