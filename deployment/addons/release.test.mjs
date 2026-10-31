import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseInfo } from './release-utils.mjs';
import handler from './api/catalog.mjs';

test('release names only accept stable semantic versions', () => {
  assert.equal(releaseInfo('1.16.0').origin, 'https://addons-poc-release-1-16-0.vercel.app');
  for (const version of ['1.2.3-rc.1', '../1.2.3', '01.2.3', '1.2']) assert.throws(() => releaseInfo(version));
});

test('catalogue serves plain chart text with the Node response interface', async () => {
  const headers = {};
  let body;
  const response = {
    setHeader(name, value) { headers[name] = value; },
    send(value) { body = value; },
    status(code) { throw new Error(`Unexpected status ${code}`); },
    json(value) { throw new Error(`Unexpected JSON ${JSON.stringify(value)}`); },
  };
  await handler({ method: 'GET', url: '/chord-catalog/text/chart/static-and-rain/content.txt', headers: { host: 'example.test' } }, response);
  assert.match(headers['Content-Type'], /^text\/plain/);
  assert.ok(body.includes('[Intro]'));
});
