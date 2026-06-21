const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../marketafrik.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    initSchema();
    saveDb();
  }

  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'buyer',
      is_verified INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      avatar TEXT,
      refresh_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vendor_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      shop_name TEXT NOT NULL,
      description TEXT,
      kyc_status TEXT DEFAULT 'pending',
      kyc_document TEXT,
      kyc_submitted_at TEXT,
      badge_verified INTEGER DEFAULT 0,
      reputation_score REAL DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      wallet_balance REAL DEFAULT 0,
      city TEXT,
      district TEXT,
      neighborhood TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS kyc_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      document_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT,
      parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      category_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      compare_price REAL,
      stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'unite',
      images TEXT DEFAULT '[]',
      thumbnail TEXT,
      status TEXT DEFAULT 'draft',
      condition TEXT DEFAULT 'new',
      location TEXT,
      views INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS product_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    INSERT OR IGNORE INTO categories (name, slug, description, icon) VALUES
      ('Electronique', 'electronique', 'Telephones, ordinateurs, accessoires', '📱'),
      ('Mode & Vetements', 'mode', 'Habits, chaussures, accessoires mode', '👗'),
      ('Alimentation', 'alimentation', 'Produits alimentaires locaux et importes', '🍎'),
      ('Maison & Decor', 'maison', 'Meubles, deco, ustensiles', '🏠'),
      ('Beaute & Sante', 'beaute', 'Cosmetiques, soins, sante', '💄'),
      ('Agriculture', 'agriculture', 'Produits agricoles, semences, outils', '🌾'),
      ('Services', 'services', 'Prestations et services divers', '🔧'),
      ('Artisanat', 'artisanat', 'Produits artisanaux locaux', '🎨');
  `);
}

module.exports = { getDb, saveDb };