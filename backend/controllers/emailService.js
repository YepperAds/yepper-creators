// emailService.js — Resend-backed email helper. Raw SMTP-to-Gmail from a
// PaaS (Render) gets blocked/throttled by Gmail's anti-abuse heuristics on
// cloud-host IP ranges; Resend sends over HTTPS instead, sidestepping that.
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
if (!resend) {
  console.warn('RESEND_API_KEY not configured — email sending disabled (emailService)');
}

const sendEmailNotification = async (to, subject, html) => {
  if (!resend) {
    // Not configured — return a sentinel so callers can decide behaviour
    return { skipped: true, reason: 'EMAIL_DISABLED' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Yepper <noreply@yepper.cc>',
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message || 'Resend API error');
    console.log('Email sent:', data?.id);
    return { skipped: false, info: data };
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
};

module.exports = sendEmailNotification;
