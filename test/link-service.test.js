const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
let calls, behavior;
const config = { baseUrl: 'http://localhost:3000', cacheTtlSeconds: 3600 };
const record = (name, result) => async (...args) => {
  calls.push([name, ...args]);
  return behavior[name] ? behavior[name](...args) : result;
};
const mocks = {
  '../src/config': { config },
  '../src/db': { createLink: record('create', true), findLinkByCode: record('find', null) },
  '../src/redis': { redis: { get: record('get', null), set: record('set', 'OK'),
    incr: record('incr', 1), zIncrBy: record('zIncrBy', 1), zRevRank: record('rank', null) } },
  '../src/utils/hash': { randomCode: () => 'abc1234' }
};
for (const [path, exports] of Object.entries(mocks)) require.cache[require.resolve(path)] = { exports };
const service = require('../src/services/linkService');
beforeEach(() => { calls=[]; behavior={}; });

test('cache hit resolves without querying PostgreSQL', async () => {
  behavior.get = () => 'https://example.com';
  assert.deepEqual(await service.resolveUrl('abc'), {longUrl:'https://example.com', source:'redis-cache'});
  assert.equal(calls.filter(c=>c[0]==='find').length,0);
});
test('cache miss falls back to PostgreSQL and fills cache with TTL', async () => {
  behavior.find = () => ({long_url:'https://example.com'});
  assert.deepEqual(await service.resolveUrl('abc'), {longUrl:'https://example.com', source:'postgres'});
  assert.deepEqual(calls.find(c=>c[0]==='set'), ['set','url:abc','https://example.com',{EX:3600}]);
});
test('missing link returns null without caching it', async () => {
  assert.equal(await service.resolveUrl('missing'),null);
  assert.equal(calls.some(c=>c[0]==='set'),false);
});
test('creation persists mapping and returns a configured short URL', async () => {
  assert.deepEqual(await service.shortenUrl('https://example.com'), {
    code:'abc1234',longUrl:'https://example.com',shortUrl:'http://localhost:3000/abc1234'});
  assert.deepEqual(calls.find(c=>c[0]==='create'), ['create','abc1234','https://example.com']);
});
test('collision retry stops after five failed database inserts', async () => {
  behavior.create = () => null;
  await assert.rejects(service.shortenUrl('https://example.com'), /unique short code/);
  assert.equal(calls.filter(c=>c[0]==='create').length,5);
  assert.equal(calls.some(c=>c[0]==='set'),false);
});
test('a collision followed by success returns the created mapping', async () => {
  let attempts=0; behavior.create = () => ++attempts===2;
  assert.equal((await service.shortenUrl('https://example.com')).code,'abc1234');
  assert.equal(attempts,2);
});
test('tracking updates both total clicks and popularity', async () => {
  behavior.incr = () => 7;
  assert.equal(await service.trackClick('abc'),7);
  assert.deepEqual(calls,[['incr','clicks:abc'],['zIncrBy','popular_urls',1,'abc']]);
});
test('analytics converts stored count and zero-based rank', async () => {
  behavior.find=()=>({long_url:'https://example.com',created_at:'2026-01-01'});
  behavior.get=()=> '7'; behavior.rank=()=>2;
  const result=await service.getAnalytics('abc');
  assert.equal(result.clicks,7); assert.equal(result.popularityRank,3);
});
test('missing analytics returns null without accessing click counters', async () => {
  assert.equal(await service.getAnalytics('missing'),null);
  assert.deepEqual(calls,[['find','missing']]);
});
