/**
 * Bulut eşitleme çekirdeği (saf): etkinlik/ek/ayar birleştirme, silme izleri, doğrulama ve iki cihazın yakınsaması.
 */
process.env.TZ = 'Europe/Istanbul';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  combineRemotes, emptySnapshot, hasRemoteData, mergeSnapshots, normalizeRemoteDoc, parseClientId, SYNC_SCHEMA, SYNC_SETTING_KEYS, toDocument, TOMBSTONE_TTL_DAYS,
} from '../src/services/sync/syncCore.js';
import { buildSeedEvents, isUntouchedSeedEvent } from '../src/core/seed.js';
import { normalizeEvent } from '../src/core/eventModel.js';

const T = (n) => new Date(Date.UTC(2026, 10, 17, 9, 0, n)).toISOString(); // n saniye sonraki zaman damgası
const ev = (id, updatedAt, extra = {}) => ({ id, title: `E-${id}`, startDate: '2026-11-17', endDate: '2026-11-17', updatedAt, ...extra });
const snap = (parts = {}) => ({ ...emptySnapshot(), ...parts });
const events = (...list) => Object.fromEntries(list.map((e) => [e.id, e]));
const NOW = T(1000);
const merge = (l, r) => mergeSnapshots(l, r, { now: NOW });

describe('etkinlik birleştirme', () => {
  test('iki taraf da boşsa değişiklik yok', () => {
    const r = merge(snap(), snap());
    assert.equal(r.remoteChanged, false);
    assert.deepEqual(r.toLocal, { upsertEvents: [], removeEventIds: [], settings: {}, downloadAttachments: [], removeAttachmentIds: [] });
    assert.deepEqual(r.merged, snap());
  });

  test('yalnızca yerelde olan etkinlik buluta gider; yalnızca bulutta olan yerele iner', () => {
    const a = ev('a', T(1));
    const b = ev('b', T(2));
    const r = merge(snap({ events: events(a) }), snap({ events: events(b) }));
    assert.deepEqual(Object.keys(r.merged.events).sort(), ['a', 'b']);
    assert.equal(r.remoteChanged, true);
    assert.deepEqual(r.toLocal.upsertEvents.map((e) => e.id), ['b']);
  });

  test('son değişiklik kazanır (her iki yönde); eşitse değişiklik yok', () => {
    const old = ev('a', T(1), { title: 'eski' });
    const fresh = ev('a', T(5), { title: 'yeni' });
    const up = merge(snap({ events: events(fresh) }), snap({ events: events(old) }));
    assert.equal(up.merged.events.a.title, 'yeni');
    assert.equal(up.remoteChanged, true);
    assert.deepEqual(up.toLocal.upsertEvents, []);
    const down = merge(snap({ events: events(old) }), snap({ events: events(fresh) }));
    assert.equal(down.merged.events.a.title, 'yeni');
    assert.equal(down.remoteChanged, false);
    assert.deepEqual(down.toLocal.upsertEvents.map((e) => e.title), ['yeni']);
    const same = merge(snap({ events: events(old) }), snap({ events: events(old) }));
    assert.equal(same.remoteChanged, false);
    assert.deepEqual(same.toLocal.upsertEvents, []);
  });

  test('yerelde silinen etkinlik (iz) bulutta da silinir ve geri gelmez', () => {
    const r = merge(snap({ tombstones: { a: T(9) } }), snap({ events: events(ev('a', T(3))) }));
    assert.deepEqual(r.merged.events, {});
    assert.equal(r.merged.tombstones.a, T(9));
    assert.equal(r.remoteChanged, true);
    assert.deepEqual(r.toLocal.upsertEvents, []);
  });

  test('bulutta silinen etkinlik (iz) yerelden de silinir', () => {
    const r = merge(snap({ events: events(ev('a', T(3))) }), snap({ tombstones: { a: T(9) } }));
    assert.deepEqual(r.toLocal.removeEventIds, ['a']);
    assert.deepEqual(r.merged.events, {});
    assert.equal(r.remoteChanged, false); // bulut zaten güncel
  });

  test('silmeden SONRA başka cihazda değiştirilen etkinlik yeniden doğar (iz kalkar)', () => {
    const r = merge(snap({ events: events(ev('a', T(20), { title: 'düzenlendi' })) }), snap({ tombstones: { a: T(9) } }));
    assert.equal(r.merged.events.a.title, 'düzenlendi');
    assert.equal(r.merged.tombstones.a, undefined);
    assert.equal(r.remoteChanged, true);
    // aynı karar tersine de: bulutta güncel etkinlik, yerelde eski iz
    const r2 = merge(snap({ tombstones: { a: T(9) } }), snap({ events: events(ev('a', T(20))) }));
    assert.equal(r2.merged.events.a.updatedAt, T(20));
    assert.deepEqual(r2.toLocal.upsertEvents.map((e) => e.id), ['a']);
  });

  test('iz, etkinliğin son değişikliğiyle aynı anda ise silme kazanır', () => {
    const r = merge(snap({ events: events(ev('a', T(9))) }), snap({ tombstones: { a: T(9) } }));
    assert.deepEqual(r.toLocal.removeEventIds, ['a']);
  });

  test('eski izler (TTL) budanır; budanan iz belgeden düşer', () => {
    const ancient = new Date(new Date(NOW).getTime() - (TOMBSTONE_TTL_DAYS + 1) * 86_400_000).toISOString();
    const recent = new Date(new Date(NOW).getTime() - 10 * 86_400_000).toISOString();
    const r = merge(snap({ tombstones: { old: ancient, fresh: recent } }), snap({ tombstones: { old: ancient } }));
    assert.deepEqual(Object.keys(r.tombstones), ['fresh']);
    assert.equal(r.remoteChanged, true);
  });

  test('merge girdileri değiştirmez', () => {
    const l = snap({ events: events(ev('a', T(1))), tombstones: { x: T(2) } });
    const r = snap({ events: events(ev('b', T(1))) });
    const before = JSON.stringify([l, r]);
    merge(l, r);
    assert.equal(JSON.stringify([l, r]), before);
  });
});

describe('ek birleştirme', () => {
  const meta = (eventId) => ({ eventId, name: 'a.pdf', type: 'application/pdf', size: 10, createdAt: T(1) });

  test('yerel ek yüklenir, uzak ek indirilir', () => {
    const e = events(ev('e1', T(1)));
    const r = merge(snap({ events: e, attachments: { up: meta('e1') } }), snap({ events: e, attachments: { down: meta('e1') } }));
    assert.deepEqual(r.toRemote.uploadAttachmentIds, ['up']);
    assert.deepEqual(r.toLocal.downloadAttachments.map((a) => a.id), ['down']);
    assert.deepEqual(Object.keys(r.merged.attachments).sort(), ['down', 'up']);
    assert.equal(r.remoteChanged, true);
  });

  test('izi olan ek her iki yerde silinir; bulut dosyası silinecekler listesine girer', () => {
    const e = events(ev('e1', T(1)));
    const r = merge(snap({ events: e, attachments: { x: meta('e1') } }), snap({ events: e, attachments: { x: meta('e1') }, attTombstones: { x: T(5) } }));
    assert.deepEqual(r.toLocal.removeAttachmentIds, ['x']);
    assert.deepEqual(r.toRemote.deleteAttachmentIds, ['x']);
    assert.deepEqual(r.merged.attachments, {});
    assert.equal(r.merged.attTombstones.x, T(5));
  });

  test('yerelde silinen ek (iz) buluttan da kalkar', () => {
    const e = events(ev('e1', T(1)));
    const r = merge(snap({ events: e, attTombstones: { x: T(5) } }), snap({ events: e, attachments: { x: meta('e1') } }));
    assert.deepEqual(r.toRemote.deleteAttachmentIds, ['x']);
    assert.deepEqual(r.toLocal.removeAttachmentIds, []);
    assert.equal(r.remoteChanged, true);
  });

  test('etkinliği silinen etkinliğin ekleri de silinir (ek izi olmasa da)', () => {
    const r = merge(snap({ events: events(ev('e1', T(1))), attachments: { x: meta('e1') } }), snap({ tombstones: { e1: T(9) } }));
    assert.deepEqual(r.toLocal.removeEventIds, ['e1']);
    assert.deepEqual(r.toLocal.removeAttachmentIds, ['x']);
    assert.equal(r.merged.attTombstones.x, T(9));
  });

  test('yeniden doğan etkinliğin ekleri korunur', () => {
    const r = merge(snap({ events: events(ev('e1', T(20))), attachments: { x: meta('e1') } }), snap({ tombstones: { e1: T(9) } }));
    assert.deepEqual(r.toLocal.removeAttachmentIds, []);
    assert.deepEqual(r.toRemote.uploadAttachmentIds, ['x']);
  });
});

describe('ayar birleştirme', () => {
  test('anahtar başına yeni olan kazanır', () => {
    const l = snap({ settings: { theme: { value: 'light', updatedAt: T(8) }, weekStartsOn: { value: 0, updatedAt: T(1) } } });
    const r = snap({ settings: { theme: { value: 'dark', updatedAt: T(2) }, weekStartsOn: { value: 1, updatedAt: T(7) } } });
    const m = merge(l, r);
    assert.deepEqual(m.merged.settings.theme, { value: 'light', updatedAt: T(8) });
    assert.deepEqual(m.merged.settings.weekStartsOn, { value: 1, updatedAt: T(7) });
    assert.deepEqual(m.toLocal.settings, { weekStartsOn: { value: 1, updatedAt: T(7) } });
    assert.equal(m.remoteChanged, true);
  });

  test('yalnızca bir tarafta olan ayar karşıya geçer; eşitlenmeyen anahtarlar yok sayılır', () => {
    const m = merge(snap({ settings: { theme: { value: 'light', updatedAt: T(1) } } }), snap({ settings: { workDays: { value: [1, 2], updatedAt: T(2) } } }));
    assert.deepEqual(Object.keys(m.merged.settings).sort(), ['theme', 'workDays']);
    assert.deepEqual(m.toLocal.settings, { workDays: { value: [1, 2], updatedAt: T(2) } });
    const cleaned = normalizeRemoteDoc({ settings: { sidebarCollapsed: { value: true, updatedAt: T(1) }, theme: { value: 'dark', updatedAt: T(1) } } });
    assert.deepEqual(Object.keys(cleaned.settings), ['theme']);
    assert.ok(!SYNC_SETTING_KEYS.includes('sidebarCollapsed') && !SYNC_SETTING_KEYS.includes('background') && !SYNC_SETTING_KEYS.includes('fabBottom'));
  });

  test('zaman damgası olmayan eski yerel ayar, bulutun gerçek damgalı ayarına yenilir; eşit değerde değişiklik üretmez', () => {
    const legacy = snap({ settings: { theme: { value: 'light' } } });
    const remote = snap({ settings: { theme: { value: 'dark', updatedAt: T(3) } } });
    const m = merge(legacy, remote);
    assert.equal(m.merged.settings.theme.value, 'dark');
    assert.equal(m.toLocal.settings.theme.value, 'dark');
    const equal = merge(snap({ settings: { theme: { value: 'dark', updatedAt: T(1) } } }), remote);
    assert.deepEqual(equal.toLocal.settings, {}); // değerler aynı: yerele yazmaya gerek yok
    assert.equal(equal.remoteChanged, false);
  });
});

describe('merge özellikleri: idempotans ve sıradan bağımsızlık', () => {
  const A = snap({
    events: events(ev('a', T(5)), ev('c', T(7), { title: 'A-c' })),
    tombstones: { d: T(6) },
    attachments: { x: { eventId: 'a', name: 'x', type: 't', size: 1, createdAt: T(1) } },
    settings: { theme: { value: 'light', updatedAt: T(4) } },
  });
  const B = snap({
    events: events(ev('b', T(2)), ev('c', T(9), { title: 'B-c' }), ev('d', T(3))),
    tombstones: { a: T(1) },
    settings: { theme: { value: 'dark', updatedAt: T(8) }, workDays: { value: [1, 2, 3], updatedAt: T(8) } },
  });

  test('birleşik sonuç yeniden birleştirildiğinde değişiklik üretmez', () => {
    const m = merge(A, B);
    const again = merge(m.merged, m.merged);
    assert.equal(again.remoteChanged, false);
    assert.deepEqual(again.toLocal.upsertEvents, []);
    assert.deepEqual(again.toLocal.removeEventIds, []);
  });

  test('merge(A,B) ile merge(B,A) aynı belgeyi üretir', () => {
    assert.deepEqual(merge(A, B).merged, merge(B, A).merged);
  });

  test('combineRemotes: aynı anda oluşturulan iki eşitleme dosyası tek belgede birleşir', () => {
    const combined = combineRemotes([A, B], { now: NOW });
    assert.deepEqual(combined, merge(A, B).merged);
    assert.deepEqual(combineRemotes([], { now: NOW }), emptySnapshot());
  });
});

describe('uzak belge doğrulama', () => {
  test('boş/yok → boş anlık görüntü; bozuk girdiler atılır', () => {
    assert.deepEqual(normalizeRemoteDoc(null), emptySnapshot());
    assert.deepEqual(normalizeRemoteDoc({}), emptySnapshot());
    const doc = normalizeRemoteDoc({
      schema: 1,
      events: { ok: ev('ok', T(1)), bad1: { id: 'baska', updatedAt: T(1) }, bad2: { id: 'bad2' }, bad3: 'x' },
      tombstones: { t1: T(1), t2: 5 },
      attachments: { a1: { eventId: 'ok' }, a2: { name: 'eventId yok' } },
    });
    assert.deepEqual(Object.keys(doc.events), ['ok']);
    assert.deepEqual(Object.keys(doc.tombstones), ['t1']);
    assert.deepEqual(Object.keys(doc.attachments), ['a1']);
  });

  test('daha yeni şema sürümü reddedilir; nesne olmayan içerik hata verir', () => {
    assert.throws(() => normalizeRemoteDoc({ schema: SYNC_SCHEMA + 1 }), /daha yeni/);
    assert.throws(() => normalizeRemoteDoc([1, 2]), /beklenmeyen biçim/);
  });

  test('toDocument şema/üst veri ekler; hasRemoteData boş belgeyi ayırt eder', () => {
    const doc = toDocument(snap({ events: events(ev('a', T(1))) }), { deviceId: 'dev-1', appVersion: '1.31.0', now: T(2) });
    assert.equal(doc.schema, SYNC_SCHEMA);
    assert.equal(doc.deviceId, 'dev-1');
    assert.equal(hasRemoteData(normalizeRemoteDoc(doc)), true);
    assert.equal(hasRemoteData(emptySnapshot()), false);
  });
});

describe('iki cihazın yakınsaması (rastgele işlemler)', () => {
  // Basit, deterministik rastgele sayı üreteci
  const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

  function simulate(seed, steps) {
    const rand = rng(seed);
    let tick = 0;
    const clock = () => T(++tick);
    const devices = [{ events: {}, tombstones: {} }, { events: {}, tombstones: {} }];
    let cloud = emptySnapshot();
    let nextId = 0;
    const sync = (d) => {
      const m = mergeSnapshots({ ...emptySnapshot(), events: d.events, tombstones: d.tombstones }, cloud, { now: NOW });
      m.toLocal.upsertEvents.forEach((e) => (d.events[e.id] = e));
      m.toLocal.removeEventIds.forEach((id) => delete d.events[id]);
      d.tombstones = { ...d.tombstones, ...m.tombstones };
      if (m.remoteChanged) cloud = m.merged;
    };
    for (let i = 0; i < steps; i++) {
      const d = devices[Math.floor(rand() * 2)];
      const ids = Object.keys(d.events);
      const r = rand();
      if (r < 0.25 || !ids.length) {
        const id = `e${nextId++}`;
        d.events[id] = ev(id, clock(), { title: `v${i}` });
      } else if (r < 0.55) {
        const id = ids[Math.floor(rand() * ids.length)];
        d.events[id] = { ...d.events[id], title: `v${i}`, updatedAt: clock() };
      } else if (r < 0.7) {
        const id = ids[Math.floor(rand() * ids.length)];
        delete d.events[id];
        d.tombstones[id] = clock();
      } else sync(d);
    }
    // sonunda herkes eşitlenir (A, B, A)
    sync(devices[0]);
    sync(devices[1]);
    sync(devices[0]);
    return { devices, cloud };
  }

  test('farklı tohumlarla 300 adımlık rastgele işlemler sonunda iki cihaz ve bulut aynı etkinlikleri içerir', () => {
    for (const seed of [1, 2, 3, 7, 42, 99, 1234, 5678]) {
      const { devices, cloud } = simulate(seed, 300);
      const view = (events) => Object.fromEntries(Object.entries(events).map(([id, e]) => [id, `${e.title}@${e.updatedAt}`]));
      assert.deepEqual(view(devices[0].events), view(devices[1].events), `tohum ${seed}: cihazlar ayrıştı`);
      assert.deepEqual(view(devices[0].events), view(cloud.events), `tohum ${seed}: bulut ayrıştı`);
    }
  });
});

describe('örnek (demo) veri: eşitlenmez', () => {
  const asSaved = (e) => normalizeEvent(e); // seed.js ile aynı kayıt yolu: createdAt === updatedAt

  test('dokunulmamış örnek etkinlikler tanınır; düzenlenmiş ya da kullanıcı etkinlikleri tanınmaz', () => {
    const seeds = buildSeedEvents().map(asSaved);
    assert.ok(seeds.length >= 10);
    assert.ok(seeds.every((e) => isUntouchedSeedEvent(e)));
    const edited = { ...seeds[0], updatedAt: new Date(Date.parse(seeds[0].createdAt) + 5000).toISOString() };
    assert.equal(isUntouchedSeedEvent(edited), false);
    assert.equal(isUntouchedSeedEvent(asSaved({ title: 'Pazar araştırması', category: 'Proje', color: '#ff0000', startDate: '2026-11-17' })), false);
    assert.equal(isUntouchedSeedEvent(asSaved({ title: 'Kendi etkinliğim', startDate: '2026-11-17' })), false);
  });
});

describe('özel Google istemci kimliği (parseClientId)', () => {
  test('yerleşik kimlik biçimi ve tipik özel kimlikler geçerlidir', () => {
    for (const id of ['130178296499-883vksmje6127ure7ji455lhsvjj8i9b.apps.googleusercontent.com', '123456789012-abc_def-ghi0123456789.apps.googleusercontent.com', ' 1-a.apps.googleusercontent.com ']) {
      const r = parseClientId(id);
      assert.equal(r.ok, true, id);
      assert.equal(r.id, id.trim());
    }
  });

  test('boş değer "yerleşik kimliği kullan" demektir (geçerli, boş kimlik)', () => {
    for (const v of ['', '   ', null, undefined]) assert.deepEqual(parseClientId(v), { ok: true, id: '' });
  });

  test('biçimi bozuk kimlikler reddedilir', () => {
    for (const bad of ['abc', '123-abc', 'abc.apps.googleusercontent.com', '123-abc.googleusercontent.com', 'https://x.apps.googleusercontent.com', '123-abc.apps.googleusercontent.com.evil.com', '123 456-abc.apps.googleusercontent.com', '<script>']) {
      assert.deepEqual(parseClientId(bad), { ok: false, id: '' }, bad);
    }
  });
});
