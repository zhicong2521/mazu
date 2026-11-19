# Cloud Tianhou Temple — Firestore Security Spec (Phase 0)

## Data Invariants
1. **Default Deny**: Any unmatched path is strictly denied (`allow read, write: if false`).
2. **Verified Identity**: All reads and writes require an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
3. **Zero PII in Public Room Docs**: No email, phone, or private account data is ever stored in `/rooms`, `/players`, `/messages`, or `/lanterns`.
4. **Master Gate**: No `player`, `message`, or `lantern` document can be created unless its parent `/rooms/{roomId}` document exists.
5. **Strict Ownership**: A user may only create, update, or delete `/rooms/{roomId}/players/{playerId}` where `playerId == request.auth.uid` and `uid == request.auth.uid`.
6. **Immutable Logs**: `messages` and `lanterns` are strictly append-only (`update` and `delete` denied).
7. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
8. **Action-Based Updates & No Ghost Fields**: Every `create` checks `hasAll` + `hasOnly`; every `update` uses `affectedKeys().hasOnly(...)` combined with full `isValid[Entity]()` schema checks.

## Dirty Dozen Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading `/rooms/main/players` with `request.auth == null`.
2. **Unverified Email Spoof**: Creating a message with `email_verified: false`.
3. **Identity Spoofing on Player**: User A writing `/rooms/main/players/{userB_uid}` or setting `uid: userB_uid`.
4. **Identity Spoofing on Chat**: User A creating a message with `senderUid: userB_uid`.
5. **Shadow Ghost Field**: Creating/updating a player doc with extra field `isAdmin: true`.
6. **Orphaned Subcollection Write**: Creating `/rooms/nonexistent/messages/m1` when `/rooms/nonexistent` does not exist.
7. **ID Poisoning**: Creating `/rooms/$$$bad_id_1500_chars...` with invalid characters or length > 32/128.
8. **Out-of-Bounds Coordinates**: Setting player `x: 9999` or `z: -500` outside temple world bounds.
9. **Oversized String Exhaustion**: Sending a chat message `text` of 5,000 characters (> 120 maxLength).
10. **Client Timestamp Forgery**: Creating a message with client-forged `createdAt` != `request.time`.
11. **Bell Counter Tampering**: Updating `/rooms/main` with `bellSeq: existing.bellSeq + 100` or mutating `createdBy`.
12. **Chat History Tampering**: Updating or deleting an existing `/rooms/main/messages/{id}` document.
