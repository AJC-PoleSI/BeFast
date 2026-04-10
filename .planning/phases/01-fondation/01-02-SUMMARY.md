---
phase: 01-fondation
plan: 02
subsystem: auth
tags: [supabase-auth, middleware, rbac, sidebar, role-guard, nextjs]

requires:
  - phase: 01-fondation-01
    provides: "Supabase SSR/browser clients, SQL schema with profils_types/personnes, shadcn/ui components"
provides:
  - "Full auth flow (login, signup, password reset, signout)"
  - "Middleware protecting dashboard routes with session refresh"
  - "Dashboard layout with permission-filtered sidebar"
  - "RoleGuard client component for page-level access control"
  - "useUser hook with profile, permissions, isAdmin"
  - "TypeScript types for database entities"
  - "StatusBadge component with 5 French status variants"
affects: [profil, missions, etudes, prospection, administration, documents, statistiques]

tech-stack:
  added: []
  patterns: [server-actions-auth, permission-filtered-sidebar, role-guard-pattern, dashboard-shell-client-wrapper]

key-files:
  created:
    - types/database.types.ts
    - hooks/useUser.ts
    - middleware.ts
    - lib/actions/auth.ts
    - app/(auth)/layout.tsx
    - app/(auth)/login/page.tsx
    - app/(auth)/inscription/page.tsx
    - app/(auth)/mot-de-passe-oublie/page.tsx
    - app/(dashboard)/attente/page.tsx
    - app/(dashboard)/layout.tsx
    - app/(dashboard)/dashboard-shell.tsx
    - app/(dashboard)/dashboard/page.tsx
    - components/layout/Sidebar.tsx
    - components/layout/Header.tsx
    - components/layout/RoleGuard.tsx
    - components/ui/status-badge.tsx
    - components/ui/badge.tsx
  modified: []

key-decisions:
  - "DashboardShell client wrapper to pass server-fetched permissions to client Sidebar/Header"
  - "Users without role see bare children (attente page) without sidebar layout"
  - "HTML entities for French accents in JSX to avoid encoding issues"

patterns-established:
  - "Server action pattern for auth (signIn, signUp, signOut, resetPassword)"
  - "Permission-based nav filtering: items absent from DOM when permission is false"
  - "Dashboard layout: server component fetches profile, passes to client shell"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07, ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06, UX-04, UX-05, UX-06, SEC-04]

duration: 4min
completed: 2026-04-10
---

# Phase 01 Plan 02: Auth, Middleware, Sidebar, RoleGuard Summary

**Supabase Auth pages (login/signup/reset) with middleware route protection, permission-filtered sidebar, and RoleGuard access control**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T09:12:02Z
- **Completed:** 2026-04-10T09:16:25Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments
- Complete auth flow: login, signup, password reset, waiting screen, and signout with French copy
- Middleware protecting all dashboard routes with Supabase session refresh
- Dashboard layout with permission-filtered sidebar (9 nav items) and responsive mobile overlay
- RoleGuard component blocking unauthorized page access with French error message
- StatusBadge component with 5 status variants for future phases

## Task Commits

1. **Task 1: Types, hook useUser, middleware, et server actions auth** - `b47e24d` (feat)
2. **Task 2: Pages auth (login, inscription, mot-de-passe-oublie, attente)** - `9d9596a` (feat)
3. **Task 3: Layout dashboard, Sidebar, Header, RoleGuard, StatusBadge** - `bc98083` (feat)

## Files Created/Modified
- `types/database.types.ts` - TypeScript types for Personne, ProfilType, Permissions, NavItem
- `hooks/useUser.ts` - Client hook returning user, profile, permissions, isAdmin
- `middleware.ts` - Route protection with Supabase SSR session refresh
- `lib/actions/auth.ts` - Server actions for signIn, signUp, signOut, resetPassword
- `app/(auth)/layout.tsx` - Auth layout with navy background
- `app/(auth)/login/page.tsx` - Login page with gold CTA and French copy
- `app/(auth)/inscription/page.tsx` - Signup page with 5 fields and admin validation note
- `app/(auth)/mot-de-passe-oublie/page.tsx` - Password reset with Sonner toast feedback
- `app/(dashboard)/attente/page.tsx` - Waiting screen with Clock icon and signout
- `app/(dashboard)/layout.tsx` - Server component fetching profile and permissions
- `app/(dashboard)/dashboard-shell.tsx` - Client wrapper managing sidebar state
- `app/(dashboard)/dashboard/page.tsx` - Dashboard placeholder with greeting
- `components/layout/Sidebar.tsx` - Permission-filtered nav with mobile overlay
- `components/layout/Header.tsx` - Header with hamburger toggle and logout
- `components/layout/RoleGuard.tsx` - Client guard blocking unauthorized access
- `components/ui/status-badge.tsx` - Badge with 5 French status variants
- `components/ui/badge.tsx` - shadcn badge base component

## Decisions Made
- Created DashboardShell client wrapper to bridge server-fetched data to client Sidebar/Header components
- Users without assigned role see only the attente page (no sidebar layout)
- Used HTML entities for French accented characters in JSX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Typed middleware cookiesToSet parameter**
- **Found during:** Task 1
- **Issue:** TypeScript strict mode rejected implicit any on cookiesToSet in middleware
- **Fix:** Imported CookieOptions from @supabase/ssr and typed the parameter
- **Committed in:** b47e24d

**2. [Rule 3 - Blocking] Installed missing shadcn badge component**
- **Found during:** Task 3
- **Issue:** status-badge.tsx imports Badge from @/components/ui/badge which didn't exist
- **Fix:** Ran `npx shadcn@latest add badge`
- **Committed in:** bc98083

**3. [Rule 1 - Bug] Fixed Sidebar icon type mismatch**
- **Found during:** Task 3
- **Issue:** ICON_MAP type incompatible with lucide-react ForwardRef components
- **Fix:** Used LucideIcon type from lucide-react instead of manual type
- **Committed in:** bc98083

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth pages functional and building successfully
- Middleware active on all routes
- Sidebar ready to receive new nav items as features are built
- RoleGuard ready for wrapping future protected pages
- All 17 files compile cleanly with `tsc --noEmit` and `npm run build`

## Self-Check: PASSED

All 17 key files verified present. All 3 task commits verified in git log.

---
*Phase: 01-fondation*
*Completed: 2026-04-10*
