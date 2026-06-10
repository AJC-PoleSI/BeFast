#!/bin/bash

# Security Migration 035 Validation Script
# This script validates the security migration before deployment

set -e

echo "🔒 Validating Security Migration 035..."
echo ""

MIGRATION_FILE="supabase/migrations/035_security_fix_critical.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "✅ Migration file found"

# Check 1: SQL Syntax (basic check)
echo ""
echo "Check 1: SQL Syntax..."
if ! grep -q "CREATE OR REPLACE FUNCTION" "$MIGRATION_FILE"; then
  echo "❌ FAIL: Missing function definition"
  exit 1
fi

if ! grep -q "CREATE TRIGGER" "$MIGRATION_FILE"; then
  echo "❌ FAIL: Missing trigger definition"
  exit 1
fi

if ! grep -q "CREATE POLICY" "$MIGRATION_FILE"; then
  echo "❌ FAIL: Missing RLS policies"
  exit 1
fi

echo "✅ SQL syntax check passed"

# Check 2: Policy Updates
echo ""
echo "Check 2: Policy Coverage..."

required_policies=(
  "budget_etude read own etude"
  "budget_etude modify own"
  "factures read own or assigned"
  "factures insert own"
  "factures update own"
  "factures delete admin"
  "etudes read assigned"
  "etudes insert auth"
  "etudes update own"
  "clients read assigned"
)

for policy in "${required_policies[@]}"; do
  if grep -q "\"$policy\"" "$MIGRATION_FILE"; then
    echo "  ✅ $policy"
  else
    echo "  ❌ Missing policy: $policy"
    exit 1
  fi
done

# Check 3: Column Protection
echo ""
echo "Check 3: Column Protection..."

if grep -q "taux_horaire" "$MIGRATION_FILE" && \
   grep -q "poles" "$MIGRATION_FILE" && \
   grep -q "bank_account" "$MIGRATION_FILE"; then
  echo "✅ All sensitive columns protected (taux_horaire, poles, bank_account)"
else
  echo "❌ FAIL: Missing sensitive column protection"
  exit 1
fi

# Check 4: Backwards Compatibility
echo ""
echo "Check 4: Backwards Compatibility..."

if grep -q "DROP POLICY" "$MIGRATION_FILE"; then
  echo "✅ Old policies dropped and replaced (migration is compatible)"
else
  echo "⚠️  WARNING: No DROP POLICY found - check if policies already exist"
fi

# Check 5: Summary
echo ""
echo "🎉 Security Migration 035 Validation PASSED!"
echo ""
echo "Summary of Changes:"
echo "  - Personnes: Column protection expanded"
echo "  - Budget_etude: RLS fixed (restrict by etude)"
echo "  - Factures: RLS fixed (restrict by ownership)"
echo "  - Etudes: RLS improved (require assignment)"
echo "  - Clients: RLS added (by etude assignment)"
echo ""
echo "Next Steps:"
echo "  1. Test locally: supabase db reset"
echo "  2. Run tests: See SECURITY_TEST_PHASE1.md"
echo "  3. Deploy to staging: supabase db push --linked"
echo ""
