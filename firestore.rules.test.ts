import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesText = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve('firebase-blueprint.json'), 'utf8'));

test('firestore.rules enforces global default-deny and verified users', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
});

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.deepEqual(paths, [
    '/rooms/{roomId}',
    '/rooms/{roomId}/players/{playerId}',
    '/rooms/{roomId}/messages/{messageId}',
    '/rooms/{roomId}/lanterns/{lanternId}',
  ]);
  assert.match(rulesText, /match \/rooms\/\{roomId\}/);
  assert.match(rulesText, /match \/players\/\{playerId\}/);
  assert.match(rulesText, /match \/messages\/\{messageId\}/);
  assert.match(rulesText, /match \/lanterns\/\{lanternId\}/);
});

test('firestore.rules enforces Dirty Dozen protections (Master Gate, Ownership, Immutability, Strict Keys, request.time)', () => {
  // Master Gate parent existence check
  assert.match(rulesText, /exists\(\/databases\/\$\(database\)\/documents\/rooms\/\$\(roomId\)\)/);
  // Strict ownership on players
  assert.match(rulesText, /playerId == request\.auth\.uid/);
  // Strict server timestamp validation
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  // Action-based update field allowlisting
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(/);
  // Immutable chat & lanterns
  const immutableMatches = rulesText.match(/allow update: if false;\s*allow delete: if false;/g) || [];
  assert.equal(immutableMatches.length, 2);
});
