const { getDb, saveDb } = require('../config/database');

// GET /api/vendors — Liste des vendeurs (avec filtre zone)
const getVendors = async (req, res) => {
  const { city, district, neighborhood, search, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['u.is_active = 1'];
  if (city) where.push(`vp.city = '${city}'`);
  if (district) where.push(`vp.district = '${district}'`);
  if (neighborhood) where.push(`vp.neighborhood = '${neighborhood}'`);
  if (search) where.push(`(vp.shop_name LIKE '%${search}%' OR u.name LIKE '%${search}%')`);

  const whereClause = `WHERE ${where.join(' AND ')}`;

  try {
    const db = await getDb();

    const countResult = db.exec(`
      SELECT COUNT(*) FROM users u
      JOIN vendor_profiles vp ON vp.user_id = u.id
      ${whereClause}
    `);
    const total = countResult[0]?.values[0][0] || 0;

    const result = db.exec(`
      SELECT u.id, u.name, u.avatar,
             vp.shop_name, vp.description, vp.badge_verified,
             vp.reputation_score, vp.total_sales,
             vp.city, vp.district, vp.neighborhood,
             COUNT(p.id) as product_count
      FROM users u
      JOIN vendor_profiles vp ON vp.user_id = u.id
      LEFT JOIN products p ON p.vendor_id = u.id AND p.status = 'active'
      ${whereClause}
      GROUP BY u.id
      ORDER BY vp.badge_verified DESC, vp.reputation_score DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);

    let vendors = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      vendors = result[0].values.map(vals => {
        const v = {};
        cols.forEach((c, i) => (v[c] = vals[i]));
        return v;
      });
    }

    res.json({
      success: true,
      data: {
        vendors,
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

// GET /api/vendors/:id — Profil public d'un vendeur
const getVendor = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT u.id, u.name, u.avatar, u.created_at,
             vp.shop_name, vp.description, vp.badge_verified,
             vp.reputation_score, vp.total_sales,
             vp.city, vp.district, vp.neighborhood
      FROM users u
      JOIN vendor_profiles vp ON vp.user_id = u.id
      WHERE u.id = ${parseInt(id)} AND u.is_active = 1
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Vendeur introuvable' });
    }

    const cols = result[0].columns;
    const vendor = {};
    cols.forEach((c, i) => (vendor[c] = result[0].values[0][i]));

    // Produits actifs du vendeur
    const productsResult = db.exec(`
      SELECT id, name, slug, price, compare_price, thumbnail, condition, views
      FROM products
      WHERE vendor_id = ${parseInt(id)} AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 8
    `);

    let products = [];
    if (productsResult.length && productsResult[0].values.length) {
      const pcols = productsResult[0].columns;
      products = productsResult[0].values.map(vals => {
        const p = {};
        pcols.forEach((c, i) => (p[c] = vals[i]));
        return p;
      });
    }

    vendor.products = products;

    res.json({ success: true, data: { vendor } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/vendors/dashboard — Dashboard du vendeur connecté
const getDashboard = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  try {
    const db = await getDb();

    // Stats produits
    const statsResult = db.exec(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_products,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_products,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(views) as total_views
      FROM products
      WHERE vendor_id = ${req.user.id}
    `);

    const statsCols = statsResult[0].columns;
    const stats = {};
    statsCols.forEach((c, i) => (stats[c] = statsResult[0].values[0][i]));

    // Profil vendeur
    const profileResult = db.exec(`
      SELECT vp.shop_name, vp.description, vp.kyc_status, vp.badge_verified,
             vp.reputation_score, vp.total_sales, vp.wallet_balance,
             vp.city, vp.district, vp.neighborhood
      FROM vendor_profiles vp
      WHERE vp.user_id = ${req.user.id}
    `);

    const profileCols = profileResult[0].columns;
    const profile = {};
    profileCols.forEach((c, i) => (profile[c] = profileResult[0].values[0][i]));

    // Produits récents
    const recentResult = db.exec(`
      SELECT id, name, price, stock, status, views, created_at
      FROM products
      WHERE vendor_id = ${req.user.id}
      ORDER BY created_at DESC
      LIMIT 5
    `);

    let recent_products = [];
    if (recentResult.length && recentResult[0].values.length) {
      const rcols = recentResult[0].columns;
      recent_products = recentResult[0].values.map(vals => {
        const p = {};
        rcols.forEach((c, i) => (p[c] = vals[i]));
        return p;
      });
    }

    res.json({
      success: true,
      data: { profile, stats, recent_products },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/vendors/profile — Mettre à jour le profil vendeur
const updateProfile = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { shop_name, description, city, district, neighborhood } = req.body;

  try {
    const db = await getDb();

    const updates = [];
    if (shop_name) updates.push(`shop_name = '${shop_name}'`);
    if (description !== undefined) updates.push(`description = '${description}'`);
    if (city !== undefined) updates.push(`city = '${city}'`);
    if (district !== undefined) updates.push(`district = '${district}'`);
    if (neighborhood !== undefined) updates.push(`neighborhood = '${neighborhood}'`);

    if (updates.length) {
      db.run(`UPDATE vendor_profiles SET ${updates.join(', ')} WHERE user_id = ${req.user.id}`);
      saveDb();
    }

    res.json({ success: true, message: 'Profil mis à jour' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/vendors/zones — Liste des villes et arrondissements du Bénin
const getZones = async (req, res) => {
  const zones = {
    "Cotonou": ["Akpakpa", "Cadjehoun", "Godomey", "Fidjrosse", "Agla", "Avotrou", "Gbegamey", "Haie Vive", "Jericho", "Kpondéhou", "Ladji", "Literacy", "Menontin", "Mènontin", "Midombo", "Moussanon", "Sainte Rita", "Sikècodji", "Tokpa", "Vossa", "Zogbo"],
    "Porto-Novo": ["Aguidi", "Avrankou", "Djassin", "Houinmè", "Kpanroun", "Ouando", "St Jean"],
    "Parakou": ["Banikanni", "Madina", "Titirou", "Zongo"],
    "Abomey-Calavi": ["Abomey-Calavi Centre", "Ahozon", "Akassato", "Glo-Djigbé", "Houakpè-Daho", "Kpanroun", "Ouèdo", "Togba", "Zinvié"],
    "Bohicon": ["Avégamè", "Lissèzoun", "Passagon"],
    "Natitingou": ["Centre", "Tchoumi-Tchoumi"],
    "Lokossa": ["Centre", "Houin"],
    "Abomey": ["Centre", "Sèhoun"],
    "Kandi": ["Centre", "Kassakou"],
    "Djougou": ["Centre", "Partago"]
  };

  res.json({ success: true, data: { zones } });
};

module.exports = { getVendors, getVendor, getDashboard, updateProfile, getZones };