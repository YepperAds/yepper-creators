// emailService.js — Nodemailer-backed email helper
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('Email transporter configured (SMTP).');
  } catch (e) {
    console.warn('Failed to configure SMTP transporter:', e?.message || e);
    transporter = null;
  }
} else {
  console.warn('SMTP not configured — email sending disabled (emailService)');
}

const sendEmailNotification = async (to, subject, html) => {
  if (!transporter) {
    // Not configured — return a sentinel so callers can decide behaviour
    return { skipped: true, reason: 'EMAIL_DISABLED' };
  }

  const mailOptions = {
    from: process.env.FROM_EMAIL || 'Yepper <noreply@yepper.cc>',
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId || info);
    return { skipped: false, info };
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
};

module.exports = sendEmailNotification;
