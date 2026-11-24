'use strict';

const { getClient } = require('../config/db');

const MOCK_CHANNELS = [
  {
    id: 'partner-youtube-1',
    name: 'Rocky Entertainment',
    avatar: 'https://yt3.googleusercontent.com/IAszSeN436Bi60JUU92N0Wy3AiITa3fP0_0a9PiLuwWg-VNMo0IZtSBVy9pWHSibDNq_PZb17Q=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_610_000,
    videoId: '4r-YI5zzQ00',
  },
  {
    id: 'partner-youtube-2',
    name: 'Chita magic',
    avatar: 'https://yt3.googleusercontent.com/WIdnM4yqNE7K9XMKxZi2-9sEBLxASpQENoW3k8fOsUgHn7IB0_WwoMvsbfPSl07mwiMHwz_KaA=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 848_000,
    videoId: 'kRbscHPx21U',
  },
  {
    id: 'partner-youtube-4',
    name: 'Ines',
    avatar: 'https://yt3.googleusercontent.com/tpWgyhOpKBxRjHlOl503eP-7_0iZ4s8QtiK2cs8S8kK5uDD4mTahrKP1mT7NObnBwBGTFfDmdXs=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_120,
    videoId: '7DfcxJNI4OM',
  },
  {
    id: 'partner-youtube-5',
    name: 'Quick Homes Rwanda',
    avatar: 'https://yt3.googleusercontent.com/0B_2ZpyWKLSubE46Q5QBD3JSzGiRHgSORPqLa1qGM7AczVQ5Fc8LfvtJq5j-oAjFX1yMId8maZw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 22_700,
    videoId: 'ykukG1pQNI0',
  },
  {
    id: 'partner-youtube-7',
    name: 'Rwanda updates',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_mNjM-2kgtYT3BniAkfng0k1eCpZuZ3TN-RfuPK31nsOXo=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 822_000,
    videoId: 'DfdGvujDpzc',
  },
  {
    id: 'partner-youtube-8',
    name: 'THE QUICKTIMES NEWS',
    avatar: 'https://yt3.googleusercontent.com/AP8GKnzGXfrlMxB_BDGZSaFE3_PPb2TC927tITJtaK-5Qn0OdIJeWUQYtv1wpx1bkdgm5TD1xw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 333_000,
    videoId: 'Iq69IX5G52g',
  },
  {
    id: 'partner-youtube-9',
    name: 'cheymuv',
    avatar: 'https://yt3.googleusercontent.com/nX_QmvccL9jpcXxqeJE0uEoSnZoMDHoHw-I7Bg4m6C3GP9p9tWMVtKRxtDwbU_hd4AldHutU-Q=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 131_000,
    videoId: 'lLiU9HDEwEY',
  },
  {
    id: 'partner-youtube-10',
    name: 'Benitha & Kelly',
    avatar: 'https://yt3.googleusercontent.com/LX0--E7RqyUKBzT4k3WJGs1L3h99HTWKO3arzAReEgqqIBk885XjgEDF2zGFlqK6r8_3joBIVg=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 2_860,
    videoId: 'WzcIXpcNVKY',
  },
  {
    id: 'partner-youtube-darina-kayumba',
    name: 'Darina Kayumba',
    avatar: 'https://yt3.googleusercontent.com/HZ9iB996-X1S4Ff_zctHO2K5ZPmgboUZvc2wVJZRHXVP7s3dl0moy8JdSaFSrzDhGXKJ5GYw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 50_600,
    videoId: 'vGh1i_1Fb1I',
  },
  {
    id: 'partner-youtube-the-new-times-rwanda',
    name: 'The New Times Rwanda',
    avatar: 'https://yt3.googleusercontent.com/33dN6_xF6f8Q6_a_RelTOKAomfvEcXP70iCfuOE54HLv0Kt59tP6PyRSrmEmiyExHU2qQIdv=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 176_000,
    videoId: 'ED6lAZfrN1o',
  },
  {
    id: 'partner-youtube-kigali-today',
    name: 'Kigali Today',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lTjQJCTI2odV4R__tFwUpGEAoPDesGoz16YSOG9pvKOT8=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_200_000,
    videoId: 'i_SLLoQhtd4',
  },
  {
    id: 'partner-youtube-b-b-kigali-89-7fm',
    name: 'B&B Kigali 89.7FM',
    avatar: 'https://yt3.googleusercontent.com/vgkVbbIY6GdH18OS5Nc6HKzkhHeraadHdqbzRF1642ByAokFxHSTcS0IyWZhVous7okk3gGP5u0=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 773_000,
    videoId: 'oiOYAWkrQQM',
  },
  {
    id: 'partner-youtube-tv1-rwanda',
    name: 'TV1 Rwanda',
    avatar: 'https://yt3.googleusercontent.com/zSAlAYsqNs-8TQixdXE28xJZZ2r8FhbGsW11cCjJX2yhnZSvaOWjDCvi1_EMVQ40n2ERu9OVoQ=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 736_000,
    videoId: 'k59FGHg_7sQ',
  },
  {
    id: 'partner-youtube-102-3-kiss-fm',
    name: '102.3 KISS FM',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_ka7nhlPSSSEBt76l2G9uH3PXVL3L9ioh9ynf_J1FdXn00=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 164_000,
    videoId: 'SvfmABD8QM8',
  },
];

async function up() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS deleted_mock_youtube_channels (
         google_id TEXT PRIMARY KEY,
         deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );

    for (const channel of MOCK_CHANNELS) {
      const googleId = `mock-youtube:${channel.id}`;
      const deleted = await client.query(
        `SELECT 1 FROM deleted_mock_youtube_channels WHERE google_id = $1`,
        [googleId],
      );
      if (deleted.rowCount) continue;

      const email = `${channel.id}@mock.yepper.invalid`;
      const username = `mock_${channel.id.replace(/[^a-z0-9]+/gi, '_')}`;
      const creatorRes = await client.query(
        `INSERT INTO creators (google_id, email, full_name, avatar, username, is_mock)
         VALUES ($1,$2,$3,$4,$5,TRUE)
         ON CONFLICT (google_id) DO UPDATE SET
           full_name=EXCLUDED.full_name, avatar=EXCLUDED.avatar, is_mock=TRUE, updated_at=NOW()
         RETURNING id`,
        [googleId, email, channel.name, channel.avatar, username],
      );
      const creatorId = creatorRes.rows[0].id;
      const videoUrl = `https://www.youtube.com/watch?v=${channel.videoId}`;
      await client.query(
        `INSERT INTO social_connections
           (creator_id, provider, username, followers_count, avatar_url, total_views, total_posts, last_public_video_refresh_at)
         VALUES ($1,'youtube',$2,$3,$4,0,0,NOW())
         ON CONFLICT (creator_id, provider) DO UPDATE SET
           username=EXCLUDED.username, followers_count=EXCLUDED.followers_count,
           avatar_url=EXCLUDED.avatar_url, last_public_video_refresh_at=NOW()`,
        [creatorId, channel.name, channel.subscribers, channel.avatar],
      );
      await client.query(
        `INSERT INTO social_video_stats (creator_id, provider, title, thumbnail_url, video_url)
         VALUES ($1,'youtube','Featured video',$2,$3)
         ON CONFLICT (creator_id, provider, video_url) WHERE video_url IS NOT NULL DO UPDATE SET
           thumbnail_url=EXCLUDED.thumbnail_url, fetched_at=NOW()`,
        [creatorId, `https://img.youtube.com/vi/${channel.videoId}/hqdefault.jpg`, videoUrl],
      );
    }

    await client.query('COMMIT');
    console.log(`Mock YouTube channels ready (${MOCK_CHANNELS.length} seeded).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((error) => {
    console.error('Mock YouTube channel migration failed:', error);
    process.exit(1);
  });
}

module.exports = { up };
