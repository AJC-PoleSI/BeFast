---
phase: 02
slug: profils-documents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest / next test |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test -- --passWithNoTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --passWithNoTests`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROF-01 | integration | `npm test -- --testPathPattern=profil` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | PROF-02/03 | integration | `npm test -- --testPathPattern=sensitive` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DOCS-01/04/05 | integration | `npm test -- --testPathPattern=documents` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | SEC-01/02/03 | e2e-manual | manual — Supabase RLS check | manual | ⬜ pending |
| 02-02-02 | 02 | 2 | PROF-06 | e2e-manual | manual — admin view check | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/profil.test.ts` — stubs for PROF-01 à PROF-06
- [ ] `__tests__/documents.test.ts` — stubs pour DOCS-01 à DOCS-06
- [ ] `__tests__/sensitive.test.ts` — stubs pour chiffrement NSS/IBAN (PROF-02, PROF-03, PROF-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS bloque accès cross-user documents | SEC-01, DOCS-04 | Nécessite 2 sessions Supabase simultanées | Créer 2 comptes, tenter accès aux documents de l'autre |
| URLs signées expirent après 1h | DOCS-05 | Nécessite attente réelle ou mock temps | Générer URL signée, attendre 1h, vérifier 403 |
| Bucket privé inaccessible sans URL signée | DOCS-04 | Test infra Supabase Storage | Accéder au bucket path directement sans signature |
| Admin peut modifier profil d'un autre | PROF-06 | Nécessite 2 rôles différents | Connecté comme admin, modifier profil d'un member |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
