const { getDb, saveDb } = require('../config/database');

// Initialiser la table admin_logs
const initAdminSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES users(id)
    );
  `);
  saveDb();
};

initAdminSchema();

// Helper — Logger une action admin
const logAdminAction = (admin_id, action, target_type, target_id, details) => {
  getDb().then(db => {
    db.run(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)`,
      [admin_id, action, target_type || null, target_id || null, details ? JSON.stringify(details) : null]
    );
    saveDb();
  });
};

// ── 1. DASHBOARD ─────────────────────────────────────────────
// GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const db = await getDb();

    const usersResult = db.exec(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN role = 'vendor' THEN 1 ELSE 0 END) as vendors,
             SUM(CASE WHEN role = 'buyer' THEN 1 ELSE 0 END) as buyers,
             SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as new_this_month
      FROM users WHERE is_active = 1
    `);

    const ordersResult = db.exec(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
             SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM orders
    `);

    const revenueResult = db.exec(`
      SELECT SUM(amount) as gmv, SUM(commission_amount) as commissions
      FROM transactions WHERE status = 'paid'
    `);

    const productsResult = db.exec(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as pending
      FROM products
    `);

    const disputesResult = db.exec(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
             SUM(CASE WHEN status = 'vendor_replied' THEN 1 ELSE 0 END) as awaiting_review
      FROM disputes
    `);

    const kycResult = db.exec(`
      SELECT COUNT(*) as pending FROM vendor_profiles WHERE kyc_status = 'submitted'
    `);

    const parseRow = (result) => {
      if (!result.length || !result[0].values.length) return {};
      const cols = result[0].columns;
      const obj = {};
      cols.forEach((c, i) => (obj[c] = result[0].values[0][i]));
      return obj;
    };

    res.json({
      success: true,
      data: {
        users: parseRow(usersResult),
        orders: parseRow(ordersResult),
        revenue: parseRow(revenueResult),
        products: parseRow(productsResult),
        disputes: parseRow(disputesResult),
        kyc_pending: parseRow(kycResult).pending || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── 2. PRODUITS ──────────────────────────────────────────────
// GET /api/admin/products/pending
const getProductsPending = async (req, res) => {
  const { page = 1, limit = 20, status = 'draft' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT p.id, p.name, p.price, p.status, p.created_at,
             u.name as vendor_name, u.email as vendor_email,
             vp.shop_name, vp.badge_verified,
             c.name as category_name
      FROM products p
      JOIN users u ON u.id = p.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = p.vendor_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = '${status}'
      ORDER BY p.created_at ASC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let products = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      products = result[0].values.map(vals => {
        const p = {};
        cols.forEach((c, i) => (p[c] = vals[i]));
        return p;
      });
    }

    res.json({ success: true, data: { products } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PATCH /api/admin/products/:id/status
const updateProductStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['active', 'paused', 'sold_out'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Statut invalide. Options: ${validStatuses.join(', ')}` });
  }

  try {
    const db = await getDb();

    const check = db.exec(`SELECT id, name FROM products WHERE id = ${parseInt(id)}`);
    if (!check.length || !check[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    db.run(`UPDATE products SET status = '${status}', updated_at = datetime('now') WHERE id = ${parseInt(id)}`);
    saveDb();

    logAdminAction(req.user.id, `product_${status}`, 'product', parseInt(id), { reason, product_name: check[0].values[0][1] });

    res.json({ success: true, message: `Produit mis à jour : ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── 3. UTILISATEURS ──────────────────────────────────────────
// GET /api/admin/users
const getUsers = async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  if (role) where.push(`u.role = '${role}'`);
  if (status === 'active') where.push(`u.is_active = 1`);
  if (status === 'suspended') where.push(`u.is_active = 0`);
  if (search) where.push(`(u.name LIKE '%${search}%' OR u.email LIKE '%${search}%')`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const db = await getDb();

    const countResult = db.exec(`SELECT COUNT(*) FROM users u ${whereClause}`);
    const total = countResult[0]?.values[0][0] || 0;

    const result = db.exec(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.is_verified, u.created_at,
             vp.shop_name, vp.kyc_status, vp.badge_verified, vp.total_sales
      FROM users u
      LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let users = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      users = result[0].values.map(vals => {
        const u = {};
        cols.forEach((c, i) => (u[c] = vals[i]));
        return u;
      });
    }

    res.json({ success: true, data: { users, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PATCH /api/admin/users/:id/status
const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['active', 'suspended', 'banned'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Statut invalide. Options: ${validStatuses.join(', ')}` });
  }

  // Un admin ne peut pas se bannir lui-même
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre compte' });
  }

  try {
    const db = await getDb();

    const check = db.exec(`SELECT id, name, email FROM users WHERE id = ${parseInt(id)}`);
    if (!check.length || !check[0].values.length) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const is_active = status === 'active' ? 1 : 0;
    db.run(`UPDATE users SET is_active = ${is_active}, updated_at = datetime('now') WHERE id = ${parseInt(id)}`);
    saveDb();

    logAdminAction(req.user.id, `user_${status}`, 'user', parseInt(id), { reason, email: check[0].values[0][2] });

    res.json({ success: true, message: `Utilisateur ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── 4. LITIGES ───────────────────────────────────────────────
// GET /api/admin/disputes
const getDisputes = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const whereClause = status ? `WHERE d.status = '${status}'` : '';

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT d.id, d.reason, d.status, d.created_at, d.vendor_responded_at,
             d.resolution_type,
             buyer.name as buyer_name, buyer.email as buyer_email,
             vendor.name as vendor_name,
             vp.shop_name,
             o.total_amount, o.id as order_id
      FROM disputes d
      JOIN orders o ON o.id = d.order_id
      JOIN users buyer ON buyer.id = o.buyer_id
      JOIN users vendor ON vendor.id = o.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = o.vendor_id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let disputes = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      disputes = result[0].values.map(vals => {
        const d = {};
        cols.forEach((c, i) => (d[c] = vals[i]));
        return d;
      });
    }

    res.json({ success: true, data: { disputes } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PATCH /api/admin/disputes/:id/resolve
const resolveDispute = async (req, res) => {
  const { id } = req.params;
  const { resolution, resolution_type } = req.body;

  const validTypes = ['buyer_wins', 'vendor_wins', 'partial_refund', 'rejected'];
  if (!resolution || !resolution_type || !validTypes.includes(resolution_type)) {
    return res.status(400).json({ success: false, message: `resolution_type invalide. Options: ${validTypes.join(', ')}` });
  }

  try {
    const db = await getDb();

    const disputeResult = db.exec(`
      SELECT d.status, o.vendor_id, o.buyer_id, t.vendor_amount, t.id as tx_id
      FROM disputes d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN transactions t ON t.order_id = d.order_id AND t.status = 'paid'
      WHERE d.id = ${parseInt(id)}
    `);

    if (!disputeResult.length || !disputeResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Litige introuvable' });
    }

    const [current_status, vendor_id, buyer_id, vendor_amount, tx_id] = disputeResult[0].values[0];

    if (current_status === 'resolved') {
      return res.status(400).json({ success: false, message: 'Litige déjà résolu' });
    }

    db.run(
      `UPDATE disputes SET resolution = ?, resolution_type = '${resolution_type}',
       resolved_by = ${req.user.id}, resolved_at = datetime('now'),
       status = 'resolved', updated_at = datetime('now')
       WHERE id = ${parseInt(id)}`,
      [resolution]
    );

    // Impact financier selon la résolution
    if (resolution_type === 'buyer_wins' && vendor_amount) {
      db.run(`UPDATE vendor_profiles SET wallet_balance = MAX(0, wallet_balance - ${vendor_amount}) WHERE user_id = ${vendor_id}`);
      db.run(`UPDATE vendor_reputation SET score = MAX(0, score - 5) WHERE vendor_id = ${vendor_id}`);
    }

    saveDb();

    logAdminAction(req.user.id, 'dispute_resolved', 'dispute', parseInt(id), { resolution_type, resolution });

    res.json({ success: true, message: 'Litige résolu', data: { resolution_type } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── 5. COMMISSIONS ───────────────────────────────────────────
// GET /api/admin/commissions
const getCommissions = async (req, res) => {
  const { from, to, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [`t.status = 'paid'`];
  if (from) where.push(`t.created_at >= '${from}'`);
  if (to) where.push(`t.created_at <= '${to}'`);

  const whereClause = `WHERE ${where.join(' AND ')}`;

  try {
    const db = await getDb();

    const summaryResult = db.exec(`
      SELECT SUM(amount) as gmv, SUM(commission_amount) as total_commissions,
             SUM(vendor_amount) as total_vendor_payouts, COUNT(*) as total_transactions
      FROM transactions t ${whereClause}
    `);

    const result = db.exec(`
      SELECT t.id, t.amount, t.commission_rate, t.commission_amount,
             t.vendor_amount, t.status, t.created_at,
             buyer.name as buyer_name,
             vp.shop_name,
             o.id as order_id
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

    const summCols = summaryResult[0]?.columns || [];
    const summary = {};
    summCols.forEach((c, i) => (summary[c] = summaryResult[0].values[0][i]));

    res.json({ success: true, data: { summary, transactions } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── 6. LOGS ──────────────────────────────────────────────────
// GET /api/admin/logs
const getAdminLogs = async (req, res) => {
  const { admin_id, action, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  if (admin_id) where.push(`l.admin_id = ${parseInt(admin_id)}`);
  if (action) where.push(`l.action LIKE '%${action}%'`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at,
             u.name as admin_name, u.email as admin_email
      FROM admin_logs l
      JOIN users u ON u.id = l.admin_id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let logs = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      logs = result[0].values.map(vals => {
        const l = {};
        cols.forEach((c, i) => (l[c] = vals[i]));
        if (l.details) {
          try { l.details = JSON.parse(l.details); } catch (e) {}
        }
        return l;
      });
    }

    res.json({ success: true, data: { logs } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getDashboard,
  getProductsPending,
  updateProductStatus,
  getUsers,
  updateUserStatus,
  getDisputes,
  resolveDispute,
  getCommissions,
  getAdminLogs,
};