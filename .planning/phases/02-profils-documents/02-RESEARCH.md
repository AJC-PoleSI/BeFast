# Phase 2: Profils & Documents - Research

**Researched:** 2026-04-10
**Domain:** Supabase Storage, AES-256-GCM encryption, Next.js API Routes, file uploads
**Confidence:** HIGH

## Summary

Phase 2 builds profile management and document upload on top of Phase 1's existing infrastructure. The encryption module (`lib/encryption.ts`) already handles AES-256-GCM with `encryptToString`/`decryptFromString`. Supabase Storage with signed URLs and RLS policies on the `documents-personnes` bucket is the core new technical domain. The `personnes` table already has `nss_encrypted` and `iban_encrypted` BYTEA columns.

The main work is: (1) API Routes for sensitive field encryption, (2) Supabase Storage bucket setup + RLS, (3) signed URL generation via admin client, (4) profile page UI with tabs, forms, and document slots.

**Primary recommendation:** Use Next.js App Router Route Handlers (`app/api/...`) for all server-side operations (encryption, signed URLs, file management). Use the existing `createAdminClient()` for Storage operations requiring `service_role_key`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tab layout**: Onglets "Informations" / "Documents" sur la page profil
- **Avatar**: Upload photo dans bucket `avatars`, fallback initiales
- **Sensitive fields**: Masqué `****`, modification via modal Dialog, API Route serveur, AES-256-GCM via `lib/encryption.ts`
- **Documents**: Upload bouton classique (pas drag-and-drop), 5 slots fixes, aperçu inline image / lien PDF, URL signée 1h
- **Filigrane**: Bouton ouvre https://filigrane.beta.gouv.fr dans nouvel onglet
- **Taille max**: 10 Mo par fichier
- **Admin view**: Accès via `/dashboard/profil/[userId]`, peut modifier données de base, PAS les données sensibles d'un autre utilisateur

### Claude's Discretion
None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
Aucun.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Voir et modifier infos de base | Profile form with react-hook-form + zod, PATCH API Route |
| PROF-02 | NSS/IBAN masqués avec bouton Modifier | SensitiveFieldCard component, `****` display |
| PROF-03 | Modification NSS/IBAN via API Route serveur + AES-256-GCM | `lib/encryption.ts` encryptToString, POST `/api/profil/sensitive` |
| PROF-04 | NSS/IBAN stockés chiffrés en BYTEA via pgcrypto | `nss_encrypted`/`iban_encrypted` columns already in `personnes` type |
| PROF-05 | Indiquer pôle d'appartenance | Select field in profile form, `pole` column exists |
| PROF-06 | Admin peut voir/modifier profil de n'importe quel membre | `/dashboard/profil/[userId]` route, admin check server-side |
| DOCS-01 | Upload 5 types de documents | DocumentSlot component, Supabase Storage upload |
| DOCS-02 | Statut uploadé/manquant avec aperçu | Badge component + inline preview (image) or PDF icon |
| DOCS-03 | Supprimer un document uploadé | Delete from Storage via API Route, confirmation Dialog |
| DOCS-04 | Bucket Supabase Storage privé | `documents-personnes` bucket, private, RLS policies |
| DOCS-05 | URLs signées expiration 1h | `createSignedUrl` via admin client |
| DOCS-06 | Bouton filigrane ouvre site externe | `window.open('https://filigrane.beta.gouv.fr', '_blank')` |
| SEC-01 | RLS activé sur toutes les tables | RLS policies on `personnes`, `documents_personnes` |
| SEC-02 | service_role_key côté serveur uniquement | `createAdminClient()` only in Route Handlers, `"server-only"` import |
| SEC-03 | Bucket documents-personnes configuré en privé | Supabase Storage bucket config `public: false` |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | App Router + API Routes | Already in project |
| @supabase/supabase-js | ^2 | DB + Storage client | Already in project |
| @supabase/ssr | ^0.5 | Server-side Supabase | Already in project |
| react-hook-form | ^7.72.1 | Form state management | Already in project |
| zod | ^4.3.6 | Validation schemas | Already in project |
| @hookform/resolvers | ^5.2.2 | Zod resolver for RHF | Already in project |
| sonner | ^2.0.7 | Toast notifications | Already in project |

### New shadcn components to install
| Component | Command | Purpose |
|-----------|---------|---------|
| tabs | `npx shadcn@latest add tabs` | Profile page tab navigation |
| dialog | `npx shadcn@latest add dialog` | NSS/IBAN edit modal, delete confirmation |
| textarea | `npx shadcn@latest add textarea` | Address field if multiline |

### No new npm packages needed
All functionality is covered by existing dependencies + Supabase Storage API.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── (dashboard)/
│   └── dashboard/
│       └── profil/
│           ├── page.tsx              # Own profile (server component)
│           ├── [userId]/
│           │   └── page.tsx          # Admin view of member profile
│           ├── _components/
│           │   ├── profile-header.tsx
│           │   ├── profile-info-card.tsx
│           │   ├── sensitive-field-card.tsx
│           │   ├── sensitive-edit-modal.tsx
│           │   ├── document-grid.tsx
│           │   ├── document-slot.tsx
│           │   └── avatar-upload.tsx
│           └── _lib/
│               ├── schemas.ts        # Zod schemas for profile + docs
│               └── actions.ts        # OR keep in API routes
├── api/
│   └── profil/
│       ├── route.ts                  # PATCH basic profile info
│       ├── sensitive/
│       │   └── route.ts             # POST encrypt + save NSS/IBAN
│       ├── avatar/
│       │   └── route.ts             # POST upload avatar
│       └── documents/
│           ├── route.ts             # POST upload, GET list
│           ├── [docId]/
│           │   └── route.ts         # DELETE document
│           └── signed-url/
│               └── route.ts         # POST get signed URL
lib/
├── encryption.ts                     # EXISTING — reuse as-is
├── supabase/
│   ├── server.ts                     # EXISTING
│   ├── client.ts                     # EXISTING
│   └── admin.ts                      # EXISTING — use for Storage ops
types/
└── database.types.ts                 # EXTEND with DocumentPersonne type
```

### Pattern 1: API Route for Sensitive Data
**What:** All sensitive operations (encryption, signed URLs, Storage admin) go through Next.js Route Handlers
**When to use:** Any operation needing `ENCRYPTION_KEY` or `service_role_key`

```typescript
// app/api/profil/sensitive/route.ts
import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptToString } from "@/lib/encryption"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const { field, value } = await request.json()
  if (field !== "nss" && field !== "iban") {
    return NextResponse.json({ error: "Champ invalide" }, { status: 400 })
  }

  const encrypted = encryptToString(value)
  const admin = createAdminClient()
  const column = field === "nss" ? "nss_encrypted" : "iban_encrypted"

  const { error } = await admin
    .from("personnes")
    .update({ [column]: encrypted })
    .eq("id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

### Pattern 2: Supabase Storage Signed URLs
**What:** Upload files with admin client, generate short-lived signed URLs for access
**When to use:** Document access (DOCS-05)

```typescript
// Upload: use admin client for private bucket
const admin = createAdminClient()
const filePath = `${userId}/${docType}/${filename}`
const { error } = await admin.storage
  .from("documents-personnes")
  .upload(filePath, file, {
    upsert: true,
    contentType: file.type,
  })

// Signed URL: 1 hour expiry
const { data, error } = await admin.storage
  .from("documents-personnes")
  .createSignedUrl(filePath, 3600) // 3600 seconds = 1 hour
```

### Pattern 3: Storage Path Convention
**What:** Organize files by user ID and document type
```
documents-personnes/
  {userId}/
    carte_identite/file.pdf
    carte_etudiante/file.jpg
    carte_vitale/file.png
    preuve_lydia/file.pdf
    rib/file.pdf

avatars/
  {userId}/avatar.{ext}
```

### Pattern 4: Admin Access Check (Server-Side)
```typescript
// In /dashboard/profil/[userId]/page.tsx (server component)
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AdminProfilePage({ params }: { params: { userId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check if current user is admin
  const { data: profile } = await supabase
    .from("personnes")
    .select("profils_types(slug)")
    .eq("id", user.id)
    .single()

  if (profile?.profils_types?.slug !== "administrateur") {
    redirect("/dashboard")
  }

  // Fetch target user's profile
  const { data: targetProfile } = await supabase
    .from("personnes")
    .select("*, profils_types(*)")
    .eq("id", params.userId)
    .single()

  // ... render
}
```

### Anti-Patterns to Avoid
- **Never expose `service_role_key` in client components** — all Storage admin operations via API Routes
- **Never pass unencrypted NSS/IBAN to client** — only `****` mask or "Non renseigné"
- **Never store file paths as public URLs** — always use signed URLs with expiry
- **Never let admin update sensitive fields of other users** — explicit check in API Route

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload validation | Custom MIME/size checker | Zod schema + native `accept` attribute + server-side check | Edge cases with spoofed MIME types |
| Signed URL generation | Custom token system | `supabase.storage.createSignedUrl()` | Built-in, handles expiry, security |
| Form state management | useState for each field | react-hook-form + zod resolver | Already in project, handles dirty tracking |
| Encryption | Custom crypto | `lib/encryption.ts` (existing) | Already implemented and tested |
| Avatar initials fallback | Custom component | shadcn Avatar with AvatarFallback | Built into component |

## Common Pitfalls

### Pitfall 1: Supabase Storage RLS vs Service Role
**What goes wrong:** Using anon key for private bucket operations fails silently
**Why it happens:** Private buckets require either RLS policies on `storage.objects` or `service_role_key`
**How to avoid:** Use `createAdminClient()` for all Storage operations in API Routes. Create RLS policies on `storage.objects` if you want client-side uploads (not recommended for private documents).
**Warning signs:** 403 errors on upload, empty signed URLs

### Pitfall 2: File Size Validation Only Client-Side
**What goes wrong:** Users bypass client validation, upload huge files
**Why it happens:** Only checking `file.size` in the browser
**How to avoid:** Validate both client-side (UX) AND in the API Route (security). Check `Content-Length` header and actual body size.

### Pitfall 3: Stale Signed URLs in React State
**What goes wrong:** Signed URL expires while user is viewing the page (after 1h)
**Why it happens:** URL stored in state, never refreshed
**How to avoid:** Generate signed URLs on-demand when user clicks "Télécharger". For previews, generate on page load but accept they expire.

### Pitfall 4: Encryption Column Type Mismatch
**What goes wrong:** Encrypted string stored incorrectly in BYTEA column
**Why it happens:** `encryptToString` returns a colon-separated hex string, not raw bytes
**How to avoid:** Store as `text` type in Supabase (the column name says `_encrypted` but the format from `encryptToString` is a text string `iv:tag:ciphertext`). Verify the actual column type in Supabase matches. If it's BYTEA, convert; if text, use directly.
**Warning signs:** Garbled data on decrypt

### Pitfall 5: Missing CORS/Auth on API Routes
**What goes wrong:** API routes accessible without authentication
**Why it happens:** Forgetting to check `supabase.auth.getUser()` at the start of every Route Handler
**How to avoid:** First lines of every API route: get user, return 401 if null

## Code Examples

### Zod Schema for Profile
```typescript
import { z } from "zod"

export const profileSchema = z.object({
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  portable: z.string().optional(),
  promo: z.string().optional(),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  code_postal: z.string().optional(),
  pole: z.string().optional(),
})

export const sensitiveFieldSchema = z.object({
  field: z.enum(["nss", "iban"]),
  value: z.string().min(1),
  confirmation: z.string().min(1),
}).refine(d => d.value === d.confirmation, {
  message: "Les valeurs ne correspondent pas.",
  path: ["confirmation"],
})

// NSS format: 1 or 2 + 2 digits year + 2 digits month + 5 digits + 2 digits key
export const nssSchema = z.string().regex(
  /^[12]\d{2}(0[1-9]|1[0-2])\d{5}\d{2}$/,
  "Le numéro de sécurité sociale n'est pas valide."
)

// IBAN FR: FR + 2 check digits + 23 alphanumeric
export const ibanSchema = z.string().regex(
  /^FR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}$/,
  "L'IBAN n'est pas valide."
)
```

### Document Upload in API Route
```typescript
// app/api/profil/documents/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

const VALID_DOC_TYPES = ["carte_identite", "carte_etudiante", "carte_vitale", "preuve_lydia", "rib"] as const
const MAX_SIZE = 10 * 1024 * 1024 // 10 Mo

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const docType = formData.get("docType") as string

  if (!file) return NextResponse.json({ error: "Fichier requis" }, { status: 400 })
  if (!VALID_DOC_TYPES.includes(docType as any)) {
    return NextResponse.json({ error: "Type de document invalide" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Le fichier dépasse 10 Mo" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()
  const filePath = `${user.id}/${docType}/document.${ext}`
  const admin = createAdminClient()

  const { error } = await admin.storage
    .from("documents-personnes")
    .upload(filePath, file, { upsert: true, contentType: file.type })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also store reference in DB table
  // await admin.from("documents_personnes").upsert({ ... })

  return NextResponse.json({ success: true, path: filePath })
}
```

### Avatar Upload with Fallback
```typescript
// Avatar component pattern
<Avatar className="h-20 w-20">
  <AvatarImage src={avatarUrl} alt={`${prenom} ${nom}`} />
  <AvatarFallback className="bg-[#C9A84C] text-[#0D1B2A] text-xl font-bold">
    {prenom?.[0]}{nom?.[0]}
  </AvatarFallback>
</Avatar>
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Not yet configured (no test framework detected in Phase 1) |
| Config file | none — see Wave 0 |
| Quick run command | TBD after framework setup |
| Full suite command | TBD after framework setup |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Basic profile CRUD | integration | API route test | ❌ Wave 0 |
| PROF-03 | Encryption via API Route | unit | Test encrypt/decrypt roundtrip | ❌ Wave 0 |
| PROF-04 | Encrypted storage format | unit | Verify encryptToString output | ❌ Wave 0 |
| PROF-06 | Admin access check | integration | Test admin vs non-admin access | ❌ Wave 0 |
| DOCS-01 | Document upload | integration | API route test with FormData | ❌ Wave 0 |
| DOCS-03 | Document deletion | integration | API route delete test | ❌ Wave 0 |
| DOCS-05 | Signed URL generation | unit | Test createSignedUrl call | ❌ Wave 0 |
| SEC-02 | No service_role on client | manual-only | Code review — grep for imports | N/A |
| SEC-03 | Private bucket config | manual-only | Verify bucket settings in Supabase | N/A |

### Wave 0 Gaps
- [ ] Test framework selection + setup (vitest recommended for Next.js 14)
- [ ] `vitest.config.ts` — configure with path aliases
- [ ] `tests/api/profil.test.ts` — profile API routes
- [ ] `tests/api/documents.test.ts` — document API routes
- [ ] `tests/lib/encryption.test.ts` — encryption roundtrip

## Database Schema Requirements

### New table: `documents_personnes`
```sql
CREATE TABLE documents_personnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id UUID NOT NULL REFERENCES personnes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('carte_identite', 'carte_etudiante', 'carte_vitale', 'preuve_lydia', 'rib')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(personne_id, type) -- one document per type per person
);

-- RLS
ALTER TABLE documents_personnes ENABLE ROW LEVEL SECURITY;

-- User can see own documents
CREATE POLICY "Users can view own documents" ON documents_personnes
  FOR SELECT USING (auth.uid() = personne_id);

-- User can insert own documents  
CREATE POLICY "Users can insert own documents" ON documents_personnes
  FOR INSERT WITH CHECK (auth.uid() = personne_id);

-- User can delete own documents
CREATE POLICY "Users can delete own documents" ON documents_personnes
  FOR DELETE USING (auth.uid() = personne_id);

-- Admin can view all documents (check via profils_types)
CREATE POLICY "Admins can view all documents" ON documents_personnes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM personnes p
      JOIN profils_types pt ON p.profil_type_id = pt.id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );
```

### Add avatar_url to personnes
```sql
ALTER TABLE personnes ADD COLUMN avatar_url TEXT;
```

### Storage bucket setup
```sql
-- Via Supabase dashboard or migration
INSERT INTO storage.buckets (id, name, public) VALUES ('documents-personnes', 'documents-personnes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- avatars can be public (profile photos are not sensitive)

-- Storage RLS for documents-personnes (if using client uploads, otherwise admin client bypasses)
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents-personnes' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## Open Questions

1. **Existing `personnes` column types for encrypted fields**
   - What we know: `database.types.ts` has `nss_encrypted: string | null` and `iban_encrypted: string | null`
   - What's unclear: Actual Supabase column type (TEXT vs BYTEA). Requirements say BYTEA via pgcrypto, but `encryptToString` produces a text string.
   - Recommendation: Use TEXT column type since `encryptToString` returns hex string. If column is BYTEA, either change to TEXT or encode the hex string to bytes.

2. **Avatar bucket public vs private**
   - What we know: Avatars are profile photos, not sensitive
   - What's unclear: Whether public bucket is acceptable (simpler, no signed URLs needed)
   - Recommendation: Make avatars bucket public — profile photos don't need signed URLs. Store `avatar_url` as the public URL directly.

## Sources

### Primary (HIGH confidence)
- Project codebase: `lib/encryption.ts`, `lib/supabase/admin.ts`, `types/database.types.ts`, `hooks/useUser.ts`
- `02-CONTEXT.md` — all user decisions
- `02-UI-SPEC.md` — complete UI contract

### Secondary (MEDIUM confidence)
- Supabase Storage API (signed URLs, bucket config) — based on @supabase/supabase-js v2 API surface
- Next.js 14 Route Handlers — based on project's existing Next.js 14.2.35

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new deps needed
- Architecture: HIGH — follows established Phase 1 patterns, clear API Route structure
- Pitfalls: HIGH — well-known Supabase Storage patterns, encryption already proven

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable stack, no fast-moving dependencies)
