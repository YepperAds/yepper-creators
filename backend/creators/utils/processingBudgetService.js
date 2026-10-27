'use strict';

const { getClient, query } = require('../../config/db');
const {
  calculateCampaignBudget,
  getProcessingBudgetConfig,
  requireProcessingCostConfig,
} = require('./processingBudget');

function getFlutterwaveFeeSql(alias) {
  return `COALESCE(
    NULLIF(${alias}.flutterwave_fee, 0),
    CASE
      WHEN ${alias}.flutterwave_data->>'app_fee' ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN (${alias}.flutterwave_data->>'app_fee')::numeric
      WHEN ${alias}.flutterwave_data->>'fee' ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN (${alias}.flutterwave_data->>'fee')::numeric
      ELSE 0
    END,
    0
  )`;
}

async function getCampaignProcessingBudget(db, campaignId) {
  const feeSql = getFlutterwaveFeeSql('payment');
  const [paymentResult, spendResult] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(GREATEST(0, payment.amount - ${feeSql})), 0) AS confirmed_net_payments
       FROM ad_campaigns AS campaign
       JOIN payments AS payment
         ON (payment.tx_ref = campaign.tx_ref
             OR payment.metadata->>'campaignId' = campaign.id::text)
       WHERE campaign.id = $1
         AND campaign.payment_status = 'paid'
         AND payment.status = 'successful'
         AND payment.metadata->>'kind' = 'youtube_campaign'`,
      [campaignId],
    ),
    db.query(
      `SELECT COALESCE(SUM(
          CASE
            WHEN status = 'reserved' THEN estimated_cost_rwf
            WHEN status = 'completed' THEN COALESCE(actual_cost_rwf, estimated_cost_rwf)
            ELSE 0
          END
        ), 0) AS spent
       FROM ad_video_processing_costs
       WHERE campaign_id = $1`,
      [campaignId],
    ),
  ]);
  const config = getProcessingBudgetConfig();
  return calculateCampaignBudget({
    confirmedNetPayments: Number(paymentResult.rows[0]?.confirmed_net_payments || 0),
    spent: Number(spendResult.rows[0]?.spent || 0),
    estimatedCost: 0,
    config,
  });
}

async function reserveCampaignProcessingBudget({ jobId, creatorId, claims, estimatedCost }) {
  const config = requireProcessingCostConfig();
  const campaignClaims = new Map();
  for (const claim of claims) {
    if (!claim.campaignId) {
      const error = new Error('Long videos require a paid campaign with a processing budget. Keep the video for manual ad insertion.');
      error.code = 'PROCESSING_BUDGET_UNAVAILABLE';
      error.budgetDetails = [];
      throw error;
    }
    campaignClaims.set(claim.campaignId, (campaignClaims.get(claim.campaignId) || 0) + 1);
  }

  const campaignIds = [...campaignClaims.keys()].sort((a, b) => Number(a) - Number(b));
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const campaignResult = await client.query(
      `SELECT id, payment_status FROM ad_campaigns
       WHERE id = ANY($1::int[]) AND creator_id = $2
       ORDER BY id FOR UPDATE`,
      [campaignIds, creatorId],
    );
    if (campaignResult.rowCount !== campaignIds.length
      || campaignResult.rows.some((campaign) => campaign.payment_status !== 'paid')) {
      const error = new Error('A selected campaign has no confirmed payment. Keep the video for manual ad insertion.');
      error.code = 'PROCESSING_BUDGET_UNAVAILABLE';
      error.budgetDetails = [];
      throw error;
    }

    const totalClaimCount = claims.length;
    let remainingAllocation = estimatedCost;
    const budgetDetails = [];
    for (let index = 0; index < campaignIds.length; index += 1) {
      const campaignId = campaignIds[index];
      const allocatedCost = index === campaignIds.length - 1
        ? remainingAllocation
        : Math.floor(estimatedCost * campaignClaims.get(campaignId) / totalClaimCount);
      remainingAllocation -= allocatedCost;
      const budget = await getCampaignProcessingBudget(client, campaignId);
      const allocationBudget = calculateCampaignBudget({
        ...budget,
        estimatedCost: allocatedCost,
        config: {
          ...config,
          commissionRate: config.commissionRate,
          budgetPercentOfCommission: config.budgetPercentOfCommission,
        },
      });
      budgetDetails.push({ campaignId, ...allocationBudget });
    }

    const insufficient = budgetDetails.find((budget) => !budget.enough);
    if (insufficient) {
      const error = new Error(
        `Processing budget is insufficient for this campaign. Remaining: ${Math.floor(insufficient.remaining)} RWF; estimated cost: ${Math.ceil(insufficient.estimatedCost)} RWF. The video was not uploaded; you can insert the ad manually.`,
      );
      error.code = 'PROCESSING_BUDGET_INSUFFICIENT';
      error.budgetDetails = budgetDetails;
      throw error;
    }

    for (const budget of budgetDetails) {
      await client.query(
        `INSERT INTO ad_video_processing_costs
           (job_id, campaign_id, estimated_cost_rwf, status)
         VALUES ($1, $2, $3, 'reserved')`,
        [jobId, budget.campaignId, budget.estimatedCost],
      );
    }
    await client.query('COMMIT');
    return budgetDetails;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function releaseCampaignProcessingBudget(jobId) {
  await query(
    `UPDATE ad_video_processing_costs
     SET status = 'released', updated_at = NOW()
     WHERE job_id = $1 AND status = 'reserved'`,
    [jobId],
  );
}

async function settleCampaignProcessingBudget(jobId, { actualCostRatio = 1 } = {}) {
  const boundedRatio = Math.max(0, Math.min(1, Number(actualCostRatio) || 0));
  await query(
    `UPDATE ad_video_processing_costs
     SET actual_cost_rwf = LEAST(estimated_cost_rwf, CEIL(estimated_cost_rwf * $2)),
         status = 'completed',
         updated_at = NOW()
     WHERE job_id = $1 AND status = 'reserved'`,
    [jobId, boundedRatio],
  );
}

module.exports = {
  getCampaignProcessingBudget,
  releaseCampaignProcessingBudget,
  reserveCampaignProcessingBudget,
  settleCampaignProcessingBudget,
};
