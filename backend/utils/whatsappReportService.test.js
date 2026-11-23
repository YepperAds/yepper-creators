'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatReport, getWeekStart } = require('./whatsappReportService');

test('weekly report includes aggregate video engagement and platform details', () => {
  const report = formatReport('Ada Lovelace', [
    { platform: 'YouTube', title: 'Launch video', views: 120, likes: 8, comments: 3, clicks: 0 },
    { platform: 'TikTok', title: 'Short ad', views: 40, likes: 5, comments: 2, shares: 4, clicks: 11 },
  ], '2026-11-23');

  assert.equal(report.greeting, 'Ada');
  assert.match(report.body, /YouTube: 1 video/);
  assert.match(report.body, /TikTok: 1 video/);
  assert.match(report.body, /160 views, 13 likes, 5 comments, 4 shares, 11 clicks/);
  assert.match(report.body, /Launch video \(120 views, 8 likes, 3 comments\)/);
});

test('weekly report week starts on Monday in UTC', () => {
  assert.equal(getWeekStart(new Date('2026-11-23T09:00:00.000Z')), '2026-11-23');
  assert.equal(getWeekStart(new Date('2026-11-29T23:59:00.000Z')), '2026-11-23');
  assert.equal(getWeekStart(new Date('2026-11-30T00:00:00.000Z')), '2026-11-30');
});

test('long reports include every video across template-sized messages', () => {
  const videos = Array.from({ length: 14 }, (_, index) => ({
    platform: 'YouTube',
    title: `Campaign video ${index + 1}`,
    views: 100 + index,
    likes: 10,
    comments: 2,
    shares: 0,
    clicks: 0,
  }));
  const report = formatReport('Ada', videos, '2026-11-23');

  assert.ok(report.messages.length > 1);
  assert.ok(report.messages.every((message) => message.length <= 900));
  videos.forEach((video) => assert.ok(report.body.includes(video.title)));
});
