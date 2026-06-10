# Phase 1 Security Testing Plan

## Pre-flight Checks

### 1. Verify Migration 035 SQL Syntax
```bash
# Check for SQL errors (dry-run)
psql -h localhost -U postgres -d postgres -f supabase/migrations/035_security_fix_critical.sql --dry-run 2>&1 | head -20
```

**Expected**: No syntax errors

---

## Local Testing Workflow

### Option A: Test with Supabase CLI (Recommended)

```bash
# 1. Reset local database to latest schema
supabase db reset

# 2. This will:
#    - Drop all tables
#    - Replay migrations 001-035
#    - Create seed data (if any)

# 3. Check status
supabase status

# 4. Start local instance
supabase start
```

### Option B: Test with Docker Postgres (Manual)

```bash
# If using Docker
docker ps
docker exec supabase_db_1 psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/035_security_fix_critical.sql
```

---

## Automated RLS Tests

Create file: `supabase/tests/rls-security.test.sql`

```sql
-- Test 1: User cannot read all budgets
-- Expected: Only budgets for etudes where user is suiveur or intervenant
BEGIN;

SET jwt.claims = '{"sub":"user-a-id","role":"authenticated"}';
SELECT COUNT(*) FROM budget_etude;  
-- Should return 0 or small number, NOT all budgets

ROLLBACK;

-- Test 2: User cannot modify taux_horaire
-- Expected: UPDATE fails with trigger error
BEGIN;

SET jwt.claims = '{"sub":"user-a-id","role":"authenticated"}';
UPDATE personnes SET taux_horaire = 999.99 WHERE id = 'user-a-id';
-- Should fail: "Unauthorized: cannot modify role, status, verification, hourly rate, poles, or bank account"

ROLLBACK;

-- Test 3: User CAN modify non-protected fields
-- Expected: UPDATE succeeds
BEGIN;

SET jwt.claims = '{"sub":"user-a-id","role":"authenticated"}';
UPDATE personnes SET prenom = 'Updated' WHERE id = 'user-a-id';
-- Should succeed

ROLLBACK;

-- Test 4: User cannot access unassigned factures
-- Expected: RLS filters to their own only
BEGIN;

SET jwt.claims = '{"sub":"user-a-id","role":"authenticated"}';
SELECT COUNT(*) FROM factures WHERE created_by_id != 'user-a-id';
-- Should return 0 (RLS filtered out)

ROLLBACK;

-- Test 5: Admin CAN modify taux_horaire
-- Expected: UPDATE succeeds (admin has special privilege)
BEGIN;

SET jwt.claims = '{"sub":"admin-id","role":"authenticated"}';
-- Must set jwt.claims with admin user who has profil_type_id = 'administrateur'
UPDATE personnes SET taux_horaire = 999.99 WHERE id = 'some-user';
-- Should succeed

ROLLBACK;

-- Test 6: Etudes restricted to followers or intervenants
-- Expected: Only assigned etudes visible
BEGIN;

SET jwt.claims = '{"sub":"user-a-id","role":"authenticated"}';
SELECT COUNT(*) FROM etudes WHERE suiveur_id != 'user-a-id' 
  AND id NOT IN (SELECT etudes.id FROM etudes 
                 JOIN missions ON missions.etude_id = etudes.id
                 JOIN mission_intervenants ON mission_intervenants.mission_id = missions.id
                 WHERE mission_intervenants.personne_id = 'user-a-id');
-- Should return 0 (RLS filtered)

ROLLBACK;

-- Test 7: Clients restricted to etudes assigned to user
-- Expected: No unauthorized clients visible
BEGIN;

SET jwt.claims = '{"sub":"user-a-id","role":"authenticated"}';
SELECT COUNT(*) FROM clients WHERE id NOT IN (
  SELECT DISTINCT clients.id FROM clients
  JOIN etudes ON etudes.client_id = clients.id
  WHERE etudes.suiveur_id = 'user-a-id'
    OR etudes.id IN (
      SELECT missions.etude_id FROM missions
      JOIN mission_intervenants ON mission_intervenants.mission_id = missions.id
      WHERE mission_intervenants.personne_id = 'user-a-id'
    )
);
-- Should return 0 (RLS filtered)

ROLLBACK;
```

---

## Manual Testing with API Routes

### Test Setup
```bash
# 1. Start dev server
npm run dev

# 2. Create test user token (get from Supabase dashboard or CLI)
export JWT_TOKEN="eyJhbGc..."

# 3. Run tests
```

### Test 1: User A cannot read all budgets
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/budget_etude \
  | jq '.[] | select(.etude_id not in [...])'
# Expected: Empty array or filtered results only
```

### Test 2: User A cannot modify taux_horaire
```bash
curl -X PATCH -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taux_horaire": 999.99}' \
  http://localhost:3000/api/profil \
  | jq '.error'
# Expected: "Unauthorized: cannot modify... hourly rate"
```

### Test 3: User A cannot read unassigned factures
```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/factures \
  | jq '.[] | select(.created_by_id != "'$USER_ID'")'
# Expected: Empty or only user's own factures
```

### Test 4: Admin CAN modify taux_horaire
```bash
# Switch to admin token
export ADMIN_TOKEN="eyJhbGc..."

curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taux_horaire": 999.99}' \
  http://localhost:3000/api/profil \
  | jq '.'
# Expected: Success, field updated
```

---

## Verification Checklist

After deploying migration 035:

- [ ] Database reset/migration succeeds (`supabase db reset`)
- [ ] No SQL syntax errors in migration 035
- [ ] No TypeScript compilation errors
- [ ] User A cannot read all budgets
- [ ] User A cannot modify taux_horaire
- [ ] User A cannot modify poles
- [ ] User A cannot modify bank_account
- [ ] User A cannot access unassigned factures
- [ ] User A cannot access unassigned etudes
- [ ] User A cannot access unassigned clients
- [ ] Admin CAN modify all protected fields
- [ ] Admin CAN read all data
- [ ] Non-protected fields still editable by users (prenom, nom, etc.)
- [ ] API returns 401 for unauthenticated requests
- [ ] API returns 403 for unauthorized access

---

## Rollback Plan

If tests fail:

```bash
# Option 1: Reset to previous state
supabase db reset

# Option 2: Manually rollback migration 035
# - Delete supabase/migrations/035_security_fix_critical.sql
# - Run: supabase db push

# Option 3: Drop trigger manually
psql -h localhost -U postgres -d postgres <<EOF
DROP TRIGGER IF EXISTS trg_guard_personnes_protected_columns ON public.personnes;
DROP FUNCTION IF EXISTS public.guard_personnes_protected_columns();
EOF
```

---

## Deployment to Staging

Once local tests pass:

```bash
# 1. Make sure your branch is up to date
git fetch origin main
git rebase origin/main

# 2. Push branch
git push origin claude/wonderful-kalam-cf5c19

# 3. Connect to staging Supabase
supabase link --project-ref <STAGING_PROJECT_ID>

# 4. Push migration to staging
supabase db push --linked

# 5. Verify in staging
# - Check Supabase dashboard → SQL Editor
# - Run same tests against staging

# 6. Monitor logs
supabase functions logs
```

---

## Common Issues & Solutions

### Issue: "permission denied for schema public"
**Solution**: Ensure you're logged in with correct Supabase project
```bash
supabase projects list
supabase link --project-ref <PROJECT_ID>
```

### Issue: "trigger already exists"
**Solution**: Migration has `DROP TRIGGER IF EXISTS` but check for orphaned triggers
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trg_guard_personnes_protected_columns';
```

### Issue: "function does not exist"
**Solution**: Check function was created in previous migration
```sql
SELECT * FROM pg_proc WHERE proname = 'guard_personnes_protected_columns';
```

### Issue: "Policy does not exist" errors
**Solution**: These are normal if policies are being dropped and recreated. Migration handles this.

---

## Next Steps After Phase 1 Passes

1. ✅ Phase 1 migration deployed and tested
2. ⏳ Start Phase 2: Update API routes
3. ⏳ Start Phase 3: Audit logging + encryption

All done? Move to task #2 (Update API Routes).
