const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContinuousOverlayFilter, getAdSlots } = require('./videoAdInjector');

test('getAdSlots keeps the intro slot at 30 seconds for short videos', () => {
  assert.deepStrictEqual(getAdSlots(45), [
    { key: 'intro', time: 30 },
  ]);
});

test('overlay filter gates the ad to the exact slot window', () => {
  const { filter } = buildContinuousOverlayFilter({
    activeSlots: [{
      key: 'intro',
      time: 30,
      imagePath: '/tmp/ad.png',
      claim: { adType: 'corner', adSize: 'medium' },
    }],
    duration: 45,
  });

  assert.match(filter, /setpts=PTS-STARTPTS\+30\/TB/);
  assert.match(filter, /enable='between\(t,30,36\)'/);
});
