const { body, validationResult } = require('express-validator');
const { getDb, saveDb } = require('../config/database');

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    + '-' + Date.now();
}

const productValidation = [
  body('name').trim().isLength({ min: 3 }).withMessage('Nom minimum 3 caractères'),
  body('price').isFloat({ min: 0 }).withMessage('Prix invalide'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock invalide'),
  body('category_id').optional().isInt().withMessage('Catégorie invalide'),
  body('status').optional().isIn(['draft', 'active', 'paused', 'sold_out']).withMessage('Statut invalide'),
  body('condition').optional().isIn(['new', 'used', 'refurbished']).withMessage('Condition invalide'),
];

const createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Seuls les vendeurs peuvent créer des produits' });
  }

  const {
    name, description, price, compare_price,
    stock = 0, unit = 'unité', category_id,
    status = 'draft', condition = 'new', location, tags = []
  } = req.body;

  try {
    const db = await getDb();

    const vendorCheck = db.exec(`SELECT id FROM vendor_profiles WHERE user_id = ${req.user.id}`);
    if (!vendorCheck.length || !vendorCheck[0].values.length) {
      return res.status(403).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const thumbnail = images.length > 0 ? images[0] : null;
    const slug = slugify(name);

    db.run(
      `INSERT INTO products (vendor_id, category_id, name, slug, description, price, compare_price, stock, unit, images, thumbnail, status, condition, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, category_id || null, name, slug, description || null, price,
       compare_price || null, stock, unit, JSON.stringify(images), thumbnail, status, condition, location || null]
    );
    saveDb();

    const result = db.exec(`SELECT * FROM products WHERE slug = '${slug}'`);
    const cols = result[0].columns;
    const vals = result[0].values[0];
    const product = {};
    cols.forEach((c, i) => (product[c] = vals[i]));
    product.images = JSON.parse(product.images || '[]');

    if (tags.length) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      tagList.forEach(tag => {
        db.run(`INSERT INTO product_tags (product_id, tag) VALUES (?, ?)`, [product.id, tag.trim()]);
      });
      saveDb();
    }

    res.status(201).json({ success: true, message: 'Produit créé', data: { product } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const getProducts = async (req, res) => {
  const {
    page = 1, limit = 12, category, search,
    min_price, max_price, condition, status = 'active',
    vendor_id, sort = 'created_at', order = 'DESC',
    city, district,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [`p.status = '${status}'`];
  if (category) where.push(`c.slug = '${category}'`);
  if (search) where.push(`p.name LIKE '%${search}%'`);
  if (min_price) where.push(`p.price >= ${parseFloat(min_price)}`);
  if (max_price) where.push(`p.price <= ${parseFloat(max_price)}`);
  if (condition) where.push(`p.condition = '${condition}'`);
  if (vendor_id) where.push(`p.vendor_id = ${parseInt(vendor_id)}`);
  if (city) where.push(`vp.city = '${city}'`);
  if (district) where.push(`vp.district = '${district}'`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const allowedSorts = ['created_at', 'price', 'views', 'name'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

  try {
    const db = await getDb();

    const countResult = db.exec(`
      SELECT COUNT(*) FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = p.vendor_id
      ${whereClause}
    `);
    const total = countResult[0]?.values[0][0] || 0;

    const result = db.exec(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             u.name as vendor_name, vp.shop_name, vp.badge_verified,
             vp.reputation_score, vp.city, vp.district
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN users u ON u.id = p.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = p.vendor_id
      ${whereClause}
      ORDER BY p.${sortCol} ${sortOrder}
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let products = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      products = result[0].values.map(vals => {
        const p = {};
        cols.forEach((c, i) => (p[c] = vals[i]));
        p.images = JSON.parse(p.images || '[]');
        return p;
      });
    }

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const getProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             u.name as vendor_name, u.email as vendor_email,
             vp.shop_name, vp.badge_verified, vp.reputation_score,
             vp.total_sales, vp.city, vp.district, vp.neighborhood
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN users u ON u.id = p.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = p.vendor_id
      WHERE p.id = ${parseInt(id)}
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const cols = result[0].columns;
    const product = {};
    cols.forEach((c, i) => (product[c] = result[0].values[0][i]));
    product.images = JSON.parse(product.images || '[]');

    const tagsResult = db.exec(`SELECT tag FROM product_tags WHERE product_id = ${id}`);
    product.tags = tagsResult.length ? tagsResult[0].values.map(v => v[0]) : [];

    db.run(`UPDATE products SET views = views + 1 WHERE id = ${id}`);
    saveDb();

    res.json({ success: true, data: { product } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const check = db.exec(`SELECT vendor_id FROM products WHERE id = ${parseInt(id)}`);
    if (!check.length || !check[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }
    if (check[0].values[0][0] !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    const { name, description, price, compare_price, stock, unit, category_id, status, condition, location } = req.body;

    const updates = [];
    if (name) updates.push(`name = '${name}'`);
    if (description !== undefined) updates.push(`description = '${description}'`);
    if (price !== undefined) updates.push(`price = ${parseFloat(price)}`);
    if (compare_price !== undefined) updates.push(`compare_price = ${parseFloat(compare_price)}`);
    if (stock !== undefined) updates.push(`stock = ${parseInt(stock)}`);
    if (unit) updates.push(`unit = '${unit}'`);
    if (category_id !== undefined) updates.push(`category_id = ${parseInt(category_id)}`);
    if (status) updates.push(`status = '${status}'`);
    if (condition) updates.push(`condition = '${condition}'`);
    if (location !== undefined) updates.push(`location = '${location}'`);

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => `/uploads/${f.filename}`);
      updates.push(`images = '${JSON.stringify(newImages)}'`);
      updates.push(`thumbnail = '${newImages[0]}'`);
    }

    updates.push(`updated_at = datetime('now')`);

    if (updates.length) {
      db.run(`UPDATE products SET ${updates.join(', ')} WHERE id = ${parseInt(id)}`);
      saveDb();
    }

    const result = db.exec(`SELECT * FROM products WHERE id = ${parseInt(id)}`);
    const cols = result[0].columns;
    const product = {};
    cols.forEach((c, i) => (product[c] = result[0].values[0][i]));
    product.images = JSON.parse(product.images || '[]');

    res.json({ success: true, message: 'Produit mis à jour', data: { product } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const check = db.exec(`SELECT vendor_id FROM products WHERE id = ${parseInt(id)}`);
    if (!check.length || !check[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }
    if (check[0].values[0][0] !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    db.run(`DELETE FROM product_tags WHERE product_id = ${parseInt(id)}`);
    db.run(`DELETE FROM products WHERE id = ${parseInt(id)}`);
    saveDb();

    res.json({ success: true, message: 'Produit supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const getCategories = async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM categories ORDER BY name ASC`);
    const categories = result.length && result[0].values.length
      ? result[0].values.map(vals => {
          const c = {};
          result[0].columns.forEach((col, i) => (c[col] = vals[i]));
          return c;
        })
      : [];
    res.json({ success: true, data: { categories } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  productValidation,
};