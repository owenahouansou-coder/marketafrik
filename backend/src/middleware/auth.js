const { verifyAccessToken } = require('../utils/jwt');
const { getDb } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const db = await getDb();
    const result = db.exec(`SELECT id, name, email, role, is_active FROM users WHERE id = ${decoded.id}`);

    if (!result.length || !result[0].values.length) {
      return res.status(401).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const [id, name, email, role, is_active] = result[0].values[0];

    if (!is_active) {
      return res.status(403).json({ success: false, message: 'Compte suspendu' });
    }

    req.user = { id, name, email, role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };