const { getDb, saveDb } = require('../config/database');

// Commissions par catégorie (tier Gratuit)
const COMMISSION_RATES = {
  'electronique': 0.08,
  'mode': 0.15,
  'alimentation': 0.12,
  'maison': 0.10,
  'beaute': 0.15,
  'agriculture': 0.12,
  'services': 0.18,
  'artisanat': 0.10,
  'digital': 0.20,
  'default': 0.15,
};

// Réductions commission par plan
const PLAN_DISCOUNTS = {
  'free': 0,
  'standard': 0.02,
  'pro': 0.04,
  'business': 0.06,
};

// Limites produits par plan
const PLAN_LIMITS = {
  'free': 10,
  'standard': 50,
  'pro': 200,
  'business': Infinity,
};

// Prix abonnements en FCFA
const PLAN_PRICES = {
  'free': 0,
  'standard': 2500,
  'pro': 7500,
  'business': 15000,
};

// Prix boosts en FCFA
const BOOST_PRICES = {
  'product_7d': 500,
  'product_30d': 1500,
  'banner_7d': 3000,
  'push_1000': 2000,
};

// Initialiser les tables paiements
const initPaymentSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      commission_rate REAL NOT NULL,
      commission_amount REAL NOT NULL,
      vendor_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'mobile_money',
      mobile_number TEXT,
      fedapay_transaction_id TEXT,
      escrow_released INTEGER DEFAULT 0,
      escrow_released_at TEXT,
      refunded INTEGER DEFAULT 0,
      refunded_at TEXT,
      refund_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER UNIQUE NOT NULL,
      plan TEXT DEFAULT 'free',
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );
  `);
  saveDb();
};

initPaymentSchema();

// POST /api/payments/initiate
const initiatePayment = async (req, res) => {
  const { order_id, mobile_number, payment_method = 'mobile_money' } = req.body;

  if (!order_id || !mobile_number) {
    return res.status(400).json({ success: false, message: 'order_id et mobile_number requis' });
  }

  try {
    const db = await getDb();

    const orderResult = db.exec(`
      SELECT o.id, o.buyer_id, o.vendor_id, o.total_amount, o.status,
             p.category_id, c.slug as category_slug
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.id = ${parseInt(order_id)}
      LIMIT 1
    `);

    if (!orderResult.length || !orderResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [oid, buyer_id, vendor_id, total_amount, order_status, , category_slug] = orderResult[0].values[0];

    if (buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (order_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Commande déjà payée ou annulée' });
    }

    const existingTx = db.exec(
      `SELECT id FROM transactions WHERE order_id = ${parseInt(order_id)} AND status IN ('pending', 'paid')`
    );
    if (existingTx.length && existingTx[0].values.length) {
      return res.status(400).json({ success: false, message: 'Paiement déjà initié' });
    }

    // Récupérer le plan du vendeur
    const subResult = db.exec(
      `SELECT plan FROM vendor_subscriptions WHERE vendor_id = ${vendor_id} AND (expires_at IS NULL OR expires_at > datetime('now'))`
    );
    const vendorPlan = subResult.length && subResult[0].values.length ? subResult[0].values[0][0] : 'free';

    // Calculer la commission avec réduction selon le plan
    const baseRate = COMMISSION_RATES[category_slug] || COMMISSION_RATES['default'];
    const discount = PLAN_DISCOUNTS[vendorPlan] || 0;
    const rate = Math.max(0, baseRate - discount);
    const commission_amount = Math.round(total_amount * rate);
    const vendor_amount = total_amount - commission_amount;

    const fedapay_transaction_id = `SIMUL_${Date.now()}`;

    db.run(
      `INSERT INTO transactions (order_id, buyer_id, vendor_id, amount, commission_rate, commission_amount, vendor_amount, payment_method, mobile_number, fedapay_transaction_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [oid, buyer_id, vendor_id, total_amount, rate, commission_amount, vendor_amount, payment_method, mobile_number, fedapay_transaction_id]
    );
    saveDb();

    res.json({
      success: true,
      message: 'Paiement initié. Confirmez sur votre téléphone Mobile Money.',
      data: {
        transaction_id: fedapay_transaction_id,
        amount: total_amount,
        commission: commission_amount,
        vendor_receives: vendor_amount,
        commission_rate: `${(rate * 100).toFixed(0)}%`,
        vendor_plan: vendorPlan,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/payments/confirm
const confirmPayment = async (req, res) => {
  const { transaction_id, status = 'paid' } = req.body;

  if (!transaction_id) {
    return res.status(400).json({ success: false, message: 'transaction_id requis' });
  }

  try {
    const db = await getDb();

    const txResult = db.exec(
      `SELECT id, order_id, vendor_id, vendor_amount, status FROM transactions WHERE fedapay_transaction_id = '${transaction_id}'`
    );

    if (!txResult.length || !txResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Transaction introuvable' });
    }

    const [txId, order_id, vendor_id, vendor_amount, currentStatus] = txResult[0].values[0];

    if (currentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Transaction déjà confirmée' });
    }

    if (status === 'paid') {
      db.run(`UPDATE transactions SET status = 'paid', updated_at = datetime('now') WHERE id = ${txId}`);
      db.run(`UPDATE orders SET status = 'confirmed', updated_at = datetime('now') WHERE id = ${order_id}`);
      db.run(`UPDATE vendor_profiles SET wallet_balance = wallet_balance + ${vendor_amount} WHERE user_id = ${vendor_id}`);
    } else {
      db.run(`UPDATE transactions SET status = 'failed', updated_at = datetime('now') WHERE id = ${txId}`);
    }
    saveDb();

    res.json({ success: true, message: status === 'paid' ? 'Paiement confirmé' : 'Paiement échoué', data: { transaction_id, status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/payments/release/:orderId
const releaseEscrow = async (req, res) => {
  const { orderId } = req.params;

  try {
    const db = await getDb();

    const txResult = db.exec(
      `SELECT id, vendor_id, vendor_amount, escrow_released FROM transactions WHERE order_id = ${parseInt(orderId)} AND status = 'paid'`
    );

    if (!txResult.length || !txResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Transaction introuvable' });
    }

    const [txId, vendor_id, vendor_amount, escrow_released] = txResult[0].values[0];

    if (escrow_released) {
      return res.status(400).json({ success: false, message: 'Escrow déjà libéré' });
    }

    const orderResult = db.exec(`SELECT status FROM orders WHERE id = ${parseInt(orderId)}`);
    if (orderResult[0].values[0][0] !== 'delivered') {
      return res.status(400).json({ success: false, message: 'La commande doit être livrée' });
    }

    db.run(`UPDATE transactions SET escrow_released = 1, escrow_released_at = datetime('now') WHERE id = ${txId}`);
    saveDb();

    res.json({ success: true, message: 'Escrow libéré', data: { vendor_amount } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/payments/refund/:orderId
const refundPayment = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès admin requis' });
  }

  const { orderId } = req.params;
  const { reason } = req.body;

  try {
    const db = await getDb();

    const txResult = db.exec(
      `SELECT id, buyer_id, vendor_id, amount, vendor_amount, refunded FROM transactions WHERE order_id = ${parseInt(orderId)} AND status = 'paid'`
    );

    if (!txResult.length || !txResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Transaction introuvable' });
    }

    const [txId, buyer_id, vendor_id, amount, vendor_amount, refunded] = txResult[0].values[0];

    if (refunded) {
      return res.status(400).json({ success: false, message: 'Déjà remboursé' });
    }

    db.run(`UPDATE vendor_profiles SET wallet_balance = wallet_balance - ${vendor_amount} WHERE user_id = ${vendor_id}`);
    db.run(`UPDATE transactions SET refunded = 1, refunded_at = datetime('now'), refund_reason = ? WHERE id = ${txId}`, [reason || null]);
    db.run(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ${parseInt(orderId)}`);
    saveDb();

    res.json({ success: true, message: 'Remboursement effectué', data: { amount_refunded: amount } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/payments/history
const getTransactionHistory = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  if (req.user.role === 'buyer') where.push(`t.buyer_id = ${req.user.id}`);
  if (req.user.role === 'vendor') where.push(`t.vendor_id = ${req.user.id}`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT t.id, t.amount, t.commission_amount, t.vendor_amount, t.commission_rate,
             t.status, t.payment_method, t.escrow_released, t.refunded, t.created_at,
             o.id as order_id, buyer.name as buyer_name, vp.shop_name
      FROM transactions t
      JOIN orders o ON o.id = t.order_id
      JOIN users buyer ON buyer.id = t.buyer_id
      JOIN vendor_profiles vp ON vp.user_id = t.vendor_id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let transactions = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      transactions = result[0].values.map(vals => {
        const t = {};
        cols.forEach((c, i) => (t[c] = vals[i]));
        return t;
      });
    }

    res.json({ success: true, data: { transactions } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/payments/wallet
const getWallet = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  try {
    const db = await getDb();

    const result = db.exec(`SELECT wallet_balance, total_sales FROM vendor_profiles WHERE user_id = ${req.user.id}`);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const [wallet_balance, total_sales] = result[0].values[0];

    res.json({ success: true, data: { wallet_balance, total_sales, currency: 'FCFA' } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/payments/subscribe
const subscribe = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { plan } = req.body;

  if (!plan || !PLAN_PRICES.hasOwnProperty(plan)) {
    return res.status(400).json({ success: false, message: `Plan invalide. Options: ${Object.keys(PLAN_PRICES).join(', ')}` });
  }

  try {
    const db = await getDb();

    const expires_at = plan === 'free' ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const existing = db.exec(`SELECT id FROM vendor_subscriptions WHERE vendor_id = ${req.user.id}`);
    if (existing.length && existing[0].values.length) {
      db.run(
        `UPDATE vendor_subscriptions SET plan = '${plan}', expires_at = ?, updated_at = datetime('now') WHERE vendor_id = ${req.user.id}`,
        [expires_at]
      );
    } else {
      db.run(
        `INSERT INTO vendor_subscriptions (vendor_id, plan, expires_at) VALUES (?, ?, ?)`,
        [req.user.id, plan, expires_at]
      );
    }
    saveDb();

    res.json({
      success: true,
      message: `Abonnement ${plan} activé`,
      data: {
        plan,
        price: PLAN_PRICES[plan],
        expires_at,
        product_limit: PLAN_LIMITS[plan] === Infinity ? 'illimité' : PLAN_LIMITS[plan],
        commission_discount: `${(PLAN_DISCOUNTS[plan] * 100).toFixed(0)}%`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/payments/boost
const boostProduct = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { product_id, boost_type } = req.body;

  if (!product_id || !boost_type || !BOOST_PRICES[boost_type]) {
    return res.status(400).json({ success: false, message: `boost_type invalide. Options: ${Object.keys(BOOST_PRICES).join(', ')}` });
  }

  try {
    const db = await getDb();

    const productCheck = db.exec(
      `SELECT id FROM products WHERE id = ${parseInt(product_id)} AND vendor_id = ${req.user.id}`
    );
    if (!productCheck.length || !productCheck[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const days = boost_type.includes('7d') ? 7 : boost_type.includes('30d') ? 30 : 1;
    const boost_expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    db.run(`UPDATE products SET is_featured = 1 WHERE id = ${parseInt(product_id)}`);
    saveDb();

    res.json({
      success: true,
      message: `Produit boosté pour ${days} jour(s)`,
      data: { product_id, boost_type, price: BOOST_PRICES[boost_type], expires_at: boost_expires },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/payments/plans
const getPlans = async (req, res) => {
  res.json({
    success: true,
    data: {
      plans: [
        { name: 'free', label: 'Gratuit', price: 0, product_limit: 10, commission_discount: '0%', features: ['10 produits', 'Commission standard', 'Support communauté'] },
        { name: 'standard', label: 'Standard', price: 2500, product_limit: 50, commission_discount: '2%', features: ['50 produits', '-2% commission', 'Badge vérifié', 'Analytics basiques'] },
        { name: 'pro', label: 'Pro', price: 7500, product_limit: 200, commission_discount: '4%', features: ['200 produits', '-4% commission', '1 boost/mois', 'Support WhatsApp', 'Analytics avancés'] },
        { name: 'business', label: 'Business', price: 15000, product_limit: 'illimité', commission_discount: '6%', features: ['Produits illimités', '-6% commission', '3 boosts/mois', 'Boutique personnalisée', 'Support prioritaire'] },
      ],
      boosts: [
        { type: 'product_7d', label: 'Boost produit 7j', price: 500 },
        { type: 'product_30d', label: 'Boost produit 30j', price: 1500 },
        { type: 'banner_7d', label: 'Bannière catégorie 7j', price: 3000 },
        { type: 'push_1000', label: 'Push notification', price: 2000 },
      ],
    },
  });
};

module.exports = {
  initiatePayment,
  confirmPayment,
  releaseEscrow,
  refundPayment,
  getTransactionHistory,
  getWallet,
  subscribe,
  boostProduct,
  getPlans,
};