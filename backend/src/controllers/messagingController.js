const { getDb, saveDb } = require('../config/database');

// Initialiser les tables messagerie
const initMessagingSchema = async () => {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      product_id INTEGER,
      order_id INTEGER,
      last_message_at TEXT DEFAULT (datetime('now')),
      buyer_unread INTEGER DEFAULT 0,
      vendor_unread INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (vendor_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER,
      type TEXT DEFAULT 'text',
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      flagged INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS message_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      channel TEXT DEFAULT 'inapp',
      sent INTEGER DEFAULT 0,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (recipient_id) REFERENCES users(id)
    );
  `);
  saveDb();
};

initMessagingSchema();

// Filtrer les numéros de téléphone et liens suspects
const filterContent = (content) => {
  // Bloquer numéros de téléphone (formats béninois et internationaux)
  let filtered = content.replace(/(\+?229\s?)?([0-9]{2}\s?){4}/g, '****');
  filtered = filtered.replace(/\+?[0-9]{10,13}/g, '****');
  // Bloquer liens WhatsApp et redirections hors plateforme
  filtered = filtered.replace(/wa\.me\/[^\s]*/gi, '[lien bloqué]');
  filtered = filtered.replace(/whatsapp\.com\/[^\s]*/gi, '[lien bloqué]');
  return filtered;
};

// Vérifier si le contenu contient des infos bloquées
const containsBlockedContent = (content) => {
  const phoneRegex = /(\+?229\s?)?([0-9]{2}\s?){4}|\+?[0-9]{10,13}/;
  const waRegex = /wa\.me\/|whatsapp\.com\//i;
  return phoneRegex.test(content) || waRegex.test(content);
};

// Injecter un message système dans une conversation
const injectSystemMessage = async (conversation_id, content) => {
  const db = await getDb();
  db.run(
    `INSERT INTO messages (conversation_id, sender_id, type, content) VALUES (?, NULL, 'system', ?)`,
    [conversation_id, content]
  );
  db.run(
    `UPDATE conversations SET last_message_at = datetime('now') WHERE id = ${conversation_id}`
  );
  saveDb();
};

// POST /api/conversations — Créer ou retrouver une conversation
const getOrCreateConversation = async (req, res) => {
  const { vendor_id, product_id } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ success: false, message: 'vendor_id requis' });
  }

  if (req.user.id === parseInt(vendor_id)) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous envoyer un message' });
  }

  try {
    const db = await getDb();

    // Chercher conversation existante
    let existing = db.exec(`
      SELECT id FROM conversations
      WHERE buyer_id = ${req.user.id} AND vendor_id = ${parseInt(vendor_id)}
      ${product_id ? `AND product_id = ${parseInt(product_id)}` : ''}
      AND status = 'active'
      LIMIT 1
    `);

    let conversationId;

    if (existing.length && existing[0].values.length) {
      conversationId = existing[0].values[0][0];
    } else {
      db.run(
        `INSERT INTO conversations (buyer_id, vendor_id, product_id) VALUES (?, ?, ?)`,
        [req.user.id, parseInt(vendor_id), product_id ? parseInt(product_id) : null]
      );
      saveDb();

      const newConv = db.exec(
        `SELECT id FROM conversations WHERE buyer_id = ${req.user.id} AND vendor_id = ${parseInt(vendor_id)} ORDER BY created_at DESC LIMIT 1`
      );
      conversationId = newConv[0].values[0][0];

      // Message système de bienvenue
      if (product_id) {
        const productResult = db.exec(`SELECT name FROM products WHERE id = ${parseInt(product_id)}`);
        const productName = productResult.length ? productResult[0].values[0][0] : 'ce produit';
        await injectSystemMessage(conversationId, `Conversation démarrée à propos de "${productName}"`);
      }
    }

    res.json({ success: true, data: { conversation_id: conversationId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/conversations — Liste des conversations
const getConversations = async (req, res) => {
  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT c.id, c.buyer_unread, c.vendor_unread, c.last_message_at, c.status,
             buyer.name as buyer_name, buyer.avatar as buyer_avatar,
             vp.shop_name, u_vendor.avatar as vendor_avatar,
             p.name as product_name, p.thumbnail as product_thumbnail,
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM conversations c
      JOIN users buyer ON buyer.id = c.buyer_id
      JOIN users u_vendor ON u_vendor.id = c.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = c.vendor_id
      LEFT JOIN products p ON p.id = c.product_id
      WHERE (c.buyer_id = ${req.user.id} OR c.vendor_id = ${req.user.id})
      AND c.status = 'active'
      ORDER BY c.last_message_at DESC
    `);

    let conversations = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      conversations = result[0].values.map(vals => {
        const c = {};
        cols.forEach((col, i) => (c[col] = vals[i]));
        c.unread = req.user.id === c.buyer_id ? c.buyer_unread : c.vendor_unread;
        return c;
      });
    }

    res.json({ success: true, data: { conversations } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/conversations/:id — Détail + messages
const getConversation = async (req, res) => {
  const { id } = req.params;
  const { limit = 30, before } = req.query;

  try {
    const db = await getDb();

    const convResult = db.exec(`
      SELECT c.*, buyer.name as buyer_name, vp.shop_name
      FROM conversations c
      JOIN users buyer ON buyer.id = c.buyer_id
      LEFT JOIN vendor_profiles vp ON vp.user_id = c.vendor_id
      WHERE c.id = ${parseInt(id)}
    `);

    if (!convResult.length || !convResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    }

    const cols = convResult[0].columns;
    const conv = {};
    cols.forEach((c, i) => (conv[c] = convResult[0].values[0][i]));

    if (conv.buyer_id !== req.user.id && conv.vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const beforeClause = before ? `AND m.created_at < '${before}'` : '';

    const messagesResult = db.exec(`
      SELECT m.id, m.sender_id, m.type, m.content, m.is_read, m.flagged, m.created_at,
             u.name as sender_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ${parseInt(id)} ${beforeClause}
      ORDER BY m.created_at DESC
      LIMIT ${parseInt(limit)}
    `);

    let messages = [];
    if (messagesResult.length && messagesResult[0].values.length) {
      const mcols = messagesResult[0].columns;
      messages = messagesResult[0].values.map(vals => {
        const m = {};
        mcols.forEach((c, i) => (m[c] = vals[i]));
        return m;
      }).reverse();
    }

    // Marquer comme lu
    if (conv.buyer_id === req.user.id) {
      db.run(`UPDATE conversations SET buyer_unread = 0 WHERE id = ${parseInt(id)}`);
    } else {
      db.run(`UPDATE conversations SET vendor_unread = 0 WHERE id = ${parseInt(id)}`);
    }
    db.run(`UPDATE messages SET is_read = 1, read_at = datetime('now') WHERE conversation_id = ${parseInt(id)} AND sender_id != ${req.user.id} AND is_read = 0`);
    saveDb();

    res.json({ success: true, data: { conversation: conv, messages } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/conversations/:id/messages — Envoyer un message
const sendMessage = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Message vide' });
  }

  if (content.length > 1000) {
    return res.status(400).json({ success: false, message: 'Message trop long (max 1000 caractères)' });
  }

  try {
    const db = await getDb();

    const convResult = db.exec(`SELECT buyer_id, vendor_id FROM conversations WHERE id = ${parseInt(id)}`);
    if (!convResult.length || !convResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    }

    const [buyer_id, vendor_id] = convResult[0].values[0];

    if (buyer_id !== req.user.id && vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // Filtrer le contenu
    const hasBlocked = containsBlockedContent(content);
    const filteredContent = filterContent(content);

    db.run(
      `INSERT INTO messages (conversation_id, sender_id, type, content) VALUES (?, ?, 'text', ?)`,
      [parseInt(id), req.user.id, filteredContent]
    );

    // Incrémenter unread pour le destinataire
    if (req.user.id === buyer_id) {
      db.run(`UPDATE conversations SET vendor_unread = vendor_unread + 1, last_message_at = datetime('now') WHERE id = ${parseInt(id)}`);
    } else {
      db.run(`UPDATE conversations SET buyer_unread = buyer_unread + 1, last_message_at = datetime('now') WHERE id = ${parseInt(id)}`);
    }
    saveDb();

    const response = {
      success: true,
      message: 'Message envoyé',
      data: { content: filteredContent },
    };

    if (hasBlocked) {
      response.warning = 'Certaines informations de contact ont été masquées';
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/conversations/:id/poll — Polling nouveaux messages
const pollMessages = async (req, res) => {
  const { id } = req.params;
  const { since } = req.query;

  if (!since) {
    return res.status(400).json({ success: false, message: 'since (timestamp) requis' });
  }

  try {
    const db = await getDb();

    const convResult = db.exec(`SELECT buyer_id, vendor_id FROM conversations WHERE id = ${parseInt(id)}`);
    if (!convResult.length || !convResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    }

    const [buyer_id, vendor_id] = convResult[0].values[0];
    if (buyer_id !== req.user.id && vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const result = db.exec(`
      SELECT m.id, m.sender_id, m.type, m.content, m.is_read, m.created_at,
             u.name as sender_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ${parseInt(id)} AND m.created_at > '${since}'
      ORDER BY m.created_at ASC
    `);

    let messages = [];
    if (result.length && result[0].values.length) {
      const cols = result[0].columns;
      messages = result[0].values.map(vals => {
        const m = {};
        cols.forEach((c, i) => (m[c] = vals[i]));
        return m;
      });
    }

    res.json({ success: true, data: { messages, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PUT /api/conversations/:id/read — Marquer comme lu
const markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const convResult = db.exec(`SELECT buyer_id, vendor_id FROM conversations WHERE id = ${parseInt(id)}`);
    if (!convResult.length || !convResult[0].values.length) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    }

    const [buyer_id, vendor_id] = convResult[0].values[0];

    if (buyer_id !== req.user.id && vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    if (req.user.id === buyer_id) {
      db.run(`UPDATE conversations SET buyer_unread = 0 WHERE id = ${parseInt(id)}`);
    } else {
      db.run(`UPDATE conversations SET vendor_unread = 0 WHERE id = ${parseInt(id)}`);
    }

    db.run(`UPDATE messages SET is_read = 1, read_at = datetime('now') WHERE conversation_id = ${parseInt(id)} AND sender_id != ${req.user.id} AND is_read = 0`);
    saveDb();

    res.json({ success: true, message: 'Messages marqués comme lus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/messages/:id/flag — Signaler un message
const flagMessage = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();

    const result = db.exec(`
      SELECT m.id, c.buyer_id, c.vendor_id FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ${parseInt(id)}
    `);

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Message introuvable' });
    }

    const [, buyer_id, vendor_id] = result[0].values[0];

    if (buyer_id !== req.user.id && vendor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    db.run(`UPDATE messages SET flagged = 1 WHERE id = ${parseInt(id)}`);
    saveDb();

    res.json({ success: true, message: 'Message signalé' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/unread-count — Badge total non-lus
const getUnreadCount = async (req, res) => {
  try {
    const db = await getDb();

    let count = 0;

    if (req.user.role === 'buyer') {
      const result = db.exec(`SELECT SUM(buyer_unread) FROM conversations WHERE buyer_id = ${req.user.id} AND status = 'active'`);
      count = result[0]?.values[0][0] || 0;
    } else {
      const result = db.exec(`SELECT SUM(vendor_unread) FROM conversations WHERE vendor_id = ${req.user.id} AND status = 'active'`);
      count = result[0]?.values[0][0] || 0;
    }

    res.json({ success: true, data: { unread_count: count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getOrCreateConversation,
  getConversations,
  getConversation,
  sendMessage,
  pollMessages,
  markAsRead,
  flagMessage,
  getUnreadCount,
  injectSystemMessage,
};