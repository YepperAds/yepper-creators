const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContinuousOverlayFilter, getAdSlots } = require('./videoAdInjector');

test('getAdSlots uses fixed percentage markers for every video length', () => {
  assert.deepStrictEqual(getAdSlots(120), [
    { key: '8pct', time: 9.6 },
    { key: '25pct', time: 30 },
    { key: '45pct', time: 54 },
    { key: '65pct', time: 78 },
    { key: '85pct', time: 102 },
  ]);
});

test('overlay filter gates the ad to the exact slot window', () => {
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
  assert.match(filter, /enable='between\(t,30,36\)'/);
});
