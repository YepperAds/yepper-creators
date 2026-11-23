'use strict';

const { query } = require('../config/db');

const isConfigured = () => Boolean(
  process.env.WHATSAPP_ACCESS_TOKEN &&
  process.env.WHATSAPP_PHONE_NUMBER_ID &&
  process.env.WHATSAPP_REPORT_TEMPLATE_NAME &&
  process.env.WHATSAPP_GRAPH_API_VERSION,
);

function getWeekStart(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start.toISOString().slice(0, 10);
}

function formatReport(name, videos, reportWeek) {
  const totals = videos.reduce((acc, video) => {
    acc.views += Number(video.views) || 0;
    acc.likes += Number(video.likes) || 0;
    acc.comments += Number(video.comments) || 0;
    acc.shares += Number(video.shares) || 0;
    acc.clicks += Number(video.clicks) || 0;
    acc[video.platform] = (acc[video.platform] || 0) + 1;
    return acc;
  }, { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0 });

  const platformCounts = Object.keys(totals)
    .filter((key) => !['views', 'likes', 'comments', 'shares', 'clicks'].includes(key))
    .map((platform) => `${platform}: ${totals[platform]} video${totals[platform] === 1 ? '' : 's'}`)
    .join(' | ');
  const details = videos
    .slice()
    .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
    .map((video) => {
      const title = String(video.title || `${video.platform} video`).replace(/\s+/g, ' ').trim().slice(0, 55);
      const engagement = `${Number(video.views) || 0} views, ${Number(video.likes) || 0} likes, ${Number(video.comments) || 0} comments`;
      return `- ${video.platform}: ${title} (${engagement}${Number(video.shares) ? `, ${Number(video.shares)} shares` : ''}${Number(video.clicks) ? `, ${Number(video.clicks)} clicks` : ''})`;
    });

  const lines = [
    `Week of ${reportWeek} - latest tracked totals (cumulative across ${videos.length} videos):`,
    `${platformCounts}`,
    `All videos: ${totals.views} views, ${totals.likes} likes, ${totals.comments} comments, ${totals.shares} shares, ${totals.clicks} clicks.`,
    'Video-by-video:',
    ...details,
  ];
  const chunks = [];
  let chunk = '';
  for (const line of lines) {
    const next = chunk ? `${chunk}\n${line}` : line;
    if (chunk && next.length > 850) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk = next;
    }
  }
  if (chunk) chunks.push(chunk);
  const messages = chunks.map((text, index) => `Part ${index + 1}/${chunks.length}\n${text}`);

  return {
    greeting: String(name || 'there').trim().split(/\s+/)[0].slice(0, 40) || 'there',
    body: messages.join('\n\n'),
    messages,
  };
}

async function loadReports() {
  const { rows } = await query(
    `WITH eligible AS (
       SELECT id, full_name, whatsapp_phone_number
       FROM creators
       WHERE whatsapp_reports_enabled = TRUE
         AND whatsapp_phone_number IS NOT NULL
     ),
     youtube AS (
       SELECT DISTINCT ON (claim.advertiser_id, post.id)
         claim.advertiser_id,
         'YouTube'::text AS platform,
         post.id::text AS video_id,
         post.title,
         post.views,
         post.likes,
         post.comments,
         0::bigint AS shares,
         0::bigint AS clicks
       FROM youtube_ad_video_claims AS video_claim
       JOIN youtube_ad_claims AS claim ON claim.id = video_claim.claim_id
       JOIN ad_video_posts AS post ON post.id = video_claim.ad_video_post_id
       JOIN eligible ON eligible.id::text = claim.advertiser_id
       WHERE claim.payment_status = 'paid'
         AND claim.status <> 'cancelled'
       ORDER BY claim.advertiser_id, post.id
     ),
     tiktok AS (
       SELECT
         sponsorship.advertiser_id,
         'TikTok'::text AS platform,
         sponsorship.id::text AS video_id,
         COALESCE(sponsorship.brand_name, 'TikTok sponsored post') AS title,
         sponsorship.views,
         sponsorship.likes,
         sponsorship.comments,
         sponsorship.shares,
         sponsorship.clicks
       FROM tiktok_sponsorships AS sponsorship
       JOIN eligible ON eligible.id::text = sponsorship.advertiser_id
       WHERE sponsorship.payment_status = 'paid'
         AND sponsorship.status <> 'cancelled'
         AND (sponsorship.video_url IS NOT NULL OR sponsorship.posted_at IS NOT NULL)
     )
     SELECT
       eligible.id AS advertiser_id,
       eligible.full_name,
       eligible.whatsapp_phone_number,
       reports.platform,
       reports.video_id,
       reports.title,
       COALESCE(reports.views, 0)::bigint AS views,
       COALESCE(reports.likes, 0)::bigint AS likes,
       COALESCE(reports.comments, 0)::bigint AS comments,
       COALESCE(reports.shares, 0)::bigint AS shares,
       COALESCE(reports.clicks, 0)::bigint AS clicks
     FROM eligible
     JOIN (
       SELECT * FROM youtube
       UNION ALL
       SELECT * FROM tiktok
     ) AS reports ON reports.advertiser_id = eligible.id::text
     ORDER BY eligible.id, reports.platform, reports.title`,
  );

  const byAdvertiser = new Map();
  for (const row of rows) {
    const id = String(row.advertiser_id);
    if (!byAdvertiser.has(id)) {
      byAdvertiser.set(id, {
        id,
        name: row.full_name,
        phoneNumber: row.whatsapp_phone_number,
        videos: [],
      });
    }
    byAdvertiser.get(id).videos.push(row);
  }
  return [...byAdvertiser.values()];
}

async function sendTemplateMessage(phoneNumber, greeting, body) {
  const version = process.env.WHATSAPP_GRAPH_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: process.env.WHATSAPP_REPORT_TEMPLATE_NAME,
        language: { code: process.env.WHATSAPP_REPORT_TEMPLATE_LANGUAGE || 'en_US' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: greeting },
            { type: 'text', text: body },
          ],
        }],
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp API returned ${response.status}: ${detail.slice(0, 500)}`);
  }
}

async function sendTestMessage(phoneNumber, name) {
  if (!isConfigured()) {
    throw new Error('WhatsApp sending is not configured. Add the Meta API credentials and approved template on the backend.');
  }
  const greeting = String(name || 'there').trim().split(/\s+/)[0].slice(0, 40) || 'there';
  await sendTemplateMessage(
    phoneNumber,
    greeting,
    'This is a test of Yepper weekly campaign reports. Your WhatsApp number is connected.',
  );
}

async function sendWeeklyReports(now = new Date()) {
  if (!isConfigured()) {
    console.warn('[whatsapp-reports] Weekly reports are disabled: configure the WhatsApp API credentials and approved template.');
    return { sent: 0, skipped: true };
  }

  const reportWeek = getWeekStart(now);
  const advertisers = await loadReports();
  let sent = 0;

  for (const advertiser of advertisers) {
    const reserved = await query(
      `      INSERT INTO whatsapp_report_deliveries (advertiser_id, report_week, status)
       VALUES ($1, $2, 'sending')
       ON CONFLICT (advertiser_id, report_week) DO UPDATE
         SET status = 'sending', attempted_at = NOW(), error_message = NULL
         WHERE whatsapp_report_deliveries.status = 'failed'
            OR (whatsapp_report_deliveries.status = 'sending'
                AND whatsapp_report_deliveries.attempted_at < NOW() - INTERVAL '30 minutes')
       RETURNING advertiser_id, payload, sent_parts`,
      [advertiser.id, reportWeek],
    );
    if (!reserved.rowCount) continue;

    try {
      let payload = reserved.rows[0].payload;
      if (!payload) {
        const report = formatReport(advertiser.name, advertiser.videos, reportWeek);
        payload = { greeting: report.greeting, messages: report.messages };
        await query(
          `UPDATE whatsapp_report_deliveries SET payload = $3::jsonb
           WHERE advertiser_id = $1 AND report_week = $2`,
          [advertiser.id, reportWeek, JSON.stringify(payload)],
        );
      }

      for (let index = Number(reserved.rows[0].sent_parts) || 0; index < payload.messages.length; index += 1) {
        await sendTemplateMessage(advertiser.phoneNumber, payload.greeting, payload.messages[index]);
        await query(
          `UPDATE whatsapp_report_deliveries SET sent_parts = $3
           WHERE advertiser_id = $1 AND report_week = $2`,
          [advertiser.id, reportWeek, index + 1],
        );
      }
      await query(
        `UPDATE whatsapp_report_deliveries
         SET status = 'sent', sent_at = NOW(), error_message = NULL
         WHERE advertiser_id = $1 AND report_week = $2`,
        [advertiser.id, reportWeek],
      );
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown WhatsApp delivery error';
      await query(
        `UPDATE whatsapp_report_deliveries
         SET status = 'failed', error_message = $3
         WHERE advertiser_id = $1 AND report_week = $2`,
        [advertiser.id, reportWeek, message.slice(0, 1000)],
      );
      console.error(`[whatsapp-reports] Delivery failed for advertiser ${advertiser.id}:`, message);
    }
  }

  console.log(`[whatsapp-reports] Weekly run complete: ${sent} report(s) sent.`);
  return { sent, skipped: false };
}

module.exports = { formatReport, getWeekStart, isConfigured, sendTestMessage, sendWeeklyReports };
