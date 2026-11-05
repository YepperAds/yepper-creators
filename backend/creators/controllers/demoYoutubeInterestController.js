'use strict';

const { query } = require('../../config/db');

const DEMO_CHANNELS = [
  ['demo-youtube-1', 'Rocky Entertainment'],
  ['demo-youtube-2', 'Chita magic'],
  ['demo-youtube-3', 'MIE Empire'],
  ['demo-youtube-4', 'Ines'],
  ['demo-youtube-5', 'Quick Homes Rwanda'],
  ['demo-youtube-6', 'IGIHE'],
  ['demo-youtube-7', 'Rwanda updates'],
  ['demo-youtube-8', 'THE QUICKTIMES NEWS'],
  ['demo-youtube-9', 'cheymuv'],
  ['demo-youtube-10', 'Benitha & Kelly'],
];

const DEMO_CHANNEL_VALUES = DEMO_CHANNELS
  .map(([id, name]) => `('${id}', '${name.replace(/'/g, "''")}')`)
  .join(', ');

exports.createInterest = async (req, res) => {
  const advertiserId = String(req.user?.userId || '');
  const { channelIds } = req.body || {};
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Login required' });
  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Select at least one YouTube channel' });
  }
  if (channelIds.length > DEMO_CHANNELS.length) {
    return res.status(400).json({ success: false, message: 'You can select up to 10 YouTube channels' });
  }

  const selectedIds = [...new Set(channelIds)];
  const allowedIds = new Set(DEMO_CHANNELS.map(([id]) => id));
  if (selectedIds.some((id) => typeof id !== 'string' || !allowedIds.has(id))) {
    return res.status(400).json({ success: false, message: 'One or more selected channels are invalid' });
  }

  try {
    await query(
      `INSERT INTO demo_youtube_interests (channel_id, channel_name, advertiser_id)
       SELECT channel.channel_id, channel.channel_name, $2
       FROM unnest($1::text[]) AS selected(channel_id)
       JOIN (VALUES ${DEMO_CHANNEL_VALUES}) AS channel(channel_id, channel_name)
         USING (channel_id)
       ON CONFLICT (channel_id, advertiser_id) DO NOTHING`,
      [selectedIds, advertiserId]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error recording demo YouTube channel interest:', error);
    res.status(500).json({ success: false, message: 'Failed to record channel interest' });
  }
};

exports.listInterests = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT interest.id, interest.channel_id, interest.channel_name,
              interest.created_at, interest.advertiser_id,
              advertiser.name AS full_name, advertiser.email
       FROM demo_youtube_interests interest
       LEFT JOIN users advertiser ON advertiser.id = interest.advertiser_id
       ORDER BY interest.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listing demo YouTube channel interests:', error);
    res.status(500).json({ success: false, message: 'Failed to list channel interests' });
  }
};
