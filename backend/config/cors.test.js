'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cors = require('./cors');

function createResponse() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: undefined,
    header(name, value) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    sendStatus(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

for (const origin of ['https://yepper.cc', 'https://www.yepper.cc']) {
  test(`CORS preflight allows ${origin} on the worker job route`, () => {
    const req = {
      headers: { origin, 'access-control-request-headers': 'authorization' },
      method: 'OPTIONS',
      path: '/api/social/post-ad/jobs/32',
    };
    const res = createResponse();
    let nextCalled = false;

    cors(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], origin);
    assert.match(res.headers['access-control-allow-headers'], /Authorization/);
    assert.equal(nextCalled, false);
  });

  test(`CORS headers are set before a worker route returns 404 for ${origin}`, () => {
    const req = {
      headers: { origin },
      method: 'GET',
      path: '/api/social/post-ad/jobs/32',
    };
    const res = createResponse();
    let nextCalled = false;

    cors(req, res, () => {
      nextCalled = true;
      res.status(404).json({ error: 'Not Found' });
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers['access-control-allow-origin'], origin);
  });
}
