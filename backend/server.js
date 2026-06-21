require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const kycRoutes = require('./src/routes/kyc');
const productRoutes = require('./src/routes/products');
const vendorRoutes = require('./src/routes/vendors');
const orderRoutes = require('./src/routes/orders');
const paymentRoutes = require('./src/routes/payments');
const deliveryRoutes = require('./src/routes/delivery');
const reputationRoutes = require('./src/routes/reputation');
const messagingRoutes = require('./src/routes/messaging');
const adminRoutes = require('./src/routes/admin');
const marketingRoutes = require('./src/routes/marketing');
const campaignRoutes = require('./src/routes/campaigns');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Trop de requêtes, réessaie plus tard' },
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Trop de tentatives' },
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Trop de messages envoyés' },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/reputation', reputationRoutes);
app.use('/api', messageLimiter, messagingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/campaigns', campaignRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MarketAfrik API is running 🚀', version: '1.0.0' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`✅ MarketAfrik API démarré sur http://localhost:${PORT}`);
});