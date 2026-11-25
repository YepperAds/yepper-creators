'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatReport, getWeekStart, isConfigured } = require('./whatsappReportService');

test('weekly report includes platform summaries, analytics link, and support contacts in one message', () => {
  const report = formatReport('Ada Lovelace', [
    { platform: 'YouTube', title: 'Launch video', views: 120, likes: 8, comments: 3, clicks: 0 },
    { platform: 'TikTok', title: 'Short ad', views: 40, likes: 5, comments: 2, shares: 4, clicks: 11 },
  ], '2026-11-23');

  assert.equal(report.greeting, 'Ada');
  assert.match(report.body, /YouTube \(1 video\): 120 views, 8 likes, 3 comments/);
  assert.match(report.body, /TikTok \(1 video\): 40 views, 5 likes, 2 comments/);
  assert.match(report.body, /160 views, 13 likes, 5 comments, 4 shares, 11 clicks/);
  assert.match(report.body, /https:\/\/yepper\.cc\/analytics/);
  assert.match(report.body, /\+250792051768 \| Yepperads@gmail\.com/);
  assert.deepEqual(report.messages, [report.body]);
});

test('weekly report week starts on Monday in UTC', () => {
  assert.equal(getWeekStart(new Date('2026-11-23T09:00:00.000Z')), '2026-11-23');
  assert.equal(getWeekStart(new Date('2026-11-29T23:59:00.000Z')), '2026-11-23');
  assert.equal(getWeekStart(new Date('2026-11-30T00:00:00.000Z')), '2026-11-30');
});

test('weekly sending requires the marketing flag and all outbound API credentials', () => {
  const keys = [
    'WHATSAPP_MARKETING_ENABLED',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_REPORT_TEMPLATE_NAME',
    'WHATSAPP_GRAPH_API_VERSION',
  ];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    keys.forEach((key) => { process.env[key] = 'configured'; });
    process.env.WHATSAPP_MARKETING_ENABLED = 'false';
    assert.equal(isConfigured(), false);

    process.env.WHATSAPP_MARKETING_ENABLED = 'TRUE';
    assert.equal(isConfigured(), true);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    assert.equal(isConfigured(), false);
  } finally {
    keys.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  }
});

test('large reports still fit in one compact template message', () => {
  const videos = Array.from({ length: 1000 }, (_, index) => ({
    platform: 'YouTube',
    title: `Campaign video ${index + 1}`,
    views: 100 + index,
    likes: 10,
    comments: 2,
    shares: 0,
    clicks: 0,
  }));
  const report = formatReport('Ada', videos, '2026-11-23');

  assert.equal(report.messages.length, 1);
  assert.ok(report.body.length <= 1024);
  assert.match(report.body, /YouTube \(1000 videos\)/);
  assert.match(report.body, /All platforms:/);
});
