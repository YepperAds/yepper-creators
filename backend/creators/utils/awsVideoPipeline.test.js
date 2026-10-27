const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MULTIPART_PART_SIZE,
  buildMediaConvertSettings,
  getMultipartPartCount,
} = require('./awsVideoPipeline');

test('multipart upload part sizing stays within S3 limits for 50 GB inputs', () => {
  assert.equal(getMultipartPartCount(1), 1);
  assert.equal(getMultipartPartCount(MULTIPART_PART_SIZE), 1);
  assert.equal(getMultipartPartCount(MULTIPART_PART_SIZE + 1), 2);
  assert.ok(getMultipartPartCount(100 * 1024 ** 3) <= 10_000);
  assert.ok(MULTIPART_PART_SIZE >= 5 * 1024 * 1024);
});

test('MediaConvert settings preserve source dimensions and overlay timing', () => {
  const overlay = {
    Duration: 15_000,
    FadeIn: 0,
    FadeOut: 0,
    Opacity: 100,
    StartTime: '00:30:00:00',
    Layer: 0,
    ImageInserterInput: 's3://video-bucket/ads/creative.png',
    ImageX: 20,
    ImageY: 20,
    Width: 1000,
    Height: 500,
  };
  const settings = buildMediaConvertSettings({
    bucket: 'video-bucket',
    inputKey: 'videos/original.mp4',
    outputPrefix: 'videos/processed',
    duration: 7200,
    overlays: [overlay],
  });
  const output = settings.OutputGroups[0].Outputs[0];

  assert.equal(settings.TimecodeConfig.Source, 'ZEROBASED');
  assert.equal(settings.Inputs[0].VideoSelector.TimecodeSource, 'ZEROBASED');
  assert.equal(output.VideoDescription.VideoPreprocessors.ImageInserter.InsertableImages[0], overlay);
  assert.equal(output.VideoDescription.Width, 1920);
  assert.equal(output.VideoDescription.Height, 1080);
  assert.equal(output.VideoDescription.CodecSettings.H264Settings.RateControlMode, 'QVBR');
  assert.equal(output.VideoDescription.CodecSettings.H264Settings.QualityTuningLevel, 'SINGLE_PASS');
  assert.equal(output.VideoDescription.CodecSettings.H264Settings.FramerateNumerator, 30);
  assert.equal(output.VideoDescription.CodecSettings.H264Settings.FramerateDenominator, 1);
  assert.equal(output.VideoDescription.CodecSettings.H264Settings.QvbrSettings.QvbrQualityLevel, 9);
  assert.equal(output.VideoDescription.CodecSettings.H264Settings.MaxBitrate, 20_000_000);
});
