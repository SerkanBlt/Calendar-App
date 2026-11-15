/**
 * Sürüm tutarlılığı: "Yenile" bildirimi, service worker'ın VERSION değerini uygulama sürümüyle (package.json) karşılaştırır.
 * İkisi ayrışırsa kullanıcıya gereksiz veya eksik güncelleme bildirimi gider.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('service-worker.js VERSION, package.json sürümüyle aynı', () => {
  const pkg = JSON.parse(read('../package.json')).version;
  const sw = /const VERSION = 'v([^']+)'/.exec(read('../public/service-worker.js'))?.[1];
  assert.equal(sw, pkg, `service-worker.js VERSION (${sw}) ile package.json (${pkg}) ayrışmış`);
});

test('package-lock.json kök sürümü, package.json ile aynı', () => {
  const pkg = JSON.parse(read('../package.json')).version;
  const lock = JSON.parse(read('../package-lock.json'));
  assert.equal(lock.version, pkg);
  assert.equal(lock.packages[''].version, pkg);
});
