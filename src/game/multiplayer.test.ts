import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAuthErrorCode, formatFirebaseAuthError } from './authErrors';
import { DEFAULT_AVATAR } from './data';
import {
  appendUniqueChatMessage,
  appendUniqueLantern,
  clampYawForRules,
  isPresenceFresh,
  normalizeRoomId,
  removeRemotePlayer,
  sanitizeAvatarConfig,
  sanitizeChatText,
  sanitizeFirestoreId,
  sanitizeRemoteTransform,
  sortByCreatedAtAsc,
  sortByCreatedAtDesc,
  updateRemotePlayer,
  upsertRemotePlayer,
  type RemotePlayerState,
} from './multiplayer';

test('normalizeRoomId cleans room codes and defaults empty to main', () => {
  assert.equal(normalizeRoomId(''), 'main');
  assert.equal(normalizeRoomId(null), 'main');
  assert.equal(normalizeRoomId('  Mazu-888!@# '), 'mazu-888');
  assert.equal(normalizeRoomId('   !!!  '), 'main');
});

test('sanitizeRemoteTransform clamps out-of-bounds & non-finite inputs', () => {
  const safe = sanitizeRemoteTransform(Number.NaN, 999, Number.POSITIVE_INFINITY);
  assert.ok(Number.isFinite(safe.x));
  assert.ok(safe.z <= 15.6);
  assert.equal(safe.yaw, Math.PI);
});

test('sanitizeChatText trims whitespace and enforces 120-char limit', () => {
  assert.equal(sanitizeChatText('  媽祖   保佑  '), '媽祖 保佑');
  const longText = '福'.repeat(200);
  assert.equal(sanitizeChatText(longText).length, 120);
});

test('upsertRemotePlayer and removeRemotePlayer are idempotent and skip selfId', () => {
  const p1: RemotePlayerState = {
    id: 'p-1',
    x: 0,
    z: 2,
    yaw: Math.PI,
    emote: 'idle',
    holdingIncense: false,
    avatar: { ...DEFAULT_AVATAR, name: '信眾甲' },
  };
  let list: RemotePlayerState[] = [];
  // Ignore self
  list = upsertRemotePlayer(list, p1, 'p-1');
  assert.equal(list.length, 0);

  // Add once, duplicate join does not duplicate entry
  list = upsertRemotePlayer(list, p1, 'self-0');
  list = upsertRemotePlayer(list, { ...p1, x: 1.5 }, 'self-0');
  assert.equal(list.length, 1);
  assert.equal(list[0].x, 1.5);

  // Update works
  list = updateRemotePlayer(list, {
    id: 'p-1',
    x: 2.2,
    z: -1.1,
    yaw: 0.5,
    emote: 'kneel',
    holdingIncense: true,
  });
  assert.equal(list[0].emote, 'kneel');
  assert.equal(list[0].holdingIncense, true);

  // Remove is idempotent
  list = removeRemotePlayer(list, 'p-1');
  list = removeRemotePlayer(list, 'p-1');
  assert.equal(list.length, 0);
});

test('appendUniqueChatMessage and appendUniqueLantern deduplicate reconnect replays', () => {
  const msg = { id: 'm-1', sender: '信眾甲', text: '平安順心', timestamp: '剛剛' };
  let msgs = appendUniqueChatMessage([], msg);
  msgs = appendUniqueChatMessage(msgs, msg);
  assert.equal(msgs.length, 1);

  const lamp = {
    id: 'l-1',
    ownerName: '信眾甲',
    type: '平安燈' as const,
    wish: '闔家平安',
    slotIndex: 5,
  };
  let lamps = appendUniqueLantern([], lamp);
  lamps = appendUniqueLantern(lamps, lamp);
  assert.equal(lamps.length, 1);
});

test('sanitizeAvatarConfig protects against malformed payloads', () => {
  const safe = sanitizeAvatarConfig({ name: '   ', skinColor: '#fce3cf' });
  assert.equal(safe.name, DEFAULT_AVATAR.name);
  assert.equal(safe.skinColor, '#fce3cf');
});

test('Firestore sanitization helpers keep IDs, yaw, presence freshness, and sorting compliant with rules', () => {
  assert.equal(sanitizeFirestoreId('msg-123!@#$_ok'), 'msg-123_ok');
  assert.ok(/^[a-zA-Z0-9_-]+$/.test(sanitizeFirestoreId('!!!', 'msg')));
  assert.ok(sanitizeFirestoreId('a'.repeat(120)).length <= 64);

  const wrappedBig = clampYawForRules(99.5);
  assert.ok(wrappedBig >= -Math.PI - 0.01 && wrappedBig <= Math.PI + 0.01);
  assert.ok(Math.abs(clampYawForRules(-50.2)) <= 10);

  const now = 1_000_000;
  assert.equal(isPresenceFresh(true, null, now), true);
  assert.equal(isPresenceFresh(true, now - 30_000, now, 60_000), true);
  assert.equal(isPresenceFresh(true, now - 90_000, now, 60_000), false);
  assert.equal(isPresenceFresh(false, now - 5_000, now, 60_000), false);

  const asc = sortByCreatedAtAsc([
    { id: 'b', createdAtMs: 200 },
    { id: 'a', createdAtMs: 100 },
  ]);
  assert.deepEqual(
    asc.map((i) => i.id),
    ['a', 'b'],
  );

  const desc = sortByCreatedAtDesc([
    { id: 'a', createdAtMs: 100 },
    { id: 'b', createdAtMs: 200 },
  ]);
  assert.deepEqual(
    desc.map((i) => i.id),
    ['b', 'a'],
  );
});

test('formatFirebaseAuthError identifies Firebase Auth codes and recommends new tab in iframe or redirect in top tab', () => {
  assert.equal(extractAuthErrorCode({ code: 'auth/popup-blocked' }), 'auth/popup-blocked');
  assert.equal(
    extractAuthErrorCode(new Error('Firebase: Error (auth/unauthorized-domain).')),
    'auth/unauthorized-domain',
  );

  const iframeBlocked = formatFirebaseAuthError({ code: 'auth/popup-blocked' }, true);
  assert.equal(iframeBlocked.suggestNewTab, true);
  assert.equal(iframeBlocked.suggestRedirect, false);

  const topBlocked = formatFirebaseAuthError({ code: 'auth/popup-blocked' }, false);
  assert.equal(topBlocked.suggestNewTab, false);
  assert.equal(topBlocked.suggestRedirect, true);

  const unauthDomain = formatFirebaseAuthError(
    { code: 'auth/unauthorized-domain' },
    false,
    'example.test',
  );
  assert.ok(unauthDomain.message.includes('example.test'));
});
