'use strict';

const { query } = require('../../config/db');

const PARTNER_CHANNELS = [
  { id: 'partner-youtube-1', name: 'Rocky Entertainment', subscribers: 1_610_000 },
  { id: 'partner-youtube-2', name: 'Chita magic', subscribers: 848_000 },
  { id: 'partner-youtube-3', name: 'MIE Empire', subscribers: 1_060_000 },
  { id: 'partner-youtube-4', name: 'Ines', subscribers: 1_120 },
  { id: 'partner-youtube-5', name: 'Quick Homes Rwanda', subscribers: 22_700 },
  { id: 'partner-youtube-6', name: 'IGIHE', subscribers: 868_000 },
  { id: 'partner-youtube-7', name: 'Rwanda updates', subscribers: 822_000 },
  { id: 'partner-youtube-8', name: 'THE QUICKTIMES NEWS', subscribers: 333_000 },
  { id: 'partner-youtube-9', name: 'cheymuv', subscribers: 131_000 },
  { id: 'partner-youtube-10', name: 'Benitha & Kelly', subscribers: 2_860 },
];

const PACKAGE_CODES = new Set(['corner_ad', 'daily_30_days', 'five_monthly']);
const PACKAGE_PRICES_BY_TIER = {
  test: { corner_ad: 10_000, daily_30_days: 61_830, five_monthly: 150_000 },
  nano: { corner_ad: 200_000, daily_30_days: 51_510, five_monthly: 150_000 },
  micro: { corner_ad: 200_000, daily_30_days: 82_410, five_monthly: 150_000 },
  mid: { corner_ad: 200_000, daily_30_days: 154_560, five_monthly: 150_000 },
  macro: { corner_ad: 200_000, daily_30_days: 236_970, five_monthly: 150_000 },
  mega: { corner_ad: 1_000_000, daily_30_days: 330_000, five_monthly: 400_000 },
};

const PARTNER_CHANNEL_VALUES = PARTNER_CHANNELS
  .map(({ id, name }) => `('${id}', '${name.replace(/'/g, "''")}')`)
  .join(', ');

function getChannelTier(subscribers) {
  if (subscribers < 1_000) return 'test';
  if (subscribers < 5_000) return 'nano';
  if (subscribers < 20_000) return 'micro';
  if (subscribers < 50_000) return 'mid';
  if (subscribers < 150_000) return 'macro';
  return 'mega';
}

exports.createInterest = async (req, res) => {
  const advertiserId = String(req.user?.userId || '');
  const { channelId, packageCode } = req.body || {};
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Login required' });
  if (typeof channelId !== 'string') {
    return res.status(400).json({ success: false, message: 'Select a YouTube channel' });
  }
  if (typeof packageCode !== 'string' || !PACKAGE_CODES.has(packageCode)) {
    return res.status(400).json({ success: false, message: 'Select a valid advertising package' });
  }

  const channel = PARTNER_CHANNELS.find((item) => item.id === channelId);
  if (!channel) {
    return res.status(400).json({ success: false, message: 'Selected channel is invalid' });
  }

  const tier = getChannelTier(channel.subscribers);
  const packagePrice = PACKAGE_PRICES_BY_TIER[tier][packageCode];
  try {
    await query(
      `WITH request_group AS (SELECT gen_random_uuid() AS id)
       INSERT INTO youtube_channel_requests
         (channel_id, channel_name, advertiser_id, request_group_id, package_code, package_price_rwf)
       SELECT channel.channel_id, channel.channel_name, $2, request_group.id, $3, $4
       FROM request_group
       JOIN (VALUES ${PARTNER_CHANNEL_VALUES}) AS channel(channel_id, channel_name) ON channel.channel_id = $1
       WHERE TRUE
       ON CONFLICT (channel_id, advertiser_id) DO UPDATE
         SET request_group_id = EXCLUDED.request_group_id,
             package_code = EXCLUDED.package_code,
             package_price_rwf = EXCLUDED.package_price_rwf,
             updated_at = NOW()`,
      [channelId, advertiserId, packageCode, packagePrice]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error recording YouTube channel request:', error);
    res.status(500).json({ success: false, message: 'Failed to record channel interest' });
  }
};

exports.listInterests = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT request.request_group_id AS id,
              STRING_AGG(request.channel_name, ', ' ORDER BY request.channel_name) AS channel_names,
              request.package_code, MAX(request.package_price_rwf) AS package_price_rwf,
              MIN(request.created_at) AS created_at, MAX(request.updated_at) AS updated_at,
              request.advertiser_id, advertiser.name AS full_name, advertiser.email
       FROM youtube_channel_requests request
       LEFT JOIN users advertiser ON advertiser.id = request.advertiser_id
       GROUP BY request.request_group_id, request.package_code, request.advertiser_id, advertiser.name, advertiser.email
       ORDER BY MAX(request.updated_at) DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listing YouTube channel requests:', error);
    res.status(500).json({ success: false, message: 'Failed to list channel interests' });
  }
};
