---
phase: 1
slug: fondation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest / vitest (Next.js 14 built-in) |
| **Config file** | jest.config.ts (Wave 0 crée) |
| **Quick run command** | `npm run test -- --passWithNoTests` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --passWithNoTests`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| middleware | 01 | 1 | SEC-04 | integration | `npm run test -- middleware` | ❌ W0 | ⬜ pending |
| auth-login | 01 | 1 | AUTH-04 | e2e-manual | manual browser test | — | ⬜ pending |
| auth-signup | 01 | 1 | AUTH-01 | e2e-manual | manual browser test | — | ⬜ pending |
| role-guard | 01 | 2 | ROLE-06 | unit | `npm run test -- RoleGuard` | ❌ W0 | ⬜ pending |
| sidebar-nav | 01 | 2 | ROLE-05 | unit | `npm run test -- Sidebar` | ❌ W0 | ⬜ pending |
| design-tokens | 01 | 1 | UX-02 | visual | manual check globals.css | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/middleware.test.ts` — stubs pour SEC-04 (route protection)
- [ ] `__tests__/RoleGuard.test.tsx` — stubs pour ROLE-06
- [ ] `__tests__/Sidebar.test.tsx` — stubs pour ROLE-05
- [ ] `jest.config.ts` + `jest.setup.ts` — infrastructure de test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login email/password | AUTH-04 | Nécessite Supabase live | Se connecter sur /login avec un compte test |
| Signup flow | AUTH-01 | Nécessite Supabase live | Créer un compte sur /inscription |
| Écran d'attente | AUTH-03 | Nécessite compte sans rôle | Se connecter avec compte non assigné |
| Sidebar conditionnelle | ROLE-05 | Nécessite sessions multi-rôles | Tester avec 4 profils différents |
| Design palette | UX-02 | Visuel | Inspecter globals.css et vérifier les variables CSS |
| Fonts chargées | UX-03 | Visuel | DevTools Network — Playfair Display + DM Sans présents |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
