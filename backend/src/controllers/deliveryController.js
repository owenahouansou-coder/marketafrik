const { getDb, saveDb } = require('../config/database');

// Initialiser les tables livraison
const initDeliverySchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS vendor_delivery_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      city TEXT NOT NULL,
      district TEXT,
      delivery_type TEXT NOT NULL,
      fee REAL NOT NULL,
      estimated_days INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      delivery_type TEXT NOT NULL,
      status TEXT DEFAULT 'preparation',
      fee REAL DEFAULT 0,
      partner TEXT,
      tracking_notes TEXT,
      proof_photo TEXT,
      confirmed_by_buyer INTEGER DEFAULT 0,
      confirmed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);
  saveDb();
};

initDeliverySchema();

// POST /api/delivery/zones — Vendeur configure ses zones de livraison
const setDeliveryZone = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { city, district, delivery_type, fee, estimated_days } = req.body;

  if (!city || !delivery_type || fee === undefined) {
    return res.status(400).json({ success: false, message: 'city, delivery_type et fee requis' });
  }

  const validTypes = ['express', 'standard', 'pickup'];
  if (!validTypes.includes(delivery_type)) {
    return res.status(400).json({ success: false, message: `Type invalide. Valeurs: ${validTypes.join(', ')}` });
  }

  try {
    const db = await getDb();

    // Vérifier si la zone existe déjà
    const existing = db.exec(
      `SELECT id FROM vendor_delivery_zones 
       WHERE vendor_id = ${req.user.id} AND city = '${city}' AND delivery_type = '${delivery_type}'
       ${district ? `AND district = '${district}'` : 'AND district IS NULL'}`
    );

    if (existing.length && existing[0].values.length) {
      // Mettre à jour
      db.run(
        `UPDATE vendor_delivery_zones SET fee = ${parseFloat(fee)}, estimated_days = ${parseInt(estimated_days) || 1}, is_active = 1
         WHERE id = ${existing[0].values[0][0]}`
      );
    } else {
      // Créer
      db.run(
        `INSERT INTO vendor_delivery_zones (vendor_id, city, district, delivery_type, fee, estimated_days)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, city, district || null, delivery_type, parseFloat(fee), parseInt(estimated_days) || 1]
      );
    }
    saveDb();

    res.json({ success: true, message: 'Zone de livraison configurée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/delivery/zones/:vendorId — Zones de livraison d'un vendeur
const getDeliveryZones = async (req, res) => {
  const { vendorId } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT * FROM vendor_delivery_zones 
      WHERE vendor_id = ${parseInt(vendorId)} AND is_active = 1
      ORDER BY city, delivery_type
    `);

    let zones = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      zones = result[0].values.map(vals => {
        const z = {};
        cols.forEach((c, i) => (z[c] = vals[i]));
        return z;
      });
    }

    res.json({ success: true, data: { zones } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/delivery/fee — Calculer les frais de livraison
const getDeliveryFee = async (req, res) => {
  const { vendor_id, city, district, delivery_type } = req.query;

  if (!vendor_id || !city || !delivery_type) {
    return res.status(400).json({ success: false, message: 'vendor_id, city et delivery_type requis' });
  }

  try {
    const db = await getDb();

    // Chercher d'abord par ville + arrondissement, sinon juste par ville
    let result = db.exec(
      `SELECT fee, estimated_days FROM vendor_delivery_zones 
       WHERE vendor_id = ${parseInt(vendor_id)} AND city = '${city}' 
       AND delivery_type = '${delivery_type}' AND is_active = 1
       ${district ? `AND district = '${district}'` : ''}
       LIMIT 1`
    );

    if (!result.length || !result[0].values.length) {
      // Fallback sans district
      result = db.exec(
        `SELECT fee, estimated_days FROM vendor_delivery_zones 
         WHERE vendor_id = ${parseInt(vendor_id)} AND city = '${city}' 
         AND delivery_type = '${delivery_type}' AND is_active = 1
         LIMIT 1`
      );
    }

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Zone de livraison non disponible pour cette adresse' });
    }

    const [fee, estimated_days] = result[0].values[0];

    res.json({
      success: true,
      data: { fee, estimated_days, currency: 'FCFA' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/delivery/start/:orderId — Démarrer la livraison
const startDelivery = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { orderId } = req.params;
  const { delivery_type, fee = 0, partner } = req.body;

  try {
    const db = await getDb();

    // Vérifier la commande
    const orderCheck = db.exec(
      `SELECT vendor_id, status FROM orders WHERE id = ${parseInt(orderId)}`
    );

    if (!orderCheck.length || !orderCheck[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [vendor_id, order_status] = orderCheck[0].values[0];

    if (vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (order_status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'La commande doit être confirmée avant la livraison' });
    }

    // Créer l'entrée livraison
    const existing = db.exec(`SELECT id FROM deliveries WHERE order_id = ${parseInt(orderId)}`);
    if (existing.length && existing[0].values.length) {
      return res.status(400).json({ success: false, message: 'Livraison déjà démarrée' });
    }

    db.run(
      `INSERT INTO deliveries (order_id, delivery_type, fee, partner) VALUES (?, ?, ?, ?)`,
      [parseInt(orderId), delivery_type || 'standard', parseFloat(fee), partner || null]
    );

    db.run(`UPDATE orders SET status = 'shipped', updated_at = datetime('now') WHERE id = ${parseInt(orderId)}`);
    saveDb();

    res.json({ success: true, message: 'Livraison démarrée', data: { order_id: orderId, status: 'shipped' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/delivery/status/:orderId — Mettre à jour le statut livraison
const updateDeliveryStatus = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { orderId } = req.params;
  const { status, tracking_notes } = req.body;

  const validStatuses = ['preparation', 'shipped', 'in_transit', 'delivered'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Statut invalide. Valeurs: ${validStatuses.join(', ')}` });
  }

  try {
    const db = await getDb();

    const deliveryCheck = db.exec(
      `SELECT d.id, d.proof_photo, o.vendor_id 
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE d.order_id = ${parseInt(orderId)}`
    );

    if (!deliveryCheck.length || !deliveryCheck[0].values.length) {
      return res.status(404).json({ success: false, message: 'Livraison introuvable' });
    }

    const [deliveryId, proof_photo, vendor_id] = deliveryCheck[0].values[0];

    if (vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    // Photo obligatoire pour marquer comme livré
    if (status === 'delivered' && !proof_photo) {
      return res.status(400).json({
        success: false,
        message: 'Photo de preuve obligatoire avant de marquer comme livré. Uploadez d\'abord la photo.',
      });
    }

    db.run(
      `UPDATE deliveries SET status = '${status}', tracking_notes = ?, updated_at = datetime('now') WHERE id = ${deliveryId}`,
      [tracking_notes || null]
    );

    if (status === 'delivered') {
      db.run(`UPDATE orders SET status = 'delivered', updated_at = datetime('now') WHERE id = ${parseInt(orderId)}`);
    }

    saveDb();

    res.json({ success: true, message: `Statut livraison mis à jour : ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/delivery/proof/:orderId — Upload preuve de livraison
const uploadProof = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { orderId } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Photo requise' });
  }

  try {
    const db = await getDb();

    const deliveryCheck = db.exec(
      `SELECT d.id, o.vendor_id FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       WHERE d.order_id = ${parseInt(orderId)}`
    );

    if (!deliveryCheck.length || !deliveryCheck[0].values.length) {
      return res.status(404).json({ success: false, message: 'Livraison introuvable' });
    }

    const [deliveryId, vendor_id] = deliveryCheck[0].values[0];

    if (vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    const proof_photo = `/uploads/${req.file.filename}`;
    db.run(
      `UPDATE deliveries SET proof_photo = '${proof_photo}', updated_at = datetime('now') WHERE id = ${deliveryId}`
    );
    saveDb();

    res.json({
      success: true,
      message: 'Photo de preuve uploadée. Vous pouvez maintenant marquer comme livré.',
      data: { proof_photo },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/delivery/confirm/:orderId — Acheteur confirme la réception (retrait)
const confirmReception = async (req, res) => {
  const { orderId } = req.params;

  try {
    const db = await getDb();

    const orderCheck = db.exec(
      `SELECT buyer_id, status FROM orders WHERE id = ${parseInt(orderId)}`
    );

    if (!orderCheck.length || !orderCheck[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [buyer_id, order_status] = orderCheck[0].values[0];

    if (buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (order_status === 'delivered') {
      return res.status(400).json({ success: false, message: 'Réception déjà confirmée' });
    }

    db.run(
      `UPDATE deliveries SET confirmed_by_buyer = 1, confirmed_at = datetime('now'), 
       status = 'delivered', updated_at = datetime('now')
       WHERE order_id = ${parseInt(orderId)}`
    );

    db.run(
      `UPDATE orders SET status = 'delivered', updated_at = datetime('now') WHERE id = ${parseInt(orderId)}`
    );
    saveDb();

    res.json({ success: true, message: 'Réception confirmée. Merci pour votre achat !' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/delivery/:orderId — Détail livraison
const getDelivery = async (req, res) => {
  const { orderId } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT d.*, o.buyer_id, o.vendor_id, o.delivery_city, o.delivery_district
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      WHERE d.order_id = ${parseInt(orderId)}
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Livraison introuvable' });
    }

    const cols = result[0].columns;
    const delivery = {};
    cols.forEach((c, i) => (delivery[c] = result[0].values[0][i]));

    if (delivery.buyer_id !== req.user.id && delivery.vendor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    res.json({ success: true, data: { delivery } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  setDeliveryZone,
  getDeliveryZones,
  getDeliveryFee,
  startDelivery,
  updateDeliveryStatus,
  uploadProof,
  confirmReception,
  getDelivery,
};