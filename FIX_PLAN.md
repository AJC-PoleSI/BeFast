# BeFast Security Fixes — Implementation Plan

**Total Effort** : ~12-15 hours  
**Timeline** : 2-3 days  
**Risk Level** : LOW (RLS is backwards compatible)

---

## Phase 1: CRITICAL FIXES (4-6 hours)

These are mandatory before production. They fix critical privilege escalation and data exposure vulnerabilities.

### 1.1 Deploy SQL Migration (1 hour)

```bash
# Review the migration
cat supabase/migrations/035_security_fix_critical.sql

# Run locally first
supabase db reset

# If all tests pass, push to staging
supabase db push --linked

# Monitor logs for errors
supabase functions logs
```

**What it does:**
- ✅ Expands personnes column protection (taux_horaire, bank_account, poles)
- ✅ Fixes budget_etude RLS (restrict by etude assignment)
- ✅ Fixes factures RLS (restrict by ownership + role)
- ✅ Improves etudes RLS (requires assignment)
- ✅ Adds clients RLS (by etude assignment)

**Testing after deployment:**
```sql
-- Test 1: User cannot read all budgets
SELECT * FROM budget_etude;  -- Should return filtered results only

-- Test 2: User cannot modify taux_horaire
UPDATE personnes SET taux_horaire = 999.99 WHERE id = '...';  
-- Should fail: Unauthorized

-- Test 3: Admin CAN modify taux_horaire
-- (switch to admin user)
UPDATE personnes SET taux_horaire = 999.99 WHERE id = '...';  
-- Should succeed

-- Test 4: User cannot read unassigned factures
SELECT * FROM factures WHERE etude_id NOT IN (
  SELECT id FROM etudes WHERE suiveur_id = auth.uid()
);  
-- Should return empty

-- Test 5: User cannot read unassigned clients
SELECT * FROM clients WHERE id NOT IN (
  SELECT client_id FROM etudes 
  WHERE suiveur_id = auth.uid()
);  
-- Should return empty
```

### 1.2 Add Server-Side Security Library (30 min)

**File**: `lib/supabase-security.ts` (already created)

This exports utilities for:
- `requireRole(supabase, ['administrateur'])`
- `requireAdmin(supabase)`
- `requireOwnership(supabase, 'factures', recordId)`
- `getCurrentUserProfile(supabase)`
- `sanitizeResponse(data, userRole, resourceType)`
- `logAudit(supabase, 'factures', 'INSERT', recordId)`

**No code changes needed yet** — library is ready to use.

### 1.3 Update API Routes (2-3 hours)

Choose the **most critical API routes** first:

**Priority 1: Finance/Admin APIs**
- [ ] `app/api/factures/route.ts` → Use template from `route.example.ts`
- [ ] `app/api/budget/route.ts` (if exists) → Add `requireAdmin` or RLS validation
- [ ] Any expense/notes_de_frais endpoints → Add ownership checks

**Priority 2: Etudes APIs**
- [ ] `app/api/etudes/route.ts` → Add `requireEtudeSuiveur` or similar
- [ ] `app/api/etudes/[id]/route.ts` → Verify suiveur before returning details

**Priority 3: Mission APIs**
- [ ] `app/api/missions/route.ts` → Validate intervenant access
- [ ] `app/api/missions/[id]/route.ts` → Check `requireMissionAccess`

**How to update each route:**

```typescript
// BEFORE (vulnerable)
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data } = await supabase.from('factures').select('*');
  return NextResponse.json(data);
}

// AFTER (secured)
import { getCurrentUserProfile, sanitizeResponse } from '@/lib/supabase-security';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { profile } = await getCurrentUserProfile(supabase);  // ← ADD
    
    const { data } = await supabase.from('factures').select('*');
    const sanitized = sanitizeResponse(data, profile.profils_types.slug, 'factures');  // ← ADD
    return NextResponse.json(sanitized);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
```

**Checklist for each route:**
- [ ] Wrap in try/catch
- [ ] Call `getCurrentUserProfile()` to verify auth
- [ ] Add role-based permission checks if needed
- [ ] Use `sanitizeResponse()` for sensitive data
- [ ] Log access via `logAudit()` for sensitive operations
- [ ] Return 401/403 errors for unauthorized access

---

## Phase 2: HIGH PRIORITY FIXES (3-4 hours)

These improve security and add audit trails. Deploy after Phase 1 is tested.

### 2.1 Add Audit Logging Table (1 hour)

```sql
-- Create audit_logs table
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,  -- SELECT, INSERT, UPDATE, DELETE
  record_id uuid,
  user_id uuid NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES personnes(id) ON DELETE SET NULL
);

-- Index for queries
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- RLS: users can only read their own logs, admins see all
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM personnes p
      JOIN profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );

CREATE POLICY "admin view all logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personnes p
      JOIN profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );
```

### 2.2 Add RLS to `mission_intervenants` (30 min)

```sql
-- Prevent leaking mission team composition
CREATE POLICY "mission_intervenants read assigned"
  ON public.mission_intervenants FOR SELECT TO authenticated
  USING (
    -- Own assignment
    personne_id = auth.uid()
    OR -- Etude suiveur
    mission_id IN (
      SELECT missions.id FROM missions
      JOIN etudes ON etudes.id = missions.etude_id
      WHERE etudes.suiveur_id = auth.uid()
    )
    OR -- Team member on same mission
    mission_id IN (
      SELECT DISTINCT mission_intervenants.mission_id
      FROM mission_intervenants
      WHERE personne_id = auth.uid()
    )
    OR -- Admin
    EXISTS (
      SELECT 1 FROM personnes p
      JOIN profils_types pt ON pt.id = p.profil_type_id
      WHERE p.id = auth.uid() AND pt.slug = 'administrateur'
    )
  );
```

### 2.3 Add Permission Checks to Sensitive Server Actions (1.5 hours)

**Files to update:**
- `lib/actions/proposals.ts` → Add `requireAdmin` before INSERT/UPDATE proposals
- `lib/actions/missions.ts` → Add `requireEtudeSuiveur` before creating missions
- `lib/actions/budget.ts` → Add role checks

**Pattern:**
```typescript
import { requireAdmin, requireEtudeSuiveur } from '@/lib/supabase-security';

export async function updateProposal(etudeId: string, data: any) {
  const supabase = createClient();
  
  // Verify user is etude suiveur
  await requireEtudeSuiveur(supabase, etudeId);
  
  // Now safe to update
  const { data: updated } = await supabase
    .from('proposals')
    .update(data)
    .eq('etude_id', etudeId);
  
  return updated;
}
```

### 2.4 Test All Changes (1 hour)

```bash
# Run locally
npm run dev

# Test API routes with curl
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/factures

# Verify RLS is working:
# - Login as User A
# - Try to access User B's data
# - Should get empty result or 403 error

# Run existing test suite
npm run test
```

---

## Phase 3: MEDIUM PRIORITY (Encryption + Docs)

These are nice-to-have but recommended before sharing production data.

### 3.1 Encrypt Sensitive Fields (2-3 hours)

**Fields to encrypt:**
- `personnes.taux_horaire`
- `personnes.metadata.bank_account`
- `factures.montant_ttc`

**Approach:**
```sql
-- Use pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Modify personnes table
ALTER TABLE personnes ADD COLUMN taux_horaire_encrypted bytea;

-- Migrate existing data
UPDATE personnes SET taux_horaire_encrypted = 
  pgp_sym_encrypt(taux_horaire::text, current_setting('app.encryption_key'));

-- Drop old column
ALTER TABLE personnes DROP COLUMN taux_horaire;
ALTER TABLE personnes RENAME COLUMN taux_horaire_encrypted TO taux_horaire;

-- Decrypt in TypeScript when needed
export async function getTauxHoraire(personneId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .rpc('decrypt_taux_horaire', { personne_id: personneId });
  return data;
}
```

### 3.2 Document Security in README (30 min)

Create `SECURITY.md`:
- Architecture overview (RLS + server-side checks)
- How to add new API routes securely
- Testing checklist
- Incident response procedures

---

## 🚀 Implementation Order

### Week 1 (Monday-Tuesday) — Phase 1
- [ ] Deploy migration 035 to staging
- [ ] Test RLS changes locally
- [ ] Update top 3 API routes (factures, etudes, missions)
- [ ] Integration test

### Week 1 (Wednesday) — Phase 1 & 2 Start
- [ ] Deploy Phase 1 to production (with rollback plan)
- [ ] Monitor audit logs
- [ ] Start Phase 2 (audit table + server action checks)

### Week 2 (Thursday-Friday) — Phase 2 Complete
- [ ] Deploy Phase 2
- [ ] Full security test suite
- [ ] Documentation

### Week 3 (Optional) — Phase 3
- [ ] Encryption (if needed for compliance)
- [ ] Security documentation

---

## ✅ Verification Checklist

After each phase, verify:

**Phase 1 Verification:**
- [ ] User A cannot read all budgets (RLS filters)
- [ ] User A cannot modify their taux_horaire (trigger blocks)
- [ ] User A cannot access unassigned factures (RLS filters)
- [ ] Admin CAN see all data
- [ ] No database errors in logs

**Phase 2 Verification:**
- [ ] All API routes return 401 for unauthenticated
- [ ] All API routes return 403 for unauthorized
- [ ] Audit logs record all operations
- [ ] Server actions validate permissions

**Production Deployment:**
- [ ] Staging tests pass
- [ ] Rollback plan documented
- [ ] Team notified of changes
- [ ] Production deployed with monitoring

---

## 🔄 Rollback Plan

If issues arise:

```bash
# Rollback migration 035
supabase db reset

# Or manually revert
# - Restore previous RLS policies from migrations 030-034
# - Redeploy

# Verify with tests
npm run test
```

---

## 📝 Notes for Team

- **No breaking changes**: RLS is backwards compatible; users just see less data
- **Performance**: RLS subqueries are indexed; minimal impact
- **Testing**: All changes are in staging first
- **Monitoring**: Check Supabase logs after each deployment

---

## Questions?

- **"Will this break existing apps?"** No, RLS just restricts what users see
- **"How long for Phase 1?"** 4-6 hours
- **"Can we do it gradually?"** Yes, Phase 1 is mandatory; Phase 2 & 3 optional
- **"What about RH Manager?"** Same approach, separate migration
