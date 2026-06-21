const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendVerificationEmail = async (email, name, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: '✅ Confirmez votre compte MarketAfrik',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a7a4a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">MarketAfrik</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Bonjour ${name} 👋</h2>
          <p>Merci de vous être inscrit sur MarketAfrik. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background: #1a7a4a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
              Confirmer mon compte
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
        </div>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: '🔐 Réinitialisation de votre mot de passe MarketAfrik',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a7a4a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">MarketAfrik</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Bonjour ${name} 👋</h2>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background: #e05c00; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        </div>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };