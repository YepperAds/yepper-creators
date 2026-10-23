const test = require('node:test');
const assert = require('node:assert/strict');
const { AD_WINDOW_SEC, buildContinuousOverlayFilter, getAdSlots } = require('./videoAdInjector');
const { normalizeActiveSlots } = require('../controllers/adSpaceController');

test('normalizeActiveSlots keeps only valid slot keys and defaults to the full list when empty', () => {
  assert.deepStrictEqual(normalizeActiveSlots(['25pct', 'bogus', '85pct']), ['25pct', '85pct']);
  assert.deepStrictEqual(normalizeActiveSlots([]), ['8pct', '25pct', '45pct', '65pct', '85pct']);
});

test('getAdSlots uses fixed percentage markers for every video length', () => {
  assert.deepStrictEqual(getAdSlots(120), [
    { key: '8pct', time: 9.6 },
    { key: '25pct', time: 30 },
    { key: '45pct', time: 54 },
    { key: '65pct', time: 78 },
    { key: '85pct', time: 102 },
  ]);
  assert.deepStrictEqual(getAdSlots(7200), [
    { key: '8pct', time: 576 },
    { key: '25pct', time: 1800 },
    { key: '45pct', time: 3240 },
    { key: '65pct', time: 4680 },
    { key: '85pct', time: 6120 },
  ]);
});

test('overlay filter keeps the ad visible for 15 seconds at its selected timestamp', () => {
  const { filter } = buildContinuousOverlayFilter({
    activeSlots: [{
      key: '25pct',
      time: 30,
      imagePath: '/tmp/ad.png',
      claim: { adType: 'corner', adSize: 'medium' },
    }],
    duration: 120,
  });

  assert.match(filter, /setpts=PTS-STARTPTS\+30\/TB/);
  assert.equal(AD_WINDOW_SEC, 15);
  assert.match(filter, /enable='between\(t,30,45\)'/);
});
