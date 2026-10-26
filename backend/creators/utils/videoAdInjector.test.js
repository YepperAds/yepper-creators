const test = require('node:test');
const assert = require('node:assert/strict');
const { AD_WINDOW_SEC, buildContinuousOverlayFilter, getAdSlots } = require('./videoAdInjector');
const {
  acceptEagerRenderNotification,
  buildVideoTransformations,
  getEagerRenderFailure,
  uploadVideoFile,
  waitForEagerRender,
} = require('./videoCloudinary');
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

test('Cloudinary video transformation places the claimed image at the selected slot time', () => {
  const transformations = buildVideoTransformations({
    activeSlots: [{
      key: '25pct',
      time: 30,
      imagePublicId: 'yepper/jobs/1/creative-0',
      claim: { adType: 'corner', adSize: 'medium' },
    }],
    duration: 120,
    sourceWidth: 3840,
  });

  assert.deepStrictEqual(transformations, [
    { overlay: 'authenticated:yepper:jobs:1:creative-0' },
    { width: 1075, crop: 'scale' },
    {
      start_offset: '30',
      duration: '15',
      gravity: 'south_east',
      x: 20,
      y: 20,
      flags: 'layer_apply',
    },
  ]);

  const cloudinary = require('cloudinary').v2;
  const transformationString = cloudinary.utils.generate_transformation_string(transformations);
  assert.match(transformationString, /l_authenticated:yepper:jobs:1:creative-0/);
  assert.match(transformationString, /du_15,fl_layer_apply,g_south_east,so_30,x_20,y_20/);
  assert.equal(
    cloudinary.utils.build_eager([`${transformationString}/mp4`]),
    `${transformationString}/mp4`,
  );
});

test('Cloudinary L-bar transformation creates both timed banner strips', () => {
  const transformations = buildVideoTransformations({
    activeSlots: [{
      key: '85pct',
      time: 102,
      imagePublicId: 'yepper/jobs/2/creative-0',
      claim: { adType: 'lbar', adSize: 'small' },
    }],
    duration: 120,
    sourceWidth: 1920,
  });

  assert.equal(transformations.length, 6);
  assert.equal(transformations[1].width, 115);
  assert.equal(transformations[2].start_offset, '102');
  assert.equal(transformations[2].duration, '15');
  assert.equal(transformations[2].gravity, 'west');
  assert.equal(transformations[4].width, 192);
  assert.equal(transformations[5].gravity, 'south');
});

test('Cloudinary eager render failure includes the provider error detail', () => {
  assert.equal(
    getEagerRenderFailure({ eager: [{ status: 'failed', error: { message: 'Transformation not allowed' } }] }),
    'Transformation not allowed',
  );
  assert.equal(
    getEagerRenderFailure({ eager: [{ status: 'failed' }] }),
    'failed',
  );
});

test('Cloudinary eager-render callback verifies its signature and resolves the matching job', async () => {
  process.env.VID_CLOUDINARY_NAME = 'test-cloud';
  process.env.VID_CLOUDINARY_KEY = 'test-key';
  process.env.VID_CLOUDINARY_API_SECRET = 'test-secret';
  const jobId = `test-${require('crypto').randomUUID()}`;
  const rawBody = JSON.stringify({ eager: [{ status: 'complete', secure_url: 'https://res.cloudinary.com/test/video/upload/rendered.mp4' }] });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const cloudinary = require('cloudinary').v2;
  const signature = cloudinary.utils.webhook_signature(rawBody, Number(timestamp), { api_secret: 'test-secret' });
  const renderPromise = waitForEagerRender(jobId);

  assert.equal(acceptEagerRenderNotification({ jobId, rawBody, timestamp, signature }), true);
  assert.deepEqual(await renderPromise, JSON.parse(rawBody).eager[0]);
});

test('Cloudinary video upload rejects a missing source file without creating an unhandled stream error', async () => {
  const cloudinary = require('cloudinary').v2;
  const missingPath = require('path').join(require('os').tmpdir(), `missing-video-${require('crypto').randomUUID()}.mp4`);

  await assert.rejects(
    uploadVideoFile(cloudinary, missingPath, {}),
    { code: 'ENOENT' },
  );
});
