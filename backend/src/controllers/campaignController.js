const { getDb, saveDb } = require('../config/database');

// Initialiser la table campaigns
const initCampaignSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      cta_text TEXT DEFAULT 'J''en profite',
      cta_link TEXT DEFAULT '/produits',
      banner_image TEXT,
      bg_color TEXT DEFAULT '#C0390B',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_at) REFERENCES users(id)
    );
  `);
  saveDb();
};

initCampaignSchema();

// GET /api/campaigns/active — Récupérer la campagne active (public, pour la home)
const getActiveCampaign = async (req, res) => {
  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT * FROM campaigns
      WHERE is_active = 1
      AND starts_at <= datetime('now')
      AND ends_at >= datetime('now')
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!result.length || !result[0].values.length) {
      return res.json({ success: true, data: { campaign: null } });
    }

    const cols = result[0].columns;
    const campaign = {};
    cols.forEach((c, i) => (campaign[c] = result[0].values[0][i]));

    res.json({ success: true, data: { campaign } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/campaigns — Liste toutes les campagnes (admin)
const getAllCampaigns = async (req, res) => {
  try {
    const db = await getDb();

    const result = db.exec(`SELECT * FROM campaigns ORDER BY created_at DESC`);

    let campaigns = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      campaigns = result[0].values.map(vals => {
        const c = {};
        cols.forEach((col, i) => (c[col] = vals[i]));
        return c;
      });
    }

    res.json({ success: true, data: { campaigns } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/campaigns — Créer une campagne (admin)
const createCampaign = async (req, res) => {
  const { title, subtitle, cta_text, cta_link, bg_color, starts_at, ends_at } = req.body;

  if (!title || !starts_at || !ends_at) {
    return res.status(400).json({ success: false, message: 'title, starts_at et ends_at requis' });
  }

  try {
    const db = await getDb();

    const banner_image = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(
      `INSERT INTO campaigns (title, subtitle, cta_text, cta_link, banner_image, bg_color, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        subtitle || null,
        cta_text || 'J\'en profite',
        cta_link || '/produits',
        banner_image,
        bg_color || '#C0390B',
        starts_at,
        ends_at,
      ]
    );
    saveDb();

    res.status(201).json({ success: true, message: 'Campagne créée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PATCH /api/campaigns/:id — Activer/désactiver une campagne (admin)
const toggleCampaign = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    const db = await getDb();

    db.run(`UPDATE campaigns SET is_active = ${is_active ? 1 : 0} WHERE id = ${parseInt(id)}`);
    saveDb();

    res.json({ success: true, message: `Campagne ${is_active ? 'activée' : 'désactivée'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// DELETE /api/campaigns/:id — Supprimer une campagne (admin)
const deleteCampaign = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    db.run(`DELETE FROM campaigns WHERE id = ${parseInt(id)}`);
    saveDb();

    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getActiveCampaign,
  getAllCampaigns,
  createCampaign,
  toggleCampaign,
  deleteCampaign,
};