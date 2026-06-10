# BeFast — Audit de Sécurité Supabase Auth/RLS

**Date** : 2026-06-10  
**Scope** : Auth, RLS policies, données sensibles  
**Status** : 🔴 **3 failles CRITIQUES**, 5 failles ÉLEVÉES

---

## 📊 État RLS

| Table | RLS Enabled | Policies | Status |
|-------|-----------|----------|--------|
| personnes | ✅ | 6 (encrypted data) | ✅ OK |
| etudes | ✅ | 4 (encrypted data) | ✅ OK |
| missions | ✅ | 3 (encrypted data) | ✅ OK |
| factures | ✅ | 3 policies | ⚠️ Issue |
| notes_de_frais | ✅ | 2 (user manage own) | ✅ OK |
| budget_etude | ✅ | 1 policy | 🔴 CRITICAL |
| proposals | ✅ | 2 policies | 🔴 CRITICAL |
| proposal_phases | ✅ | 1 policy | 🔴 CRITICAL |
| support_tickets | ✅ | 3 policies | ✅ OK |
| candidatures | ✅ | 4 policies | ✅ OK |
| documents | ✅ | 4 policies | ✅ OK |

**Summary** : 53% tables with proper RLS (10/19 critical tables)

---

## 🔴 FAILLES CRITIQUES

### 1. **ESCALADE DE PRIVILÈGES SUR `personnes` TABLE** (PARTIELLEMENT FIXÉE)
**Severity** : CRITICAL  
**Location** : supabase/migrations/034_rls_hardening.sql (line 25-63)  
**Issue** :
- Un trigger `guard_personnes_protected_columns` bloque SOME modifications
- Mais le trigger ne protège que 5 colonnes : `profil_type_id`, `account_status`, `email_verified`, `verification_token_hash`, `verification_token_expires_at`
- **Autres colonnes sensibles non protégées** : `poles`, `taux_horaire`, `bank_account`, `phone_number`
- Any authenticated user can UPDATE these columns without restrictions

**Proof of Concept** :
```sql
-- User can self-update sensitive data without triggering guard
UPDATE personnes 
SET taux_horaire = 999.99 
WHERE id = auth.uid();  -- ✅ ALLOWED (no guard)

-- But not this (it's guarded)
UPDATE personnes 
SET profil_type_id = (SELECT id FROM profils_types WHERE slug = 'administrateur') 
WHERE id = auth.uid();  -- ❌ BLOCKED by trigger
```

**Impact** : Users can fake their hourly rates, bank accounts, and pole assignments

---

### 2. **`budget_etude` TABLE — ANYONE CAN READ ALL BUDGETS**
**Severity** : CRITICAL  
**Location** : supabase/migrations/034_rls_hardening.sql (line 73-77)  
**Policy** :
```sql
CREATE POLICY "auth read budget_etude"
  ON public.budget_etude FOR SELECT TO authenticated USING (true);
```

**Issue** : Every authenticated user can read ALL budget data for all studies
- No filtering by `etude_id` or user role
- Budget is sensitive financial data (should be visible only to assigned users + admin)

**Impact** : Full budget data leak

---

### 3. **`proposals` & `proposal_phases` — INSUFFICIENT WRITE CONTROLS**
**Severity** : CRITICAL  
**Location** : supabase/migrations/034_rls_hardening.sql (line 79-88)  
**Status** : Migration 034 removed INSERT/UPDATE policies, but:
- Relies entirely on server-side controls (service_role bypass)
- If someone calls REST API directly with bypassed checks → can insert proposals without RLS validation

**Impact** : Direct REST API calls can create proposals without ownership checks

---

## ⚠️ FAILLES ÉLEVÉES

### 4. **`factures` TABLE — EXCESSIVE READ ACCESS**
**Location** : supabase/migrations/005_clients_etudes_missions.sql  
**Policy** :
```sql
CREATE POLICY "authenticated read factures" ON public.factures 
FOR SELECT TO authenticated USING (true);
```

**Issue** : Every authenticated user can read all invoices
- Should be restricted to : invoice creator, etude suiveur, admin only

**Impact** : Finance data leak

---

### 5. **`etudes` & `clients` — MISSING OBJECT-LEVEL OWNERSHIP CHECK**
**Location** : supabase/migrations/005_clients_etudes_missions.sql  
**Policies** :
```sql
CREATE POLICY "authenticated read etudes" ON public.etudes 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read clients" ON public.clients 
FOR SELECT TO authenticated USING (true);
```

**Issue** : No filtering by user role or assignment
- Policy `"users_can_read_own_etude_encrypted_data"` (migration 023) has correct logic BUT:
  - Uses subqueries that may not trigger due to policy precedence
  - Falls back to `USING (true)` for non-encrypted reads

**Impact** : Users can read all etudes/clients details (even ones they're not assigned to)

---

### 6. **NO SERVICE ROLE PROTECTION ON API ROUTES**
**Location** : All app/api/* routes  
**Issue** :
- API routes call `createClient()` (server-side, with service_role)
- No column-level restrictions in code (relies on RLS alone)
- Missing server-side permission checks for sensitive operations

**Example** : `/api/profil/route.ts` updates user profile via service_role without checking which columns were modified

**Impact** : Server actions can bypass RLS if the code has a bug

---

### 7. **MISSING RLS ON `mission_intervenants` JUNCTION TABLE**
**Issue** : No explicit RLS policies found
- Intervenants can see which other intervenants are assigned to missions
- Could leak team composition data

---

### 8. **NO ENCRYPTION OF SENSITIVE FIELDS**
**Location** : Not implemented  
**Fields at risk** : `taux_horaire`, `bank_account`, `phone_number`, budget amounts  
**Issue** : RLS is the only protection; data is readable in database plaintext

---

## ✅ WHAT'S WORKING

- ✅ **Mission Access** : Encrypted data policy correctly filters by `mission_intervenants`
- ✅ **Note de Frais** : User can only read/modify their own expenses
- ✅ **Support Tickets** : Properly filtered to `utilisateur_id = auth.uid()`
- ✅ **Candidatures** : User read/write policies are scoped correctly
- ✅ **Documents** : Ownership checks via `users_read_own_documents` policy

---

## 📋 FIX PLAN (Priority Order)

### Phase 1 : CRITICAL FIXES (4-6 hours)

#### 1.1 Expand Column Protection on `personnes`
```sql
-- Modify trigger to protect ALL sensitive columns
CREATE OR REPLACE FUNCTION public.guard_personnes_protected_columns()
RETURNS trigger AS $$
BEGIN
  IF /* is admin */ THEN RETURN NEW; END IF;
  
  -- Forbidden columns for non-admins
  IF NEW.profil_type_id != OLD.profil_type_id
     OR NEW.account_status != OLD.account_status
     OR NEW.email_verified != OLD.email_verified
     OR NEW.poles != OLD.poles  -- ADD THIS
     OR NEW.taux_horaire != OLD.taux_horaire  -- ADD THIS
     OR NEW.bank_account != OLD.bank_account  -- ADD THIS
     THEN
    RAISE EXCEPTION 'Unauthorized column modification';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 1.2 Fix `budget_etude` RLS
```sql
DROP POLICY "auth read budget_etude" ON public.budget_etude;
CREATE POLICY "budget_etude read own etude"
  ON public.budget_etude FOR SELECT TO authenticated
  USING (
    -- User is etude suiveur
    etude_id IN (
      SELECT id FROM etudes WHERE suiveur_id = auth.uid()
    )
    OR -- User is intervenant on etude
    etude_id IN (
      SELECT DISTINCT etudes.id FROM etudes
      JOIN missions ON missions.etude_id = etudes.id
      JOIN mission_intervenants ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = auth.uid()
    )
    OR -- Admin
    EXISTS (SELECT 1 FROM personnes WHERE id = auth.uid() 
            AND profil_type_id IN (SELECT id FROM profils_types WHERE slug = 'administrateur'))
  );
```

#### 1.3 Fix `factures` RLS
```sql
DROP POLICY "authenticated read factures" ON public.factures;
CREATE POLICY "factures read own"
  ON public.factures FOR SELECT TO authenticated
  USING (
    -- Created by user
    created_by_id = auth.uid()
    OR -- Etude suiveur
    etude_id IN (SELECT id FROM etudes WHERE suiveur_id = auth.uid())
    OR -- Admin
    EXISTS (SELECT 1 FROM personnes WHERE id = auth.uid() 
            AND profil_type_id IN (SELECT id FROM profils_types WHERE slug = 'administrateur'))
  );
```

#### 1.4 Fix `etudes` & `clients` RLS
```sql
DROP POLICY "authenticated read etudes" ON public.etudes;
CREATE POLICY "etudes read owned"
  ON public.etudes FOR SELECT TO authenticated
  USING (
    suiveur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM missions
      JOIN mission_intervenants ON missions.id = mission_intervenants.mission_id
      WHERE missions.etude_id = etudes.id
      AND mission_intervenants.personne_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM personnes WHERE id = auth.uid() 
              AND profil_type_id IN (SELECT id FROM profils_types WHERE slug = 'administrateur'))
  );

DROP POLICY "authenticated read clients" ON public.clients;
CREATE POLICY "clients read assigned"
  ON public.clients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM etudes
      WHERE etudes.client_id = clients.id
      AND (etudes.suiveur_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM missions m
          JOIN mission_intervenants mi ON m.id = mi.mission_id
          WHERE m.etude_id = etudes.id AND mi.personne_id = auth.uid()
        )
      )
    )
    OR EXISTS (SELECT 1 FROM personnes WHERE id = auth.uid() 
              AND profil_type_id IN (SELECT id FROM profils_types WHERE slug = 'administrateur'))
  );
```

### Phase 2 : HIGH PRIORITY FIXES (3-4 hours)

#### 2.1 Add RLS to `mission_intervenants`
```sql
CREATE POLICY "mission_intervenants read own"
  ON public.mission_intervenants FOR SELECT TO authenticated
  USING (
    personne_id = auth.uid()
    OR EXISTS (SELECT 1 FROM missions m WHERE m.id = mission_intervenants.mission_id
              AND (m.etude_id IN (SELECT id FROM etudes WHERE suiveur_id = auth.uid())
              OR EXISTS (SELECT 1 FROM mission_intervenants mi2 
                         WHERE mi2.mission_id = m.id AND mi2.personne_id = auth.uid())))
    OR EXISTS (SELECT 1 FROM personnes WHERE id = auth.uid() 
              AND profil_type_id IN (SELECT id FROM profils_types WHERE slug = 'administrateur'))
  );
```

#### 2.2 Add Server-Side Permission Checks
```typescript
// lib/supabase-security.ts (NEW FILE)
export async function requireRole(supabase: SupabaseClient, roles: string[]) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('personnes')
    .select('profils_types(slug)')
    .eq('id', user.id)
    .single();
  
  if (!roles.includes(profile.profils_types.slug)) {
    throw new Error('Unauthorized');
  }
  return profile;
}

export async function requireOwnership(
  supabase: SupabaseClient,
  table: string,
  id: string,
  ownerField: string = 'created_by_id'
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(table)
    .select(ownerField)
    .eq('id', id)
    .single();
  
  if (error || data[ownerField] !== user.id) {
    throw new Error('Unauthorized');
  }
}
```

#### 2.3 Update API Routes to Use Permission Checks
```typescript
// app/api/factures/route.ts (EXAMPLE)
import { requireRole } from '@/lib/supabase-security';

export async function GET(req: Request) {
  const supabase = createClient();
  await requireRole(supabase, ['administrateur']);  // Only admins see all
  
  const { data } = await supabase.from('factures').select('*');
  return Response.json(data);
}
```

### Phase 3 : MEDIUM PRIORITY (Encryption + Audit Logging)

#### 3.1 Encrypt Sensitive Fields
- Use `pgtap_crypto` to encrypt `taux_horaire`, `bank_account`
- Decrypt server-side only when needed

#### 3.2 Add Audit Logging
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY,
  table_name text,
  operation text,
  user_id uuid,
  old_values jsonb,
  new_values jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Triggers on all sensitive tables
```

---

## 🧪 TESTING CHECKLIST

- [ ] User A cannot read User B's missions
- [ ] User A cannot read budget_etude for etudes they're not on
- [ ] User A cannot UPDATE their own `profil_type_id` to admin
- [ ] User A cannot UPDATE their `taux_horaire`
- [ ] Invoices visible only to creator + etude suiveur + admin
- [ ] API routes reject calls without proper permissions
- [ ] Service role bypass is wrapped in permission checks

---

## 📌 NEXT STEPS

1. **Review with team** (30 min)
2. **Implement Phase 1** (4-6 hrs) → Test immediately
3. **Implement Phase 2** (3-4 hrs) → Deploy to staging
4. **Implement Phase 3** (2-3 hrs) → Backlog encryption

**Total effort** : ~12-15 hours → 2-3 days of focused work

---

## ⚠️ DEPLOYMENT NOTES

- Migrations are **backwards compatible** (don't break existing reads)
- Phase 1 fixes must be deployed before exposing REST API to users
- Test with `curl + JWT` to verify RLS is working
- Monitor Supabase audit logs after deployment
