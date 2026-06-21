const { getDb, saveDb } = require('../config/database');

// Initialiser les tables réputation
const initReputationSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      buyer_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      rating_product INTEGER NOT NULL,
      rating_delivery INTEGER NOT NULL,
      rating_communication INTEGER NOT NULL,
      rating_packaging INTEGER NOT NULL,
      comment TEXT,
      is_verified INTEGER DEFAULT 1,
      flagged INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_reputation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER UNIQUE NOT NULL,
      score INTEGER DEFAULT 0,
      level TEXT DEFAULT 'nouveau',
      avg_rating REAL DEFAULT 0,
      delivery_rate REAL DEFAULT 0,
      response_time_avg INTEGER DEFAULT 0,
      dispute_rate REAL DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      opened_by INTEGER NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      vendor_response TEXT,
      vendor_responded_at TEXT,
      resolution TEXT,
      resolution_type TEXT,
      resolved_by INTEGER,
      resolved_at TEXT,
      escrow_frozen INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (opened_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );
  `);
  saveDb();
};

initReputationSchema();

// Calculer et mettre à jour le score de réputation
const calculateReputation = async (vendor_id) => {
  const db = await getDb();

  // Note moyenne
  const ratingResult = db.exec(`
    SELECT AVG((rating_product + rating_delivery + rating_communication + rating_packaging) / 4.0) as avg_rating,
           COUNT(*) as total_reviews
    FROM reviews WHERE vendor_id = ${vendor_id} AND flagged = 0
  `);
  const avg_rating = ratingResult[0]?.values[0][0] || 0;
  const total_reviews = ratingResult[0]?.values[0][1] || 0;

  // Taux de livraison
  const deliveryResult = db.exec(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
    FROM orders WHERE vendor_id = ${vendor_id}
  `);
  const total_orders = deliveryResult[0]?.values[0][0] || 0;
  const delivered_orders = deliveryResult[0]?.values[0][1] || 0;
  const delivery_rate = total_orders > 0 ? (delivered_orders / total_orders) : 0;

  // Taux de litiges
  const disputeResult = db.exec(`
    SELECT COUNT(*) as total_disputes FROM disputes d
    JOIN orders o ON o.id = d.order_id
    WHERE o.vendor_id = ${vendor_id} AND d.status != 'rejected'
  `);
  const total_disputes = disputeResult[0]?.values[0][0] || 0;
  const dispute_rate = total_orders > 0 ? (total_disputes / total_orders) : 0;

  // Calcul score (0-100)
  const rating_score = (avg_rating / 5) * 40;
  const delivery_score = delivery_rate * 30;
  const dispute_score = Math.max(0, (1 - dispute_rate * 10)) * 10;
  const score = Math.round(Math.min(100, rating_score + delivery_score + dispute_score));

  // Déterminer le niveau
  const total_sales_result = db.exec(`SELECT total_sales FROM vendor_profiles WHERE user_id = ${vendor_id}`);
  const total_sales = total_sales_result[0]?.values[0][0] || 0;

  let level = 'nouveau';
  if (total_sales >= 200 && avg_rating >= 4.8) level = 'elite';
  else if (total_sales >= 51 && avg_rating >= 4.5) level = 'top';
  else if (total_sales >= 11 && avg_rating >= 4.0) level = 'confirme';

  // Upsert reputation
  const existing = db.exec(`SELECT id FROM vendor_reputation WHERE vendor_id = ${vendor_id}`);
  if (existing.length && existing[0].values.length) {
    db.run(
      `UPDATE vendor_reputation SET score = ?, level = ?, avg_rating = ?, delivery_rate = ?,
       dispute_rate = ?, total_reviews = ?, updated_at = datetime('now') WHERE vendor_id = ?`,
      [score, level, avg_rating, delivery_rate, dispute_rate, total_reviews, vendor_id]
    );
  } else {
    db.run(
      `INSERT INTO vendor_reputation (vendor_id, score, level, avg_rating, delivery_rate, dispute_rate, total_reviews)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vendor_id, score, level, avg_rating, delivery_rate, dispute_rate, total_reviews]
    );
  }
  saveDb();

  return { score, level, avg_rating, delivery_rate, dispute_rate, total_reviews };
};

// POST /api/reputation/reviews — Laisser un avis
const createReview = async (req, res) => {
  const { order_id, rating_product, rating_delivery, rating_communication, rating_packaging, comment } = req.body;

  if (!order_id || !rating_product || !rating_delivery || !rating_communication || !rating_packaging) {
    return res.status(400).json({ success: false, message: 'Tous les critères de notation sont requis' });
  }

  const ratings = [rating_product, rating_delivery, rating_communication, rating_packaging];
  if (ratings.some(r => r < 1 || r > 5)) {
    return res.status(400).json({ success: false, message: 'Les notes doivent être entre 1 et 5' });
  }

  if (comment && comment.trim().split(' ').length < 10) {
    return res.status(400).json({ success: false, message: 'Le commentaire doit contenir au moins 10 mots' });
  }

  try {
    const db = await getDb();

    // Vérifier la commande
    const orderResult = db.exec(
      `SELECT buyer_id, vendor_id, status, updated_at FROM orders WHERE id = ${parseInt(order_id)}`
    );

    if (!orderResult.length || !orderResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [buyer_id, vendor_id, status, updated_at] = orderResult[0].values[0];

    if (buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Seul l\'acheteur peut laisser un avis' });
    }

    if (status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'La commande doit être livrée pour laisser un avis' });
    }

    // Vérifier délai 7 jours
    const deliveredAt = new Date(updated_at);
    const daysSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7) {
      return res.status(400).json({ success: false, message: 'Le délai pour noter est dépassé (7 jours après livraison)' });
    }

    // Vérifier avis existant
    const existingReview = db.exec(`SELECT id FROM reviews WHERE order_id = ${parseInt(order_id)}`);
    if (existingReview.length && existingReview[0].values.length) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà laissé un avis pour cette commande' });
    }

    db.run(
      `INSERT INTO reviews (order_id, buyer_id, vendor_id, rating_product, rating_delivery, rating_communication, rating_packaging, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parseInt(order_id), buyer_id, vendor_id, rating_product, rating_delivery, rating_communication, rating_packaging, comment || null]
    );
    saveDb();

    // Recalculer la réputation
    const reputation = await calculateReputation(vendor_id);

    res.status(201).json({
      success: true,
      message: 'Avis publié avec succès',
      data: { reputation },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/reputation/reviews/:vendorId — Avis d'un vendeur
const getVendorReviews = async (req, res) => {
  const { vendorId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT r.id, r.rating_product, r.rating_delivery, r.rating_communication,
             r.rating_packaging, r.comment, r.created_at,
             u.name as buyer_name
      FROM reviews r
      JOIN users u ON u.id = r.buyer_id
      WHERE r.vendor_id = ${parseInt(vendorId)} AND r.flagged = 0
      ORDER BY r.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let reviews = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      reviews = result[0].values.map(vals => {
        const r = {};
        cols.forEach((c, i) => (r[c] = vals[i]));
        r.avg = ((r.rating_product + r.rating_delivery + r.rating_communication + r.rating_packaging) / 4).toFixed(1);
        return r;
      });
    }

    // Réputation globale
    const repResult = db.exec(`SELECT * FROM vendor_reputation WHERE vendor_id = ${parseInt(vendorId)}`);
    let reputation = null;
    if (repResult.length && repResult[0].values.length) {
      const cols = repResult[0].columns;
      reputation = {};
      cols.forEach((c, i) => (reputation[c] = repResult[0].values[0][i]));
    }

    res.json({ success: true, data: { reviews, reputation } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/reputation/disputes — Ouvrir un litige
const openDispute = async (req, res) => {
  const { order_id, reason, description } = req.body;

  if (!order_id || !reason) {
    return res.status(400).json({ success: false, message: 'order_id et reason requis' });
  }

  try {
    const db = await getDb();

    const orderResult = db.exec(
      `SELECT buyer_id, vendor_id, status FROM orders WHERE id = ${parseInt(order_id)}`
    );

    if (!orderResult.length || !orderResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [buyer_id, vendor_id, status] = orderResult[0].values[0];

    if (buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Seul l\'acheteur peut ouvrir un litige' });
    }

    if (['cancelled', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: `Impossible d'ouvrir un litige sur une commande "${status}"` });
    }

    // Vérifier litige existant
    const existing = db.exec(
      `SELECT id FROM disputes WHERE order_id = ${parseInt(order_id)} AND status IN ('open', 'vendor_replied', 'in_review')`
    );
    if (existing.length && existing[0].values.length) {
      return res.status(400).json({ success: false, message: 'Un litige est déjà ouvert pour cette commande' });
    }

    db.run(
      `INSERT INTO disputes (order_id, opened_by, reason, description) VALUES (?, ?, ?, ?)`,
      [parseInt(order_id), req.user.id, reason, description || null]
    );

    // Geler l'escrow
    db.run(
      `UPDATE transactions SET escrow_released = 0 WHERE order_id = ${parseInt(order_id)}`
    );
    saveDb();

    res.status(201).json({
      success: true,
      message: 'Litige ouvert. Le vendeur a 48h pour répondre.',
      data: { order_id, status: 'open', escrow_frozen: true },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/reputation/disputes/:id/respond — Vendeur répond au litige
const respondToDispute = async (req, res) => {
  const { id } = req.params;
  const { vendor_response } = req.body;

  if (!vendor_response) {
    return res.status(400).json({ success: false, message: 'Réponse requise' });
  }

  try {
    const db = await getDb();

    const disputeResult = db.exec(`
      SELECT d.id, d.status, o.vendor_id FROM disputes d
      JOIN orders o ON o.id = d.order_id
      WHERE d.id = ${parseInt(id)}
    `);

    if (!disputeResult.length || !disputeResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Litige introuvable' });
    }

    const [, status, vendor_id] = disputeResult[0].values[0];

    if (vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (status !== 'open') {
      return res.status(400).json({ success: false, message: 'Ce litige ne peut plus être modifié' });
    }

    db.run(
      `UPDATE disputes SET vendor_response = ?, vendor_responded_at = datetime('now'),
       status = 'vendor_replied', updated_at = datetime('now') WHERE id = ${parseInt(id)}`,
      [vendor_response]
    );
    saveDb();

    res.json({ success: true, message: 'Réponse envoyée. La plateforme va arbitrer.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/reputation/disputes/:id/resolve — Admin résout le litige
const resolveDispute = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès admin requis' });
  }

  const { id } = req.params;
  const { resolution, resolution_type } = req.body;

  const validTypes = ['buyer_wins', 'vendor_wins', 'partial_refund', 'rejected'];
  if (!resolution || !resolution_type || !validTypes.includes(resolution_type)) {
    return res.status(400).json({ success: false, message: `resolution et resolution_type requis. Types: ${validTypes.join(', ')}` });
  }

  try {
    const db = await getDb();

    const disputeResult = db.exec(`
      SELECT d.order_id, o.vendor_id FROM disputes d
      JOIN orders o ON o.id = d.order_id
      WHERE d.id = ${parseInt(id)}
    `);

    if (!disputeResult.length || !disputeResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Litige introuvable' });
    }

    const [order_id, vendor_id] = disputeResult[0].values[0];

    db.run(
      `UPDATE disputes SET resolution = ?, resolution_type = ?, resolved_by = ?,
       resolved_at = datetime('now'), status = 'resolved', updated_at = datetime('now')
       WHERE id = ${parseInt(id)}`,
      [resolution, resolution_type, req.user.id]
    );

    // Impact sur le score vendeur si litige perdu
    if (resolution_type === 'buyer_wins') {
      db.run(
        `UPDATE vendor_reputation SET score = MAX(0, score - 5) WHERE vendor_id = ${vendor_id}`
      );
    }

    saveDb();

    res.json({
      success: true,
      message: 'Litige résolu',
      data: { dispute_id: id, resolution_type },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/reputation/reports — Signaler un produit ou vendeur
const createReport = async (req, res) => {
  const { target_type, target_id, reason, description } = req.body;

  const validTypes = ['product', 'vendor', 'review'];
  if (!target_type || !target_id || !reason || !validTypes.includes(target_type)) {
    return res.status(400).json({ success: false, message: 'target_type, target_id et reason requis' });
  }

  try {
    const db = await getDb();

    db.run(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, description) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, target_type, parseInt(target_id), reason, description || null]
    );
    saveDb();

    res.status(201).json({ success: true, message: 'Signalement enregistré. Notre équipe va examiner.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/reputation/:vendorId — Score réputation d'un vendeur
const getReputation = async (req, res) => {
  const { vendorId } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`SELECT * FROM vendor_reputation WHERE vendor_id = ${parseInt(vendorId)}`);

    if (!result.length || !result[0].values.length) {
      return res.json({
        success: true,
        data: {
          reputation: {
            vendor_id: parseInt(vendorId),
            score: 0, level: 'nouveau',
            avg_rating: 0, delivery_rate: 0,
            dispute_rate: 0, total_reviews: 0,
          },
        },
      });
    }

    const cols = result[0].columns;
    const reputation = {};
    cols.forEach((c, i) => (reputation[c] = result[0].values[0][i]));

    res.json({ success: true, data: { reputation } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  createReview,
  getVendorReviews,
  openDispute,
  respondToDispute,
  resolveDispute,
  createReport,
  getReputation,
};