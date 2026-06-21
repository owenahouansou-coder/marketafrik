const { getDb, saveDb } = require('../config/database');

// Initialiser les tables marketing
const initMarketingSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_id INTEGER NOT NULL,
      referral_code TEXT NOT NULL,
      reward_given INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (referrer_id) REFERENCES users(id),
      FOREIGN KEY (referred_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS promo_flash (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      original_price REAL NOT NULL,
      promo_price REAL NOT NULL,
      discount_percent REAL NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      added_at TEXT DEFAULT (datetime('now')),
      reminded INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Ajouter referral_code à users si pas encore fait
  try {
    db.run(`ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE`);
    db.run(`ALTER TABLE users ADD COLUMN referred_by INTEGER`);
  } catch (e) {}

  // Ajouter champs promo aux produits si pas encore fait
  try {
    db.run(`ALTER TABLE products ADD COLUMN promo_price REAL`);
    db.run(`ALTER TABLE products ADD COLUMN promo_ends_at TEXT`);
  } catch (e) {}

  saveDb();
};

initMarketingSchema();

// Générer un code parrainage unique
const generateReferralCode = (name) => {
  const base = name.toLowerCase().replace(/[^a-z]/g, '').substring(0, 5);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${rand}`;
};

// GET /api/marketing/sitemap — Sitemap XML
const getSitemap = async (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const db = await getDb();

    const productsResult = db.exec(`SELECT slug, updated_at FROM products WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1000`);
    const categoriesResult = db.exec(`SELECT slug FROM categories`);
    const vendorsResult = db.exec(`SELECT u.id, vp.shop_name FROM users u JOIN vendor_profiles vp ON vp.user_id = u.id WHERE u.is_active = 1`);

    let urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${baseUrl}/produits</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${baseUrl}/vendeurs</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ];

    if (categoriesResult.length && categoriesResult[0].values.length) {
      categoriesResult[0].values.forEach(([slug]) => {
        urls.push(`<url><loc>${baseUrl}/categorie/${slug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
      });
    }

    if (productsResult.length && productsResult[0].values.length) {
      productsResult[0].values.forEach(([slug, updated_at]) => {
        urls.push(`<url><loc>${baseUrl}/produits/${slug}</loc><lastmod>${updated_at?.split(' ')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
      });
    }

    if (vendorsResult.length && vendorsResult[0].values.length) {
      vendorsResult[0].values.forEach(([id, shop_name]) => {
        const shopSlug = shop_name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || id;
        urls.push(`<url><loc>${baseUrl}/boutique/${shopSlug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
      });
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/marketing/seo/product/:slug — Données SEO produit
const getProductSeo = async (req, res) => {
  const { slug } = req.params;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT p.id, p.name, p.slug, p.description, p.price, p.thumbnail, p.stock,
             vp.shop_name, vp.city, vp.avg_rating,
             vr.avg_rating as rating, vr.total_reviews
      FROM products p
      LEFT JOIN vendor_profiles vp ON vp.user_id = p.vendor_id
      LEFT JOIN vendor_reputation vr ON vr.vendor_id = p.vendor_id
      WHERE p.slug = '${slug}' AND p.status = 'active'
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const cols = result[0].columns;
    const product = {};
    cols.forEach((c, i) => (product[c] = result[0].values[0][i]));

    const productUrl = `${baseUrl}/produits/${slug}`;
    const imageUrl = product.thumbnail ? `${baseUrl}${product.thumbnail}` : `${baseUrl}/og-default.jpg`;
    const city = product.city || 'Bénin';
    const title = `${product.name} - ${city} | MarketAfrik`;
    const description = product.description
      ? product.description.substring(0, 160)
      : `Achetez ${product.name} à ${product.price} FCFA sur MarketAfrik. Livraison ${city}.`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: imageUrl,
      offers: {
        '@type': 'Offer',
        price: product.price.toString(),
        priceCurrency: 'XOF',
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: productUrl,
        seller: { '@type': 'Organization', name: product.shop_name },
      },
      ...(product.rating && product.total_reviews > 0 ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: product.rating.toFixed(1),
          reviewCount: product.total_reviews.toString(),
        },
      } : {}),
    };

    res.json({
      success: true,
      data: {
        title,
        description,
        canonical: productUrl,
        og: {
          title,
          description,
          image: imageUrl,
          url: productUrl,
          type: 'product',
        },
        whatsapp_share: `https://wa.me/?text=${encodeURIComponent(`${product.name} - ${product.price} FCFA\n${productUrl}`)}`,
        json_ld: jsonLd,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/marketing/referral — Obtenir son code parrainage
const getReferralCode = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  try {
    const db = await getDb();

    const result = db.exec(`SELECT referral_code, name FROM users WHERE id = ${req.user.id}`);
    let referral_code = result[0]?.values[0][0];

    if (!referral_code) {
      const name = result[0]?.values[0][1] || 'vendor';
      referral_code = generateReferralCode(name);
      db.run(`UPDATE users SET referral_code = '${referral_code}' WHERE id = ${req.user.id}`);
      saveDb();
    }

    const referralsResult = db.exec(`
      SELECT COUNT(*) as total, SUM(CASE WHEN reward_given = 1 THEN 1 ELSE 0 END) as rewarded
      FROM referrals WHERE referrer_id = ${req.user.id}
    `);

    const [total, rewarded] = referralsResult[0]?.values[0] || [0, 0];

    res.json({
      success: true,
      data: {
        referral_code,
        referral_link: `${process.env.FRONTEND_URL}/inscription?ref=${referral_code}`,
        stats: { total_referrals: total, rewarded },
        reward: '1 mois Standard offert (2 500 FCFA)',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/marketing/referral/use — Utiliser un code parrainage à l'inscription
const useReferralCode = async (req, res) => {
  const { referral_code } = req.body;

  if (!referral_code) {
    return res.status(400).json({ success: false, message: 'referral_code requis' });
  }

  try {
    const db = await getDb();

    const referrerResult = db.exec(`SELECT id FROM users WHERE referral_code = '${referral_code}'`);
    if (!referrerResult.length || !referrerResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Code parrainage invalide' });
    }

    const referrer_id = referrerResult[0].values[0][0];

    if (referrer_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas utiliser votre propre code' });
    }

    const existingRef = db.exec(`SELECT id FROM referrals WHERE referred_id = ${req.user.id}`);
    if (existingRef.length && existingRef[0].values.length) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà utilisé un code parrainage' });
    }

    db.run(
      `INSERT INTO referrals (referrer_id, referred_id, referral_code) VALUES (?, ?, ?)`,
      [referrer_id, req.user.id, referral_code]
    );

    // Donner 1 mois Standard au parrain
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const existingSub = db.exec(`SELECT id FROM vendor_subscriptions WHERE vendor_id = ${referrer_id}`);
    if (existingSub.length && existingSub[0].values.length) {
      db.run(`UPDATE vendor_subscriptions SET plan = 'standard', expires_at = '${expires_at}' WHERE vendor_id = ${referrer_id}`);
    } else {
      db.run(`INSERT INTO vendor_subscriptions (vendor_id, plan, expires_at) VALUES (${referrer_id}, 'standard', '${expires_at}')`);
    }

    db.run(`UPDATE referrals SET reward_given = 1 WHERE referrer_id = ${referrer_id} AND referred_id = ${req.user.id}`);
    saveDb();

    res.json({ success: true, message: 'Code parrainage appliqué. Votre parrain a reçu 1 mois Standard offert.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/marketing/promo — Créer une promo flash
const createPromoFlash = async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Réservé aux vendeurs' });
  }

  const { product_id, promo_price, duration_hours = 24 } = req.body;

  if (!product_id || !promo_price) {
    return res.status(400).json({ success: false, message: 'product_id et promo_price requis' });
  }

  if (duration_hours > 72) {
    return res.status(400).json({ success: false, message: 'Durée maximale : 72 heures' });
  }

  try {
    const db = await getDb();

    const productResult = db.exec(`SELECT id, name, price, vendor_id FROM products WHERE id = ${parseInt(product_id)}`);
    if (!productResult.length || !productResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const [pid, pname, original_price, vendor_id] = productResult[0].values[0];

    if (vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (promo_price >= original_price) {
      return res.status(400).json({ success: false, message: 'Le prix promo doit être inférieur au prix original' });
    }

    const discount_percent = ((original_price - promo_price) / original_price * 100).toFixed(1);

    if (parseFloat(discount_percent) > 50) {
      return res.status(400).json({ success: false, message: 'Réduction maximale : 50%' });
    }

    const starts_at = new Date().toISOString();
    const ends_at = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();

    // Désactiver les promos actives sur ce produit
    db.run(`UPDATE promo_flash SET is_active = 0 WHERE product_id = ${parseInt(product_id)}`);

    db.run(
      `INSERT INTO promo_flash (product_id, vendor_id, original_price, promo_price, discount_percent, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pid, req.user.id, original_price, parseFloat(promo_price), parseFloat(discount_percent), starts_at, ends_at]
    );

    db.run(`UPDATE products SET promo_price = ${parseFloat(promo_price)}, promo_ends_at = '${ends_at}' WHERE id = ${pid}`);
    saveDb();

    res.status(201).json({
      success: true,
      message: `Promo flash créée — ${discount_percent}% de réduction pendant ${duration_hours}h`,
      data: { product_name: pname, original_price, promo_price, discount_percent, ends_at },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/marketing/promos — Promos flash actives
const getActivePromos = async (req, res) => {
  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT pf.id, pf.promo_price, pf.original_price, pf.discount_percent, pf.ends_at,
             p.id as product_id, p.name, p.slug, p.thumbnail,
             vp.shop_name, vp.city
      FROM promo_flash pf
      JOIN products p ON p.id = pf.product_id
      JOIN vendor_profiles vp ON vp.user_id = pf.vendor_id
      WHERE pf.is_active = 1 AND pf.ends_at > datetime('now')
      ORDER BY pf.discount_percent DESC
      LIMIT 20
    `);

    let promos = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      promos = result[0].values.map(vals => {
        const p = {};
        cols.forEach((c, i) => (p[c] = vals[i]));
        return p;
      });
    }

    res.json({ success: true, data: { promos } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/marketing/robots — robots.txt
const getRobots = (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin
Disallow: /dashboard
Disallow: /profil
Disallow: /commandes

Sitemap: ${baseUrl}/api/marketing/sitemap`);
};

module.exports = {
  getSitemap,
  getProductSeo,
  getReferralCode,
  useReferralCode,
  createPromoFlash,
  getActivePromos,
  getRobots,
};