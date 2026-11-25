'use strict';

const { query } = require('../../config/db');
const { calculateSocialCampaignPrice } = require('../utils/socialCampaignPricing');

exports.quote = async (req, res) => {
  const selections = req.body?.items;
  if (!Array.isArray(selections) || selections.length === 0 || selections.length > 100) {
    return res.status(400).json({ success: false, message: 'Provide between 1 and 100 campaign package selections' });
  }

  const normalized = [];
  for (const selection of selections) {
    const creatorId = Number(selection?.creatorId);
    if (!Number.isSafeInteger(creatorId) || creatorId <= 0) {
      return res.status(400).json({ success: false, message: 'Each package selection needs a valid creator' });
    }
    if (!['youtube', 'tiktok'].includes(selection?.platform)) {
      return res.status(400).json({ success: false, message: 'Each package selection needs a valid platform' });
    }
    normalized.push({
      creatorId: String(creatorId),
      platform: selection.platform,
      packageCode: selection.packageCode,
      commitmentMonths: selection.commitmentMonths === undefined ? 1 : Number(selection.commitmentMonths),
    });
  }

  try {
    const creatorIds = [...new Set(normalized.map((selection) => Number(selection.creatorId)))];
    const providers = [...new Set(normalized.map((selection) => selection.platform))];
    const connections = await query(
      `SELECT creator_id::text AS creator_id, provider, followers_count
       FROM social_connections
       WHERE creator_id = ANY($1::int[]) AND provider = ANY($2::text[])`,
      [creatorIds, providers],
    );
    const audienceByCreatorPlatform = new Map(
      connections.rows.map((connection) => [
        `${connection.creator_id}:${connection.provider}`,
        Number(connection.followers_count || 0),
      ]),
    );

    const items = normalized.map((selection) => {
      const key = `${selection.creatorId}:${selection.platform}`;
      if (!audienceByCreatorPlatform.has(key)) {
        const error = new Error(`Creator ${selection.creatorId} is not connected to ${selection.platform}`);
        error.status = 404;
        throw error;
      }
      return {
        ...selection,
        audienceCount: audienceByCreatorPlatform.get(key),
      };
    });
    const pricing = calculateSocialCampaignPrice(items);
    return res.json({
      success: true,
      data: {
        bundled: pricing.bundled,
        bundleDiscountRate: pricing.bundleDiscountRate,
        platforms: Object.fromEntries(
          Object.entries(pricing.platforms).map(([platform, totals]) => [platform, {
            listSubtotal: totals.listSubtotal,
            commitmentDiscount: totals.commitmentDiscount,
            bundleDiscount: totals.bundleDiscount,
            total: totals.total,
          }]),
        ),
        items: pricing.items.map((item, index) => ({
          creatorId: normalized[index].creatorId,
          platform: item.platform,
          tier: item.tier,
          packageCode: item.packageCode,
          commitmentMonths: item.commitmentMonths,
          baseMonthlyPrice: item.baseMonthlyPrice,
          commitmentDiscountAmount: item.commitmentDiscountAmount,
          bundleDiscountAmount: item.bundleDiscountAmount,
          monthlyPrice: item.monthlyPrice,
          totalPrice: item.totalPrice,
        })),
        total: pricing.total,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error instanceof TypeError) return res.status(400).json({ success: false, message: error.message });
    console.error('[socialCampaignPricing] quote error:', error);
    return res.status(500).json({ success: false, message: 'Could not calculate campaign pricing' });
  }
};
