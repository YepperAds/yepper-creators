// AdPromoter/utils/withdrawalCooldown.js
const { query } = require('../../config/db');

const WITHDRAWAL_COOLDOWN_DAYS = 14;
const EARNINGS_HOLD_DAYS = 14;

// Cancelled/rejected requests don't count — they never actually withdrew funds.
// This only rate-limits how often a withdrawal *request* can be made; it says
// nothing about whether any given earning has actually aged long enough to be
// withdrawable — see getEarningsHold for that.
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

// Each earning (a wallet_transactions row with type='credit') only becomes
// withdrawable EARNINGS_HOLD_DAYS after it was credited — the "14 days after
// getting paid" hold. Debits (withdrawals already taken, refunds) are drawn
// against the matured pool first since they can only ever happen after funds
// were available. Walked oldest-to-newest so `availableAt` is the moment the
// *next* dollar becomes withdrawable, once the currently-matured pool is 0.
async function getEarningsHold(walletId) {
  const { rows } = await query(
    `SELECT type, amount, created_at FROM wallet_transactions
     WHERE wallet_id = $1 AND status = 'completed' AND type IN ('credit', 'debit')
     ORDER BY created_at ASC`,
    [walletId]
  );

  const cutoff = Date.now() - EARNINGS_HOLD_DAYS * 24 * 60 * 60 * 1000;
  let maturedBalance = 0;
  let earliestUnmaturedAt = null;

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    if (row.type === 'debit') {
      maturedBalance += amount; // stored negative
      continue;
    }
    const createdAtMs = new Date(row.created_at).getTime();
    if (createdAtMs <= cutoff) {
      maturedBalance += amount;
    } else if (earliestUnmaturedAt === null) {
      earliestUnmaturedAt = createdAtMs;
    }
  }

  maturedBalance = Math.max(0, maturedBalance);
  const availableAt = maturedBalance <= 0 && earliestUnmaturedAt !== null
    ? new Date(earliestUnmaturedAt + EARNINGS_HOLD_DAYS * 24 * 60 * 60 * 1000)
    : null;

  return { maturedBalance, availableAt };
}

module.exports = { WITHDRAWAL_COOLDOWN_DAYS, EARNINGS_HOLD_DAYS, getWithdrawalCooldown, getEarningsHold };
