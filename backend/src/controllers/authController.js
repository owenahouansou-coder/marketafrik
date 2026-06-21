const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { getDb, saveDb } = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Nom trop court'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caracteres'),
  body('role').optional().isIn(['buyer', 'vendor']).withMessage('Role invalide'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
];

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, phone, role = 'buyer', shop_name } = req.body;

  try {
    const db = await getDb();

    const existing = db.exec(`SELECT id FROM users WHERE email = '${email}'`);
    if (existing.length && existing[0].values.length) {
      return res.status(409).json({ success: false, message: 'Email deja utilise' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    db.run(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      [name, email, phone || null, password_hash, role]
    );
    saveDb();

    const userResult = db.exec(`SELECT id FROM users WHERE email = '${email}'`);
    const userId = userResult[0].values[0][0];

    if (role === 'vendor') {
      if (!shop_name) {
        return res.status(400).json({ success: false, message: 'Nom de boutique requis pour les vendeurs' });
      }
      db.run(`INSERT INTO vendor_profiles (user_id, shop_name) VALUES (?, ?)`, [userId, shop_name]);
      saveDb();
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, verifyToken, verifyExpires]
    );
    saveDb();

    try {
      await sendVerificationEmail(email, name, verifyToken);
    } catch (mailErr) {
      console.warn('Email non envoyé (config manquante en dev):', mailErr.message);
    }

    const payload = { id: userId, email, role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, refreshToken, expiresAt]
    );
    saveDb();

    res.status(201).json({
      success: true,
      message: 'Compte cree. Verifie ton email pour activer ton compte.',
      data: {
        user: { id: userId, name, email, role, is_verified: 0 },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const db = await getDb();

    const result = db.exec(`SELECT id, name, email, password_hash, role, is_active, is_verified FROM users WHERE email = '${email}'`);

    if (!result.length || !result[0].values.length) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const [id, name, userEmail, password_hash, role, is_active, is_verified] = result[0].values[0];

    if (!is_active) {
      return res.status(403).json({ success: false, message: 'Compte suspendu' });
    }

    const isValid = await bcrypt.compare(password, password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    const payload = { id, email: userEmail, role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [id, refreshToken, expiresAt]
    );
    saveDb();

    res.json({
      success: true,
      message: 'Connexion reussie',
      data: {
        user: { id, name, email: userEmail, role, is_verified },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token manquant' });
  }

  try {
    const db = await getDb();

    const result = db.exec(
      `SELECT id, user_id, used FROM email_verifications 
       WHERE token = '${token}' AND expires_at > datetime('now')`
    );

    if (!result.length || !result[0].values.length) {
      return res.status(400).json({ success: false, message: 'Token invalide ou expire' });
    }

    const [verifyId, userId, used] = result[0].values[0];

    if (used) {
      return res.status(400).json({ success: false, message: 'Token deja utilise' });
    }

    db.run(`UPDATE users SET is_verified = 1, updated_at = datetime('now') WHERE id = ${userId}`);
    db.run(`UPDATE email_verifications SET used = 1 WHERE id = ${verifyId}`);
    saveDb();

    res.json({ success: true, message: 'Email verifie avec succes !' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email requis' });
  }

  try {
    const db = await getDb();

    const result = db.exec(`SELECT id, name, is_verified FROM users WHERE email = '${email}'`);
    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const [userId, name, is_verified] = result[0].values[0];

    if (is_verified) {
      return res.status(400).json({ success: false, message: 'Email deja verifie' });
    }

    db.run(`DELETE FROM email_verifications WHERE user_id = ${userId}`);

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, verifyToken, verifyExpires]
    );
    saveDb();

    try {
      await sendVerificationEmail(email, name, verifyToken);
    } catch (mailErr) {
      console.warn('Email non envoye:', mailErr.message);
    }

    res.json({ success: true, message: 'Email de verification renvoye' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email requis' });
  }

  try {
    const db = await getDb();

    const result = db.exec(`SELECT id, name FROM users WHERE email = '${email}'`);
    if (!result.length || !result[0].values.length) {
      return res.json({ success: true, message: 'Si cet email existe, un lien a ete envoye' });
    }

    const [userId, name] = result[0].values[0];

    db.run(`DELETE FROM password_resets WHERE user_id = ${userId}`);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, resetToken, resetExpires]
    );
    saveDb();

    try {
      await sendPasswordResetEmail(email, name, resetToken);
    } catch (mailErr) {
      console.warn('Email non envoye:', mailErr.message);
    }

    res.json({ success: true, message: 'Si cet email existe, un lien a ete envoye' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token et mot de passe requis' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Mot de passe minimum 6 caracteres' });
  }

  try {
    const db = await getDb();

    const result = db.exec(
      `SELECT id, user_id, used FROM password_resets 
       WHERE token = '${token}' AND expires_at > datetime('now')`
    );

    if (!result.length || !result[0].values.length) {
      return res.status(400).json({ success: false, message: 'Token invalide ou expire' });
    }

    const [resetId, userId, used] = result[0].values[0];

    if (used) {
      return res.status(400).json({ success: false, message: 'Token deja utilise' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    db.run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [password_hash, userId]);
    db.run(`UPDATE password_resets SET used = 1 WHERE id = ${resetId}`);
    db.run(`DELETE FROM refresh_tokens WHERE user_id = ${userId}`);
    saveDb();

    res.json({ success: true, message: 'Mot de passe reinitialise avec succes' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token manquant' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const db = await getDb();

    const result = db.exec(
      `SELECT id FROM refresh_tokens WHERE token = '${refreshToken}' AND user_id = ${decoded.id} AND expires_at > datetime('now')`
    );

    if (!result.length || !result[0].values.length) {
      return res.status(401).json({ success: false, message: 'Refresh token invalide ou expire' });
    }

    const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email, role: decoded.role });

    res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Refresh token invalide' });
  }
};

const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const db = await getDb();
    db.run(`DELETE FROM refresh_tokens WHERE token = '${refreshToken}'`);
    saveDb();
  }

  res.json({ success: true, message: 'Deconnexion reussie' });
};

const me = async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_verified, u.avatar, u.created_at,
              vp.shop_name, vp.kyc_status, vp.badge_verified, vp.reputation_score, vp.wallet_balance,
              vp.city, vp.district, vp.neighborhood
       FROM users u
       LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
       WHERE u.id = ${req.user.id}`
    );

    if (!result.length || !result[0].values.length) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const cols = result[0].columns;
    const vals = result[0].values[0];
    const user = {};
    cols.forEach((col, i) => (user[col] = vals[i]));

    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  registerValidation,
  loginValidation,
};