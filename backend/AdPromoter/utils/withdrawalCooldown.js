// AdPromoter/utils/withdrawalCooldown.js
const { query } = require('../../config/db');

const WITHDRAWAL_COOLDOWN_DAYS = 14;

// Cancelled/rejected requests don't count — they never actually withdrew funds.
async function getWithdrawalCooldown(walletId) {
  const { rows } = await query(
    `SELECT created_at FROM withdrawal_requests
     WHERE wallet_id = $1 AND status NOT IN ('cancelled', 'rejected')
     ORDER BY created_at DESC LIMIT 1`,
    [walletId]
  );

  if (!rows[0]) return { canWithdraw: true, nextWithdrawalAt: null };

  const nextWithdrawalAt = new Date(
    new Date(rows[0].created_at).getTime() + WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
  const canWithdraw = Date.now() >= nextWithdrawalAt.getTime();

  return { canWithdraw, nextWithdrawalAt: canWithdraw ? null : nextWithdrawalAt };
}

module.exports = { WITHDRAWAL_COOLDOWN_DAYS, getWithdrawalCooldown };
