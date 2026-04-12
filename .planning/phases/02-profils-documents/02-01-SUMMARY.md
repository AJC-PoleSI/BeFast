---
phase: 02-profils-documents
plan: "01"
subsystem: backend-api
tags: [api-routes, encryption, supabase-storage, rls, zod, aes-256-gcm]
dependency_graph:
  requires: []
  provides: [profile-crud-api, sensitive-encryption-api, document-storage-api, avatar-api, signed-url-api]
  affects: [02-02-profil-ui]
tech_stack:
  added: []
  patterns: [server-only-guard, auth-first-pattern, admin-client-for-storage, aes-256-gcm-column-encryption]
key_files:
  created: []
  modified:
    - supabase/migrations/004_documents_personnes.sql
    - types/database.types.ts
    - app/(dashboard)/dashboard/profil/_lib/schemas.ts
    - app/api/profil/route.ts
    - app/api/profil/sensitive/route.ts
    - app/api/profil/avatar/route.ts
    - app/api/profil/documents/route.ts
    - app/api/profil/documents/[docId]/route.ts
    - app/api/profil/documents/signed-url/route.ts
    - hooks/useUser.ts
decisions:
  - "Admin cannot edit other users' sensitive fields (NSS/IBAN) — security boundary; only the owner can update via /api/profil/sensitive"
  - "Document storage uses admin client for upload to bypass user-level RLS — ownership enforced at API layer via auth.uid() check"
  - "Signed URLs expire in 3600 seconds (1 hour) — balances usability vs security for private documents"
metrics:
  duration: "~10 min"
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 10
---

# Phase 02 Plan 01: Profile API and Encrypted Documents Summary

All backend infrastructure for Phase 2 is in place: AES-256-GCM encryption utility, 6 API routes for profile CRUD/sensitive fields/avatar/documents, Zod validation schemas, SQL migration for documents_personnes table with RLS, and storage bucket setup.

## Tasks Completed

### Task 1: SQL migration + types + Zod schemas

- `supabase/migrations/004_documents_personnes.sql` — Complete with documents_personnes table, 4 RLS policies (user read/insert/delete own, admin read all), updated_at trigger, storage bucket inserts for `documents-personnes` (private) and `avatars` (public), and storage RLS policies for both buckets.
- `types/database.types.ts` — Extended with `DocumentType` union type and `DocumentPersonne` interface. Also includes `avatar_url: string | null` on `Personne`.
- `app/(dashboard)/dashboard/profil/_lib/schemas.ts` — Full Zod schemas: `profileSchema`, `sensitiveFieldSchema` (with cross-field confirmation check), `nssSchema` (regex), `ibanSchema` (regex), `VALID_DOC_TYPES`, `MAX_FILE_SIZE`, `ACCEPTED_FILE_TYPES`, `DOC_TYPE_LABELS`, `DOC_TYPE_ICONS`.

### Task 2: All API Routes

All 6 routes implement `import "server-only"`, auth-first pattern (401 on no user), try/catch with 500 fallback.

- `app/api/profil/route.ts` — PATCH: validates with profileSchema, supports optional `targetUserId` for admin (403 if not admin).
- `app/api/profil/sensitive/route.ts` — POST: validates field+value+confirmation, format-validates NSS/IBAN, calls `encryptToString()`, updates `nss_encrypted` or `iban_encrypted` via admin client. Owner-only (no targetUserId support).
- `app/api/profil/avatar/route.ts` — POST FormData: validates image/*, max 2MB, uploads to `avatars/{userId}/avatar.{ext}` with upsert, updates `personnes.avatar_url`.
- `app/api/profil/documents/route.ts` — GET (list with optional admin targetUserId) + POST (upload with type/size/mime validation, upserts into documents_personnes).
- `app/api/profil/documents/[docId]/route.ts` — DELETE: fetches doc, verifies ownership (personne_id === user.id), removes from storage then DB.
- `app/api/profil/documents/signed-url/route.ts` — POST: verifies ownership or admin role, generates 1-hour signed URL via `createSignedUrl(filePath, 3600)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing `nouvelle_mission` key in emptyPermissions**
- **Found during:** TypeScript verification after task execution
- **Issue:** `hooks/useUser.ts` `emptyPermissions` constant was missing the `nouvelle_mission: false` key, which is required by the `Permissions` type (defined in types/database.types.ts). This caused `npx tsc --noEmit` to fail.
- **Fix:** Added `nouvelle_mission: false` to the `emptyPermissions` object.
- **Files modified:** `hooks/useUser.ts`
- **Commit:** a543c9d

## Commits

| Hash | Message | Files |
|------|---------|-------|
| eea9d48 | feat(phase-02): implement modern frontend for missions, studies, and profile | All API routes, schemas, types, migration |
| a543c9d | fix(phase-02-w1): add missing nouvelle_mission permission to emptyPermissions | hooks/useUser.ts |

## Known Stubs

None — all API routes are fully wired. The migration SQL is ready to apply in Supabase SQL editor (remote DB tables not yet created — requires manual application).

## Self-Check: PASSED

- `supabase/migrations/004_documents_personnes.sql` — FOUND
- `types/database.types.ts` with DocumentType/DocumentPersonne — FOUND
- `app/(dashboard)/dashboard/profil/_lib/schemas.ts` with all exports — FOUND
- All 6 API routes present with server-only guard — FOUND
- `npx tsc --noEmit` — PASSES (0 errors)
