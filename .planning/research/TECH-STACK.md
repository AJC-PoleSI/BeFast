# Tech Stack Research: BeFast — Next.js 14 + Supabase

**Project:** BeFast (Odensia/Audencia Junior-Entreprise internal management app)
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH — based on training knowledge (cutoff Aug 2025). WebSearch/WebFetch unavailable. Cross-verify with official docs before implementing.

---

## 1. Next.js 14 App Router + Supabase Auth SSR (`@supabase/ssr`)

### Overview

The `@supabase/ssr` package (not the deprecated `@supabase/auth-helpers-nextjs`) is the correct choice for App Router. It provides `createServerClient` (for Server Components, Route Handlers, and Middleware) and `createBrowserClient` (for Client Components). Sessions are stored in cookies, not localStorage, enabling SSR.

**Confidence:** HIGH — `@supabase/ssr` was the recommended package as of Supabase docs v2 (2024+).

### Installation

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Client Factory Utilities

Create two utility files. Never import the server client in Client Components.

**`lib/supabase/server.ts`** — for Server Components, Route Handlers, Server Actions

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can't be set.
            // Middleware will handle session refresh instead.
          }
        },
      },
    }
  )
}
```

**`lib/supabase/client.ts`** — for Client Components only

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Middleware — Critical for Session Refresh

The middleware MUST run on every request that touches protected routes. Its job: read the session cookie, refresh it if expired, write the updated cookie back to the response.

**`middleware.ts`** (project root)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not write logic between createServerClient and getUser().
  // A subtle bug can make session refreshes unreliable.
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users from protected routes
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: return supabaseResponse, not NextResponse.next()
  // Otherwise the cookie is not forwarded and the session breaks.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### GOTCHA: `getSession()` vs `getUser()`

- **Never use `getSession()` on the server** to check auth status. It reads from the cookie and does NOT verify the JWT with Supabase servers — it can be spoofed.
- **Always use `getUser()`** on the server. It validates the JWT against Supabase Auth servers on each call. This is the secure pattern.
- `getSession()` is acceptable only in Client Components where you need the full session object (access token, etc.) for client-side logic.

### Server Components — Fetching Authenticated Data

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: projects } = await supabase.from('projects').select('*')

  return <div>{/* render */}</div>
}
```

### Client Components — Reactive Auth State

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function AuthButton() {
  const supabase = createClient()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => setUser(session?.user ?? null)
    )
    return () => subscription.unsubscribe()
  }, [])

  // ...
}
```

### Route Protection Strategy for BeFast

Since BeFast has multiple roles (members, managers, admins), protect at two layers:
1. **Middleware** — unauthenticated redirect to `/login`
2. **Page/Layout level** — role check, redirect to `/unauthorized` if insufficient role

Do NOT rely only on middleware for role checks — it can't efficiently query a `roles` table on every request without adding latency. Use the JWT custom claims approach described in Section 2.

---

## 2. Row Level Security (RLS) — Role-Based Permissions

### The Core Pattern: Custom JWT Claims

For complex role systems, embed the user's role in the JWT access token using a Supabase Database Function triggered as a **custom access token hook**. This avoids a `SELECT` on a roles table for every RLS policy evaluation.

**Confidence:** HIGH — this pattern is documented in Supabase Auth Hooks (available since 2024).

#### Step 1: User roles table

```sql
CREATE TYPE app_role AS ENUM ('member', 'manager', 'admin');

CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL DEFAULT 'member',
  PRIMARY KEY (user_id)
);

-- Allow users to read their own role
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);
```

#### Step 2: Custom access token hook

In Supabase Dashboard → Authentication → Hooks → Custom Access Token:

```sql
CREATE OR REPLACE FUNCTION custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_role app_role;
BEGIN
  SELECT role INTO user_role
    FROM public.user_roles
    WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role::text));
  ELSE
    claims := jsonb_set(claims, '{app_role}', '"member"');
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION custom_access_token_hook FROM authenticated, anon, public;
```

#### Step 3: Helper function for RLS policies

```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'app_role',
    'member'
  )
$$;
```

#### Step 4: RLS policies using the helper

```sql
-- Example: only admins and managers can see all member profiles
CREATE POLICY "managers and admins read all profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() = user_id  -- own profile always visible
    OR public.get_my_role() IN ('manager', 'admin')
  );

-- Example: only admins can update roles
CREATE POLICY "admins update roles"
  ON user_roles FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Example: project visibility based on assignment + role
CREATE POLICY "project select"
  ON projects FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR public.get_my_role() = 'manager'
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
    )
  );
```

### GOTCHA: RLS and service_role bypass

The `service_role` key bypasses ALL RLS policies. Never use it in client-side code. Use it only in Route Handlers on the server (see Section 5). When using the anon or authenticated client, RLS is enforced — this is what you want for normal user operations.

### GOTCHA: RLS doesn't fire on `auth.users` table

You cannot write RLS policies on `auth.users`. Use a `profiles` table in the `public` schema mirrored via trigger:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### GOTCHA: `SECURITY DEFINER` functions

Functions that check roles internally must be marked `SECURITY DEFINER` carefully. `get_my_role()` above is `STABLE` and reads JWT claims directly — it does NOT need `SECURITY DEFINER` because it only reads the request context, not privileged tables. Only use `SECURITY DEFINER` when you need to access data the calling user cannot see.

---

## 3. Supabase Storage — Private Buckets + Signed URLs in Next.js

### Bucket Setup

For sensitive documents (contracts, invoices, IBAN confirmation letters), use **private buckets** — files are not publicly accessible by URL.

In Supabase Dashboard → Storage → New Bucket → uncheck "Public bucket".

Or via SQL:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);
```

### RLS on Storage

Storage objects in private buckets also need RLS policies:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "users upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow admins/managers to read all files, members only own files
CREATE POLICY "role-based file read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (
      public.get_my_role() IN ('admin', 'manager')
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );
```

### Signed URLs in a Route Handler

Never expose file URLs directly. Generate signed URLs server-side with a short TTL.

**`app/api/files/[fileId]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Look up the file path from your DB (don't trust client-provided paths)
  const { data: fileRecord } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', params.fileId)
    .single()

  if (!fileRecord) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Generate a signed URL valid for 60 seconds
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(fileRecord.storage_path, 60)

  if (error || !data) {
    return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
```

### GOTCHA: Signed URL Leakage

Signed URLs contain a token in the query string. They can be shared. Keep TTL short (60s for direct download links, up to 3600s for preview links). Do not log signed URLs. Do not store them in the database.

### GOTCHA: Large File Uploads

For uploads > 6MB, use the Supabase client directly from the browser (Client Component) — Next.js Route Handlers are not designed to buffer large request bodies efficiently. Stream directly to Supabase Storage from the client using the anon key + RLS.

---

## 4. AES-256-GCM Encryption in Node.js — Sensitive Fields (NSS, IBAN)

For fields like NSS (Numéro de Sécurité Sociale) and IBAN, encrypt at the application layer before storing in the database. AES-256-GCM provides authenticated encryption (prevents tampering in addition to confidentiality).

**Confidence:** HIGH — Node.js `crypto` module API is stable.

### Key Setup

Store the encryption key as a 32-byte hex string in environment variables. **Never commit this to source control.**

```bash
# Generate a key (run once, store securely)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
# .env.local (never committed)
ENCRYPTION_KEY=your_64_char_hex_string_here
```

### Encryption Utility

**`lib/encryption.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16  // 128 bits

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export interface EncryptedPayload {
  iv: string        // hex
  ciphertext: string  // hex
  tag: string       // hex
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    tag: tag.toString('hex'),
  }
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey()
  const iv = Buffer.from(payload.iv, 'hex')
  const ciphertext = Buffer.from(payload.ciphertext, 'hex')
  const tag = Buffer.from(payload.tag, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}

// Serialize to a single string for storage in a single DB column
// Format: hex(iv):hex(tag):hex(ciphertext)
export function encryptToString(plaintext: string): string {
  const { iv, tag, ciphertext } = encrypt(plaintext)
  return `${iv}:${tag}:${ciphertext}`
}

export function decryptFromString(encoded: string): string {
  const [iv, tag, ciphertext] = encoded.split(':')
  if (!iv || !tag || !ciphertext) throw new Error('Invalid encrypted format')
  return decrypt({ iv, tag, ciphertext })
}
```

### Database Column Design

Store the serialized encrypted string in a `TEXT` column. Do NOT store the IV or tag in separate columns — keeping them together simplifies queries and prevents partial-write bugs.

```sql
ALTER TABLE profiles ADD COLUMN nss_encrypted TEXT;
ALTER TABLE profiles ADD COLUMN iban_encrypted TEXT;
```

### Usage in a Route Handler

```typescript
import { encryptToString, decryptFromString } from '@/lib/encryption'

// Saving
const nssEncrypted = encryptToString(req.body.nss)
await supabase.from('profiles').update({ nss_encrypted: nssEncrypted }).eq('id', userId)

// Reading (server-side only, never send the raw value to the client unless required)
const { data } = await supabase.from('profiles').select('nss_encrypted').eq('id', userId).single()
const nss = decryptFromString(data.nss_encrypted)
```

### GOTCHA: IV Reuse is Catastrophic for GCM

`randomBytes(12)` generates a new IV for each encryption call. **Never reuse an IV with the same key.** The code above is correct — verify any modification does not cache or reuse IVs.

### GOTCHA: This is App-Layer Encryption, Not DB-Layer

Supabase does not offer transparent column encryption (unlike PostgreSQL's `pgcrypto` with `pgp_sym_encrypt`). The approach above encrypts in Node.js before the data reaches the database. This means:
- You cannot `WHERE nss_encrypted = $1` with plaintext — you must decrypt first or use a deterministic hash for lookups.
- Supabase cannot read the plaintext (good for confidentiality). But if the key is in the same environment that has the DB connection string, a full server compromise exposes both.

### GOTCHA: Key Rotation

Plan for key rotation from day one. Store a `key_version` integer alongside the encrypted value:

```sql
ALTER TABLE profiles ADD COLUMN encryption_key_version INTEGER DEFAULT 1;
```

When rotating keys: re-encrypt all rows with the new key incrementally, then update `key_version`. Support decrypting with old key versions during the transition window.

---

## 5. Server-Only Route Handlers with `service_role_key`

### When to Use `service_role`

Use the service role client ONLY when you need to:
- Bypass RLS intentionally (admin operations, background jobs, cross-user queries)
- Access `auth.users` table metadata
- Perform operations that no authenticated user should be able to perform directly

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** It must only appear in server-side code.

### Service Role Client Factory

**`lib/supabase/admin.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

// This module must never be imported in Client Components.
// Add 'server-only' guard:
import 'server-only'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
```

The `server-only` package causes a build error if this file is imported in a Client Component or any file that could be bundled client-side.

```bash
npm install server-only
```

### Secure Route Handler Pattern

**`app/api/admin/users/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Step 1: Authenticate the caller with the user client (validates JWT)
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 2: Authorize — check role from JWT claims
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Step 3: Use admin client for privileged operation
  const adminSupabase = createAdminClient()
  const { data: users, error } = await adminSupabase.auth.admin.listUsers()

  if (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ users })
}
```

### GOTCHA: Always Authenticate Before Using Admin Client

A common mistake: the Route Handler is reachable without authentication, and developers assume "it's server-side so it's safe." Route Handlers are HTTP endpoints — they are reachable by anyone who can hit your server. Always call `supabase.auth.getUser()` first with the user client before using the admin client.

### GOTCHA: `NEXT_PUBLIC_` Prefix Leaks to Browser Bundle

- `NEXT_PUBLIC_SUPABASE_URL` — safe to expose (it's the public URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose (it's the public anon key, protected by RLS)
- `SUPABASE_SERVICE_ROLE_KEY` — NO `NEXT_PUBLIC_` prefix. It must never appear in the browser bundle.
- `ENCRYPTION_KEY` — NO `NEXT_PUBLIC_` prefix.

### GOTCHA: Route Handler Caching

In Next.js 14 App Router, `GET` Route Handlers that call `cookies()` or `headers()` are automatically dynamic (not cached). This is correct behavior for authenticated endpoints — no action needed. But if you add `export const dynamic = 'force-static'`, caching will break auth.

---

## 6. Environment Variables Summary

```env
# Public (safe for browser bundle)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Private (server-side only — never NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_KEY=64_char_hex_string_for_aes256
```

---

## 7. Recommended Project Structure

```
app/
  (auth)/
    login/page.tsx
    callback/route.ts        # OAuth/magic link callback handler
  (app)/
    layout.tsx               # checks auth, provides user context
    dashboard/page.tsx
    admin/
      layout.tsx             # checks admin role, redirects otherwise
      users/page.tsx
  api/
    files/[fileId]/route.ts  # signed URL generation
    admin/
      users/route.ts         # service_role operations

lib/
  supabase/
    client.ts                # createBrowserClient (Client Components)
    server.ts                # createServerClient (Server Components, Route Handlers)
    admin.ts                 # createAdminClient (service_role, server-only)
  encryption.ts              # AES-256-GCM utilities (server-only)

middleware.ts                # session refresh + unauthenticated redirect
```

---

## 8. Key Warnings Summary

| Area | Warning |
|------|---------|
| Auth | Use `getUser()` not `getSession()` on server — the latter is spoofable |
| Auth | Return `supabaseResponse` from middleware, not `NextResponse.next()` |
| RLS | `service_role` bypasses ALL RLS — never use it client-side |
| RLS | `get_my_role()` reads JWT claims — requires the custom access token hook to work |
| Storage | Keep signed URL TTL short (60s for downloads) |
| Storage | Do not log or persist signed URLs |
| Encryption | Never reuse an IV with GCM — always call `randomBytes(12)` per encryption |
| Encryption | Plan key rotation with a `key_version` column from day one |
| Encryption | App-layer encryption prevents DB-level search on encrypted fields |
| Route Handlers | Always authenticate with user client BEFORE using admin client |
| Env vars | `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEY` must never have `NEXT_PUBLIC_` prefix |

---

## 9. Sources & Confidence

| Topic | Confidence | Notes |
|-------|------------|-------|
| `@supabase/ssr` middleware pattern | HIGH | Stable API since 2024, widely documented pattern |
| `getUser()` vs `getSession()` | HIGH | Supabase security recommendation, stable |
| Custom access token hook for JWT claims | HIGH | Supabase Auth Hooks feature, available since 2024 |
| RLS `get_my_role()` helper | HIGH | Standard pattern for JWT claim RLS |
| Storage signed URLs | HIGH | Core Supabase Storage API |
| AES-256-GCM with Node.js `crypto` | HIGH | Node.js stable built-in API |
| `server-only` package for admin client | HIGH | Next.js official recommendation |
| Key rotation `key_version` pattern | MEDIUM | Best practice, implementation varies by project |

**Verification recommended:** Check current `@supabase/ssr` package README on npm and the Supabase Auth Hooks documentation before implementing the custom access token hook — hook registration UI/SQL may have evolved since training data cutoff.
