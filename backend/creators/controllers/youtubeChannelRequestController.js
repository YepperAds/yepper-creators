'use strict';

const { query } = require('../../config/db');

const PARTNER_CHANNELS = [
  ['partner-youtube-1', 'Rocky Entertainment'],
  ['partner-youtube-2', 'Chita magic'],
  ['partner-youtube-3', 'MIE Empire'],
  ['partner-youtube-4', 'Ines'],
  ['partner-youtube-5', 'Quick Homes Rwanda'],
  ['partner-youtube-6', 'IGIHE'],
  ['partner-youtube-7', 'Rwanda updates'],
  ['partner-youtube-8', 'THE QUICKTIMES NEWS'],
  ['partner-youtube-9', 'cheymuv'],
  ['partner-youtube-10', 'Benitha & Kelly'],
];

const PACKAGE_PRICES = {
  social_video: 1_000_000,
  weekly: 500_000,
  thirty_days: 330_000,
};

const PARTNER_CHANNEL_VALUES = PARTNER_CHANNELS
  .map(([id, name]) => `('${id}', '${name.replace(/'/g, "''")}')`)
  .join(', ');

exports.createInterest = async (req, res) => {
  const advertiserId = String(req.user?.userId || '');
  const { channelId, packageCode } = req.body || {};
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Login required' });
  if (typeof channelId !== 'string') {
    return res.status(400).json({ success: false, message: 'Select a YouTube channel' });
  }
  if (typeof packageCode !== 'string' || !Object.hasOwn(PACKAGE_PRICES, packageCode)) {
    return res.status(400).json({ success: false, message: 'Select a valid advertising package' });
  }

  const allowedIds = new Set(PARTNER_CHANNELS.map(([id]) => id));
  if (!allowedIds.has(channelId)) {
    return res.status(400).json({ success: false, message: 'Selected channel is invalid' });
  }

  const packagePrice = PACKAGE_PRICES[packageCode];
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
