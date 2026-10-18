'use strict';

const { query } = require('../../config/db');

async function requestVideoBatch(videoIds, parts, { accessToken, apiKey } = {}) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', parts);
  url.searchParams.set('id', videoIds.join(','));
  if (apiKey) url.searchParams.set('key', apiKey);

  let response;
  try {
    response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  } catch (err) {
    console.error('[youtubeDataApi] YouTube video lookup request failed:', err?.message);
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    console.error(
      '[youtubeDataApi] YouTube video lookup failed:',
      data?.error?.message || response.statusText || response.status,
    );
    return { items: null, status: response.status };
  }

  return { items: Array.isArray(data?.items) ? data.items : [], status: response.status };
}

async function requestVideos(videoIds, parts, credentials) {
  const items = [];
  for (let index = 0; index < videoIds.length; index += 50) {
    const result = await requestVideoBatch(videoIds.slice(index, index + 50), parts, credentials);
    if (!result?.items) return result;
    items.push(...result.items);
  }
  return { items, status: 200 };
}

async function refreshAccessToken(creatorId, refreshToken) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;

  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
  } catch (err) {
    console.error('[youtubeDataApi] YouTube token refresh request failed:', err?.message);
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    console.error('[youtubeDataApi] YouTube token refresh failed:', data?.error_description || data?.error || response.status);
    return null;
  }

  await query(
    `UPDATE social_connections SET access_token=$1 WHERE creator_id=$2 AND provider='youtube'`,
    [data.access_token, creatorId],
  );
  return data.access_token;
}

async function fetchYoutubeVideos(videoIds, creatorId, parts = 'snippet,statistics') {
  const ids = [...new Set((videoIds || []).filter((id) => typeof id === 'string' && id.trim()))];
  if (!ids.length) return [];

  let connection = null;
  if (creatorId) {
    const connectionResult = await query(
      `SELECT access_token, refresh_token
       FROM social_connections
       WHERE creator_id=$1 AND provider='youtube'
       LIMIT 1`,
      [creatorId],
    );
    connection = connectionResult.rows[0] || null;
  }

  let oauthResult = null;
  if (connection?.access_token) {
    oauthResult = await requestVideos(ids, parts, { accessToken: connection.access_token });
    if (oauthResult?.status === 401) {
      const refreshedToken = await refreshAccessToken(creatorId, connection.refresh_token);
      if (refreshedToken) {
        oauthResult = await requestVideos(ids, parts, { accessToken: refreshedToken });
      }
    }
    if (oauthResult?.items?.length) return oauthResult.items;
  }

  if (process.env.YOUTUBE_API_KEY) {
    const apiKeyResult = await requestVideos(ids, parts, { apiKey: process.env.YOUTUBE_API_KEY });
    if (apiKeyResult?.items) return apiKeyResult.items;
  }

  return oauthResult?.items ?? null;
}

async function fetchLatestYoutubeVideo(creatorId) {
  const connectionResult = await query(
    `SELECT access_token, refresh_token, profile_url
     FROM social_connections WHERE creator_id = $1 AND provider = 'youtube' LIMIT 1`,
    [creatorId],
  );
  const connection = connectionResult.rows[0];
  const channelId = connection?.profile_url?.match(/youtube\.com\/channel\/([^/?]+)/)?.[1];
  let token = connection?.access_token || null;

  const requestChannel = async () => {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'contentDetails');
    if (token) url.searchParams.set('mine', 'true');
    else if (channelId) url.searchParams.set('id', channelId);
    else return null;
    if (!token && process.env.YOUTUBE_API_KEY) url.searchParams.set('key', process.env.YOUTUBE_API_KEY);
    if (!token && !process.env.YOUTUBE_API_KEY) return null;
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  };

  let channelResult = await requestChannel();
  if (channelResult?.response.status === 401 && connection?.refresh_token) {
    token = await refreshAccessToken(creatorId, connection.refresh_token);
    if (token) channelResult = await requestChannel();
  }
  const uploadsPlaylistId = channelResult?.payload?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!channelResult?.response.ok || !uploadsPlaylistId) return null;

  const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  playlistUrl.searchParams.set('part', 'contentDetails');
  playlistUrl.searchParams.set('playlistId', uploadsPlaylistId);
  playlistUrl.searchParams.set('maxResults', '1');
  if (!token && process.env.YOUTUBE_API_KEY) playlistUrl.searchParams.set('key', process.env.YOUTUBE_API_KEY);
  const playlistResponse = await fetch(playlistUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const playlistData = await playlistResponse.json().catch(() => null);
  const videoId = playlistData?.items?.[0]?.contentDetails?.videoId;
  if (!playlistResponse.ok || !videoId) return null;

  const video = (await fetchYoutubeVideos([videoId], creatorId, 'snippet,statistics'))?.[0];
  if (!video) return null;
  return {
    title: video.snippet?.title || '',
    views: Number(video.statistics?.viewCount || 0),
    likes: Number(video.statistics?.likeCount || 0),
    published_at: video.snippet?.publishedAt || null,
    thumbnail: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || null,
    url: `https://www.youtube.com/watch?v=${video.id}`,
  };
}

module.exports = { fetchYoutubeVideos, fetchLatestYoutubeVideo };
