const { getDb, saveDb } = require('../config/database');

// Ajouter la table orders au schéma si pas encore fait
const initOrderSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      total_amount REAL NOT NULL,
      delivery_option TEXT DEFAULT 'standard',
      delivery_address TEXT,
      delivery_city TEXT,
      delivery_district TEXT,
      notes TEXT,
      cancelled_by INTEGER,
      cancelled_at TEXT,
      cancel_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);
  saveDb();
};

initOrderSchema();

// POST /api/orders — Créer une commande
const createOrder = async (req, res) => {
  const { items, delivery_option = 'standard', delivery_address, delivery_city, delivery_district, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Articles requis' });
  }

  try {
    const db = await getDb();

    // Vérifier les produits et calculer le total
    let total_amount = 0;
    let vendor_id = null;
    const validatedItems = [];

    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ success: false, message: 'Article invalide' });
      }

      const result = db.exec(
        `SELECT id, name, price, stock, vendor_id, status FROM products WHERE id = ${parseInt(item.product_id)}`
      );

      if (!result.length || !result[0].values.length) {
        return res.status(404).json({ success: false, message: `Produit ${item.product_id} introuvable` });
      }

      const [pid, pname, pprice, pstock, pvendor, pstatus] = result[0].values[0];

      if (pstatus !== 'active') {
        return res.status(400).json({ success: false, message: `Produit "${pname}" non disponible` });
      }

      if (pstock < item.quantity) {
        return res.status(400).json({ success: false, message: `Stock insuffisant pour "${pname}"` });
      }

      // Une commande = un seul vendeur
      if (vendor_id && vendor_id !== pvendor) {
        return res.status(400).json({ success: false, message: 'Une commande ne peut contenir que les produits d\'un seul vendeur' });
      }
      vendor_id = pvendor;

      const subtotal = pprice * item.quantity;
      total_amount += subtotal;

      validatedItems.push({ product_id: pid, product_name: pname, product_price: pprice, quantity: item.quantity, subtotal });
    }

    // Créer la commande
    db.run(
      `INSERT INTO orders (buyer_id, vendor_id, total_amount, delivery_option, delivery_address, delivery_city, delivery_district, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, vendor_id, total_amount, delivery_option, delivery_address || null,
       delivery_city || null, delivery_district || null, notes || null]
    );
    saveDb();

    // Récupérer l'ID de la commande
    const orderResult = db.exec(
      `SELECT id FROM orders WHERE buyer_id = ${req.user.id} ORDER BY created_at DESC LIMIT 1`
    );
    const orderId = orderResult[0].values[0][0];

    // Ajouter les articles
    for (const item of validatedItems) {
      db.run(
        `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.product_price, item.quantity, item.subtotal]
      );

      // Décrémenter le stock
      db.run(`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.product_id}`);
    }
    saveDb();

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: {
        order_id: orderId,
        total_amount,
        status: 'pending',
        items: validatedItems,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/orders — Historique commandes (acheteur ou vendeur)
const getOrders = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  if (req.user.role === 'buyer') where.push(`o.buyer_id = ${req.user.id}`);
  if (req.user.role === 'vendor') where.push(`o.vendor_id = ${req.user.id}`);
  if (status) where.push(`o.status = '${status}'`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const db = await getDb();

    const countResult = db.exec(`SELECT COUNT(*) FROM orders o ${whereClause}`);
    const total = countResult[0]?.values[0][0] || 0;

    const result = db.exec(`
      SELECT o.id, o.status, o.total_amount, o.delivery_option,
             o.delivery_city, o.delivery_district, o.created_at, o.updated_at,
             buyer.name as buyer_name, buyer.email as buyer_email,
             vp.shop_name as vendor_shop
      FROM orders o
      JOIN users buyer ON buyer.id = o.buyer_id
      JOIN vendor_profiles vp ON vp.user_id = o.vendor_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let orders = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      orders = result[0].values.map(vals => {
        const o = {};
        cols.forEach((c, i) => (o[c] = vals[i]));
        return o;
      });
    }

    res.json({
      success: true,
      data: {
        orders,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/orders/:id — Détail d'une commande
const getOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT o.*, 
             buyer.name as buyer_name, buyer.email as buyer_email, buyer.phone as buyer_phone,
             vp.shop_name, vp.city as vendor_city, vp.district as vendor_district
      FROM orders o
      JOIN users buyer ON buyer.id = o.buyer_id
      JOIN vendor_profiles vp ON vp.user_id = o.vendor_id
      WHERE o.id = ${parseInt(id)}
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const cols = result[0].columns;
    const order = {};
    cols.forEach((c, i) => (order[c] = result[0].values[0][i]));

    // Vérifier accès
    if (order.buyer_id !== req.user.id && order.vendor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // Articles de la commande
    const itemsResult = db.exec(`
      SELECT oi.*, p.thumbnail, p.slug
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ${parseInt(id)}
    `);

    let items = [];
    if (itemsResult.length && itemsResult[0].values.length) {
      const icols = itemsResult[0].columns;
      items = itemsResult[0].values.map(vals => {
        const item = {};
        icols.forEach((c, i) => (item[c] = vals[i]));
        return item;
      });
    }

    order.items = items;

    res.json({ success: true, data: { order } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/orders/:id/status — Mettre à jour le statut (vendeur)
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Statut invalide. Valeurs: ${validStatuses.join(', ')}` });
  }

  try {
    const db = await getDb();

    const result = db.exec(`SELECT buyer_id, vendor_id, status as current_status FROM orders WHERE id = ${parseInt(id)}`);
    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [buyer_id, vendor_id, current_status] = result[0].values[0];

    if (vendor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (current_status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Commande déjà annulée' });
    }

    if (current_status === 'delivered') {
      return res.status(400).json({ success: false, message: 'Commande déjà livrée' });
    }

    db.run(
      `UPDATE orders SET status = '${status}', updated_at = datetime('now') WHERE id = ${parseInt(id)}`
    );

    // Si livré, incrémenter total_sales du vendeur
    if (status === 'delivered') {
      db.run(`UPDATE vendor_profiles SET total_sales = total_sales + 1 WHERE user_id = ${vendor_id}`);
    }

    saveDb();

    res.json({ success: true, message: `Statut mis à jour : ${status}`, data: { order_id: id, status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/orders/:id/cancel — Annuler une commande (acheteur)
const cancelOrder = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const db = await getDb();

    const result = db.exec(`SELECT buyer_id, vendor_id, status FROM orders WHERE id = ${parseInt(id)}`);
    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const [buyer_id, vendor_id, status] = result[0].values[0];

    if (buyer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (['shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: `Impossible d'annuler une commande en statut "${status}"` });
    }

    db.run(
      `UPDATE orders SET status = 'cancelled', cancelled_by = ${req.user.id}, 
       cancelled_at = datetime('now'), cancel_reason = ?, updated_at = datetime('now')
       WHERE id = ${parseInt(id)}`,
      [reason || null]
    );

    // Remettre le stock
    const itemsResult = db.exec(`SELECT product_id, quantity FROM order_items WHERE order_id = ${parseInt(id)}`);
    if (itemsResult.length && itemsResult[0].values.length) {
      for (const [product_id, quantity] of itemsResult[0].values) {
        db.run(`UPDATE products SET stock = stock + ${quantity} WHERE id = ${product_id}`);
      }
    }

    saveDb();

    res.json({ success: true, message: 'Commande annulée', data: { order_id: id, status: 'cancelled' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { createOrder, getOrders, getOrder, updateOrderStatus, cancelOrder };   