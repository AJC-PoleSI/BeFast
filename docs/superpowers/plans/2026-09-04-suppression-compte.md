# Suppression de compte — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un membre BeFast ou à un candidat RH de demander la suppression de son compte depuis son profil, et à un administrateur BeFast de l'exécuter réellement.

**Architecture:** Deux dépôts indépendants. Le bouton côté utilisateur n'efface rien : il crée une trace et notifie `systeme.info@ajc-mail.com`. Côté administrateur, la suppression coupe l'accès, purge les données personnelles et anonymise la ligne `personnes`, qui n'est jamais effacée — `notes_de_frais`, `mission_collaborations` et `candidatures` cascadent depuis elle.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + Auth + Storage), Scaleway S3, Resend/Brevo, vitest.

**Spec de référence :** `docs/superpowers/specs/2026-09-04-suppression-compte-design.md`

---

## Précautions communes à toutes les tâches

**Les deux dépôts ont du travail en cours non commité, et BeFast a des fichiers
déjà indexés qui ne sont pas les nôtres.** Ne jamais utiliser `git add -A` ni
`git add .`.

Surtout : `git add <chemins> && git commit -m "…"` ne suffit pas — `git commit`
sans limitation commite **tout l'index**, y compris ce qui s'y trouvait déjà.
Chaque commit de ce plan se termine donc par `-- <chemins>`, qui implique
`--only` et restreint le commit à ces seuls fichiers. Après chaque commit,
vérifier avec `git show --stat -M HEAD` que seuls les fichiers de la tâche y
figurent, et avec `git status --short` que le travail du tiers est toujours là,
non commité.

Les deux dépôts utilisent vitest sans fichier de configuration : les tests
importent le module testé **par chemin relatif** (`./purge`), jamais par
l'alias `@/`, qui ne serait pas résolu à l'exécution. Les imports de *types*
peuvent utiliser `@/` puisqu'ils disparaissent à la compilation.

Ne pas ajouter `import "server-only"` dans un module couvert par des tests :
le paquet lève une erreur lorsqu'il est chargé hors du runtime serveur.

## Structure des fichiers

### BeFast (`~/Desktop/Befast`)

| Fichier | Responsabilité |
|---|---|
| `lib/account-deletion/request.ts` | *(nouveau, pur, testé)* fenêtre anti-doublon d'une demande |
| `lib/account-deletion/request.test.ts` | *(nouveau)* tests de la fenêtre anti-doublon |
| `lib/account-deletion/purge.ts` | *(nouveau, pur, testé)* patch d'anonymisation d'une personne |
| `lib/account-deletion/purge.test.ts` | *(nouveau)* tests du patch |
| `lib/account-deletion/delete-account.ts` | *(nouveau, serveur)* orchestration de la suppression |
| `lib/email/templates.ts` | *(modifié)* gabarit de l'email de demande |
| `app/api/profil/delete-request/route.ts` | *(nouveau)* `POST` — demande utilisateur |
| `app/(dashboard)/dashboard/profil/_components/delete-account-request.tsx` | *(nouveau)* lien discret + modale |
| `app/(dashboard)/dashboard/profil/page.tsx` | *(modifié)* insertion du composant |
| `app/api/admin/personnes/[id]/route.ts` | *(modifié)* handler `DELETE` |
| `app/(dashboard)/administration/membres/_components/MembresTab.tsx` | *(modifié)* filtre, action et modale de suppression |
| `supabase/migrations/059_account_status_deleted.sql` | *(nouveau)* statut `deleted` |

### RH Manager (`~/Desktop/RH Manager Anti/frontend`)

| Fichier | Responsabilité |
|---|---|
| `src/lib/html.ts` | *(nouveau, pur, testé)* échappement HTML |
| `src/lib/html.test.ts` | *(nouveau)* tests d'échappement |
| `src/lib/resend.ts` | *(modifié)* `sendAccountDeletionRequestEmail()` |
| `src/app/api/candidates/delete-request/route.ts` | *(nouveau)* `POST` — demande candidat |
| `src/components/candidates/DeleteAccountRequest.tsx` | *(nouveau)* lien discret + modale |
| `src/app/candidates/profile/page.tsx` | *(modifié)* insertion du composant |

---

### Task 0 : Branches de travail

**Files:** aucun

- [ ] **Step 1: Créer la branche dans BeFast**

Le dépôt est sur `main` avec des modifications en cours ; `checkout -b` les
conserve telles quelles sur la nouvelle branche.

```bash
cd ~/Desktop/Befast && git checkout -b feat/suppression-compte
```

Attendu : `Switched to a new branch 'feat/suppression-compte'`

- [ ] **Step 2: Créer la branche dans RH Manager**

```bash
cd ~/Desktop/"RH Manager Anti" && git checkout -b feat/suppression-compte
```

Attendu : `Switched to a new branch 'feat/suppression-compte'`

---

### Task 1 : Fenêtre anti-doublon (BeFast)

Une demande de suppression par personne et par 24 heures. Fonction pure, donc
testable sans base.

**Files:**
- Create: `lib/account-deletion/request.ts`
- Test: `lib/account-deletion/request.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/account-deletion/request.test.ts` :

```ts
import { describe, it, expect } from "vitest"
import { isDuplicateRequest, DUPLICATE_WINDOW_MS, DELETION_TICKET_TYPE } from "./request"

const NOW = new Date("2026-09-04T12:00:00.000Z")

describe("isDuplicateRequest", () => {
  it("laisse passer une première demande", () => {
    expect(isDuplicateRequest(null, NOW)).toBe(false)
    expect(isDuplicateRequest(undefined, NOW)).toBe(false)
  })

  it("bloque une demande émise il y a moins de 24 h", () => {
    const recente = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
    expect(isDuplicateRequest(recente, NOW)).toBe(true)
  })

  it("laisse repasser une demande émise il y a plus de 24 h", () => {
    const ancienne = new Date(NOW.getTime() - DUPLICATE_WINDOW_MS - 1000).toISOString()
    expect(isDuplicateRequest(ancienne, NOW)).toBe(false)
  })

  it("ne bloque pas l'utilisateur sur une date illisible", () => {
    expect(isDuplicateRequest("pas-une-date", NOW)).toBe(false)
  })
})

describe("DELETION_TICKET_TYPE", () => {
  it("est la valeur écrite dans support_tickets.type_probleme", () => {
    expect(DELETION_TICKET_TYPE).toBe("suppression_compte")
  })
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
cd ~/Desktop/Befast && npx vitest run lib/account-deletion/request.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./request"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/account-deletion/request.ts` :

```ts
/**
 * Demande de suppression de compte émise par l'utilisateur lui-même.
 *
 * La demande ne supprime rien : elle laisse une trace dans `support_tickets`
 * et notifie l'administration, qui exécute la suppression depuis BeFast.
 */

/** Une demande par personne et par 24 h ; au-delà, l'utilisateur peut relancer. */
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Valeur écrite dans `support_tickets.type_probleme`. */
export const DELETION_TICKET_TYPE = "suppression_compte"

/**
 * Vrai si une demande précédente est trop récente pour en accepter une autre.
 * Une date absente ou illisible ne bloque jamais l'utilisateur : mieux vaut un
 * email en double qu'une demande de suppression avalée en silence.
 */
export function isDuplicateRequest(
  lastCreatedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastCreatedAt) return false
  const previous = new Date(lastCreatedAt).getTime()
  if (Number.isNaN(previous)) return false
  return now.getTime() - previous < DUPLICATE_WINDOW_MS
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

```bash
cd ~/Desktop/Befast && npx vitest run lib/account-deletion/request.test.ts
```

Attendu : `Test Files  1 passed` — 5 tests passés.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/Befast && git add lib/account-deletion/request.ts lib/account-deletion/request.test.ts && git commit -m "feat(suppression-compte): fenetre anti-doublon des demandes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- lib/account-deletion/request.ts lib/account-deletion/request.test.ts
```

---

### Task 2 : Gabarit de l'email de demande (BeFast)

Le gabarit rejoint `lib/email/templates.ts` avec ses onze voisins, dont il
réutilise `esc()` et `brandedEmail()`. Comme eux, il n'est pas testé
unitairement : c'est de la présentation, vérifiée à l'usage en Task 4.

**Files:**
- Modify: `lib/email/templates.ts` (ajout en fin de fichier)

- [ ] **Step 1: Ajouter le gabarit**

Ajouter à la fin de `lib/email/templates.ts` :

```ts
export function accountDeletionRequestEmail(opts: {
  prenom: string | null
  nom: string | null
  email: string
  personneId: string
  motif: string | null
}) {
  // Deux variantes : le sujet d'un email n'est pas du HTML, y placer une valeur
  // échappée afficherait « &amp; » dans la ligne d'objet.
  const rawFullName = `${opts.prenom ?? ""} ${opts.nom ?? ""}`.trim() || opts.email
  const fullName = esc(rawFullName)
  const details = [
    `Membre : <strong>${fullName}</strong>`,
    `Email : <strong>${esc(opts.email)}</strong>`,
    `Identifiant : <strong>${esc(opts.personneId)}</strong>`,
    `Demande reçue le : <strong>${esc(new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }))}</strong>`,
  ]
  // Le motif est une saisie libre, souvent sur plusieurs lignes : sans cette
  // conversion, la mise en forme disparaît dans la cellule HTML.
  if (opts.motif) {
    details.push(`Motif indiqué : ${esc(opts.motif).replace(/\n/g, "<br>")}`)
  }

  return {
    subject: `Demande de suppression de compte — ${rawFullName}`,
    html: brandedEmail({
      title: "Demande de suppression de compte",
      intro:
        "Un membre demande la suppression de son compte BeFast. La demande est enregistrée dans les tickets de support ; la suppression s'effectue depuis l'administration des membres.",
      details,
      ctaLabel: "Gérer les membres",
      ctaUrl: `${SITE_URL}/administration/membres`,
    }),
  }
}
```

- [ ] **Step 2: Vérifier que le projet compile toujours**

```bash
cd ~/Desktop/Befast && npx tsc --noEmit -p tsconfig.json
```

Attendu : aucune erreur mentionnant `lib/email/templates.ts`. (Le dépôt peut
déjà émettre des erreurs préexistantes sur d'autres fichiers ; ne pas les
corriger ici.)

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/Befast && git add lib/email/templates.ts && git commit -m "feat(suppression-compte): gabarit d'email de demande de suppression

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- lib/email/templates.ts
```

---

### Task 3 : Route de demande (BeFast)

**Files:**
- Create: `app/api/profil/delete-request/route.ts`

- [ ] **Step 1: Écrire la route**

Créer `app/api/profil/delete-request/route.ts` :

```ts
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiUser } from "@/lib/auth/api-guards"
import { sendEmail } from "@/lib/email/send"
import { accountDeletionRequestEmail } from "@/lib/email/templates"
import { isDuplicateRequest, DELETION_TICKET_TYPE } from "@/lib/account-deletion/request"

// Destinataire des notifications d'administration. Surchargeable par
// environnement pour ne pas polluer la boîte réelle en préproduction.
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "systeme.info@ajc-mail.com"
const MOTIF_MAX = 1000

// POST /api/profil/delete-request
// L'utilisateur demande la suppression de SON compte. Rien n'est supprimé ici :
// on trace la demande dans support_tickets et on prévient l'administration.
export async function POST(request: Request) {
  try {
    const guard = await requireApiUser()
    if (!guard.ok) return guard.response

    const body = await request.json().catch(() => ({}))
    const motif =
      typeof body?.motif === "string" ? body.motif.trim().slice(0, MOTIF_MAX) : ""

    const supabase = createClient()

    // Anti-doublon : la politique RLS « user read own support_tickets » limite
    // déjà la lecture aux tickets de l'appelant.
    const { data: previous } = await supabase
      .from("support_tickets")
      .select("created_at")
      .eq("utilisateur_id", guard.userId)
      .eq("type_probleme", DELETION_TICKET_TYPE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (isDuplicateRequest(previous?.created_at)) {
      // Réponse identique au cas nominal : inutile de signaler à l'utilisateur
      // qu'il a déjà demandé, sa demande est bien prise en compte.
      return NextResponse.json({ ok: true, alreadyRequested: true })
    }

    const { profile } = guard
    const { error: ticketError } = await supabase.from("support_tickets").insert({
      utilisateur_id: guard.userId,
      email: profile.email,
      type_probleme: DELETION_TICKET_TYPE,
      description: motif || "Demande de suppression de compte, sans motif précisé.",
      page_url: "/dashboard/profil",
    })

    if (ticketError) {
      console.error("[delete-request] ticket non enregistré", ticketError)
      return NextResponse.json(
        { error: "Impossible d'enregistrer la demande." },
        { status: 500 },
      )
    }

    // Envoi best-effort : le ticket suffit à traiter la demande si l'email échoue.
    const tpl = accountDeletionRequestEmail({
      prenom: profile.prenom,
      nom: profile.nom,
      email: profile.email,
      personneId: guard.userId,
      motif: motif || null,
    })
    const sent = await sendEmail({ to: ADMIN_EMAIL, subject: tpl.subject, html: tpl.html })
    if (!sent.ok) console.error("[delete-request] email non envoyé", sent.error)

    return NextResponse.json({ ok: true, emailSent: sent.ok })
  } catch (e: any) {
    console.error("[delete-request]", e?.message ?? e)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Vérifier le refus des anonymes**

Démarrer le serveur si besoin (`npm run dev`), puis :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/profil/delete-request -H "Content-Type: application/json" -d '{"motif":"test"}'
```

Attendu : `401`

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/Befast && git add app/api/profil/delete-request/route.ts && git commit -m "feat(suppression-compte): route de demande cote membre

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- app/api/profil/delete-request/route.ts
```

---

### Task 4 : Lien discret et modale sur le profil (BeFast)

**Files:**
- Create: `app/(dashboard)/dashboard/profil/_components/delete-account-request.tsx`
- Modify: `app/(dashboard)/dashboard/profil/page.tsx`

- [ ] **Step 1: Créer le composant**

Créer `app/(dashboard)/dashboard/profil/_components/delete-account-request.tsx` :

```tsx
"use client"

import { useState } from "react"

type State = "idle" | "sending" | "sent" | "error"

/**
 * Demande de suppression de compte — volontairement discrète : un lien en
 * petits caractères, hors des actions principales du profil. Le clic ouvre une
 * modale qui explique que la demande part vers l'administration et qu'elle
 * n'est pas immédiate.
 */
export function DeleteAccountRequest() {
  const [open, setOpen] = useState(false)
  const [motif, setMotif] = useState("")
  const [state, setState] = useState<State>("idle")

  async function submit() {
    setState("sending")
    try {
      const res = await fetch("/api/profil/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      })
      setState(res.ok ? "sent" : "error")
    } catch {
      setState("error")
    }
  }

  function close() {
    setOpen(false)
    // La demande envoyée reste envoyée : on ne réarme pas le formulaire.
    if (state === "error") setState("idle")
  }

  return (
    <>
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={state === "sent"}
          className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 transition-colors disabled:no-underline disabled:hover:text-zinc-400"
        >
          {state === "sent"
            ? "Demande de suppression envoyée"
            : "Demander la suppression de mon compte"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-md p-6">
            {state === "sent" ? (
              <>
                <h2 className="text-lg font-manrope font-bold text-[#00236f]">
                  Demande envoyée
                </h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                  L&apos;administration a été prévenue. Vous serez recontacté avant
                  que le compte ne soit supprimé.
                </p>
                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-manrope font-bold text-[#00236f]">
                  Demander la suppression de mon compte
                </h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                  Votre demande est transmise à l&apos;administration d&apos;Audencia
                  Junior Conseil. La suppression n&apos;est pas immédiate : elle est
                  effectuée manuellement, et elle est définitive.
                </p>

                <label className="block text-xs font-medium text-zinc-500 mt-5 mb-1.5">
                  Motif (facultatif)
                </label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                />

                {state === "error" && (
                  <p className="text-sm text-red-600 mt-3">
                    L&apos;envoi a échoué. Réessayez, ou écrivez directement à
                    l&apos;administration.
                  </p>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={state === "sending"}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {state === "sending" ? "Envoi…" : "Envoyer la demande"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Insérer le composant dans la page profil**

Dans `app/(dashboard)/dashboard/profil/page.tsx`, ajouter l'import après la
ligne `import { DocumentsGrid } from "./_components/DocumentsGrid"` :

```tsx
import { DeleteAccountRequest } from "./_components/delete-account-request"
```

Puis, dans la colonne de droite, juste après le bloc `{/* Security banner */}`
qui se termine par `</div>` avant la fermeture de `<div className="lg:col-span-4 space-y-4">`, ajouter :

```tsx
          <DeleteAccountRequest />
```

La colonne doit se lire ainsi :

```tsx
          {/* Security banner */}
          <div className="bg-[#00236f] rounded-xl p-4 text-white">
            {/* … inchangé … */}
          </div>

          <DeleteAccountRequest />
        </div>
```

- [ ] **Step 3: Vérifier dans le navigateur**

Démarrer `npm run dev`, se connecter avec un compte membre validé, ouvrir
`/dashboard/profil`. Vérifier : le lien apparaît en bas de la colonne de
droite, en petits caractères gris ; la modale s'ouvre ; l'envoi affiche
« Demande envoyée » ; une ligne existe en base :

```sql
select type_probleme, description, created_at from support_tickets order by created_at desc limit 1;
```

Attendu : une ligne `suppression_compte`.

- [ ] **Step 4: Vérifier l'anti-doublon**

Recharger la page, renvoyer une demande. Attendu : la modale affiche à nouveau
« Demande envoyée », et la requête SQL ci-dessus ne renvoie **toujours qu'une
seule** ligne `suppression_compte`.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/Befast && git add "app/(dashboard)/dashboard/profil/_components/delete-account-request.tsx" "app/(dashboard)/dashboard/profil/page.tsx" && git commit -m "feat(suppression-compte): lien de demande sur le profil membre

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- "app/(dashboard)/dashboard/profil/_components/delete-account-request.tsx" "app/(dashboard)/dashboard/profil/page.tsx"
```

---

### Task 5 : Migration du statut `deleted` (BeFast)

**Files:**
- Create: `supabase/migrations/059_account_status_deleted.sql`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/059_account_status_deleted.sql` :

```sql
-- Migration 059 : statut « deleted » pour les comptes supprimés.
--
-- La contrainte posée par MIGRATIONS_A_APPLIQUER.sql n'autorisait que
-- pending_validation / validated / rejected. Un compte supprimé n'efface pas
-- sa ligne `personnes` : notes_de_frais, mission_collaborations et
-- candidatures cascadent depuis elle (migrations 005 et 025), et personnes.id
-- cascade lui-même depuis auth.users. La ligne est donc vidée et marquée
-- `deleted`, ce qui coupe l'accès via la garde de app/(dashboard)/layout.tsx.

ALTER TABLE public.personnes DROP CONSTRAINT IF EXISTS personnes_account_status_check;

ALTER TABLE public.personnes ADD CONSTRAINT personnes_account_status_check
  CHECK (account_status IN ('pending_validation', 'validated', 'rejected', 'deleted'));
```

- [ ] **Step 2: Appliquer la migration**

L'appliquer sur la base Supabase du projet (éditeur SQL du dashboard, ou la
procédure habituelle du dépôt). Vérifier ensuite :

```sql
update personnes set account_status = 'deleted' where id = '<id d’un compte de test>';
```

Attendu : `UPDATE 1`, sans violation de contrainte. Remettre ensuite le compte
de test dans son état d'origine :

```sql
update personnes set account_status = 'validated' where id = '<id d’un compte de test>';
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/Befast && git add supabase/migrations/059_account_status_deleted.sql && git commit -m "feat(suppression-compte): migration du statut deleted

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- supabase/migrations/059_account_status_deleted.sql
```

---

### Task 6 : Patch d'anonymisation (BeFast)

Fonction pure qui décrit ce qu'il reste d'une personne après suppression.

**Files:**
- Create: `lib/account-deletion/purge.ts`
- Test: `lib/account-deletion/purge.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/account-deletion/purge.test.ts` :

```ts
import { describe, it, expect } from "vitest"
import {
  buildAnonymisationPatch,
  anonymisedEmailFor,
  DELETED_STATUS,
} from "./purge"

const ID = "11111111-2222-3333-4444-555555555555"

describe("anonymisedEmailFor", () => {
  it("dérive une adresse unique de l'identifiant", () => {
    expect(anonymisedEmailFor(ID)).toBe(`supprime+${ID}@ajc-mail.com`)
  })

  it("donne des adresses différentes à deux personnes", () => {
    expect(anonymisedEmailFor("a")).not.toBe(anonymisedEmailFor("b"))
  })
})

describe("buildAnonymisationPatch", () => {
  const patch = buildAnonymisationPatch(ID)

  it("coupe l'accès", () => {
    expect(patch.account_status).toBe(DELETED_STATUS)
  })

  it("remplace l'identité", () => {
    expect(patch.prenom).toBe("Compte")
    expect(patch.nom).toBe("supprimé")
    expect(patch.email).toBe(anonymisedEmailFor(ID))
  })

  it("vide les six familles de colonnes chiffrées et leurs métadonnées", () => {
    for (const champ of ["nss", "iban", "adresse", "date_naissance", "ville", "code_postal"]) {
      expect(patch[`${champ}_encrypted`]).toBeNull()
      expect(patch[`${champ}_iv`]).toBeNull()
      expect(patch[`${champ}_auth_tag`]).toBeNull()
    }
    expect(patch.encryption_salt).toBeNull()
  })

  it("vide les colonnes personnelles en clair", () => {
    for (const champ of ["portable", "avatar_url", "adresse", "ville", "code_postal", "date_naissance"]) {
      expect(patch[champ]).toBeNull()
    }
  })

  it("ne touche pas au rôle ni au profil type", () => {
    expect(patch).not.toHaveProperty("profil_type_id")
  })
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
cd ~/Desktop/Befast && npx vitest run lib/account-deletion/purge.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./purge"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/account-deletion/purge.ts` :

```ts
/**
 * Anonymisation d'un compte supprimé.
 *
 * La ligne `personnes` n'est jamais effacée : notes_de_frais,
 * mission_collaborations et candidatures cascadent depuis elle, et
 * personnes.id cascade depuis auth.users. On la vide de tout ce qui est
 * personnel, l'historique des missions et des frais reste intact.
 */

export const DELETED_STATUS = "deleted"
export const DELETED_PRENOM = "Compte"
export const DELETED_NOM = "supprimé"

/** Adresse technique unique, d'où l'on ne peut pas remonter à l'adresse réelle. */
export function anonymisedEmailFor(personneId: string): string {
  return `supprime+${personneId}@ajc-mail.com`
}

/** Familles de colonnes chiffrées de `personnes` (migration 022). */
const ENCRYPTED_FIELDS = [
  "nss",
  "iban",
  "adresse",
  "date_naissance",
  "ville",
  "code_postal",
] as const

export function buildAnonymisationPatch(personneId: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    account_status: DELETED_STATUS,
    prenom: DELETED_PRENOM,
    nom: DELETED_NOM,
    email: anonymisedEmailFor(personneId),
    portable: null,
    avatar_url: null,
    encryption_salt: null,
    // Colonnes en clair héritées des versions antérieures au chiffrement.
    adresse: null,
    ville: null,
    code_postal: null,
    date_naissance: null,
  }

  for (const champ of ENCRYPTED_FIELDS) {
    patch[`${champ}_encrypted`] = null
    patch[`${champ}_iv`] = null
    patch[`${champ}_auth_tag`] = null
  }

  return patch
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

```bash
cd ~/Desktop/Befast && npx vitest run lib/account-deletion/purge.test.ts
```

Attendu : `Test Files  1 passed` — 7 tests passés.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/Befast && git add lib/account-deletion/purge.ts lib/account-deletion/purge.test.ts && git commit -m "feat(suppression-compte): patch d'anonymisation d'une personne

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- lib/account-deletion/purge.ts lib/account-deletion/purge.test.ts
```

---

### Task 7 : Orchestration et route DELETE (BeFast)

**Files:**
- Create: `lib/account-deletion/delete-account.ts`
- Modify: `app/api/admin/personnes/[id]/route.ts`

- [ ] **Step 1: Écrire l'orchestration**

Créer `lib/account-deletion/delete-account.ts` :

```ts
import "server-only"

import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { scalewayS3, SCALEWAY_BUCKET } from "@/lib/scaleway/client"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildAnonymisationPatch,
  anonymisedEmailFor,
  DELETED_STATUS,
} from "./purge"

/**
 * Supprime un compte : accès coupé, données personnelles purgées, identité
 * anonymisée. La ligne `personnes` et le compte Auth survivent — voir purge.ts
 * et le commentaire sur le bannissement plus bas.
 *
 * Chaque étape après la première est best-effort : son échec est collecté et
 * remonté à l'administrateur plutôt que d'interrompre les suivantes, pour ne
 * pas laisser un compte à moitié purgé sans le dire.
 */

/** ~100 ans : Supabase n'expose pas de bannissement définitif. */
const BAN_DURATION = "876000h"

export type DeletionResult = { ok: boolean; failedSteps: string[] }

export async function deleteAccount(personneId: string): Promise<DeletionResult> {
  const admin = createAdminClient()
  const failedSteps: string[] = []

  // 1. Couper l'accès en premier : si la suite échoue, le compte est déjà
  //    hors service (la garde du dashboard refuse tout statut != validated).
  const { error: statusError } = await admin
    .from("personnes")
    .update({ account_status: DELETED_STATUS })
    .eq("id", personneId)

  if (statusError) {
    console.error("[deleteAccount] statut non appliqué", statusError)
    return { ok: false, failedSteps: ["statut"] }
  }

  // 2. Documents personnels : objets Scaleway, puis lignes.
  const { data: docs } = await admin
    .from("documents_personnes")
    .select("file_path")
    .eq("personne_id", personneId)

  for (const doc of docs ?? []) {
    if (!doc?.file_path) continue
    try {
      await scalewayS3.send(
        new DeleteObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: doc.file_path }),
      )
    } catch (e) {
      console.error("[deleteAccount] objet S3 non supprimé", doc.file_path, e)
      failedSteps.push(`document:${doc.file_path}`)
    }
  }

  const { error: docsError } = await admin
    .from("documents_personnes")
    .delete()
    .eq("personne_id", personneId)
  if (docsError) {
    console.error("[deleteAccount] lignes documents_personnes", docsError)
    failedSteps.push("documents_personnes")
  }

  // 3. Avatar — bucket Supabase, chemin `<id>/avatar.<ext>`.
  const { data: avatarFiles } = await admin.storage.from("avatars").list(personneId)
  if (avatarFiles?.length) {
    const { error: avatarError } = await admin.storage
      .from("avatars")
      .remove(avatarFiles.map((f) => `${personneId}/${f.name}`))
    if (avatarError) {
      console.error("[deleteAccount] avatar non supprimé", avatarError)
      failedSteps.push("avatar")
    }
  }

  // 4. Valeurs des champs personnalisés.
  const { error: customError } = await admin
    .from("custom_field_values")
    .delete()
    .eq("user_id", personneId)
  if (customError) {
    console.error("[deleteAccount] custom_field_values", customError)
    failedSteps.push("custom_field_values")
  }

  // 5. Anonymisation de la ligne.
  const { error: patchError } = await admin
    .from("personnes")
    .update(buildAnonymisationPatch(personneId))
    .eq("id", personneId)
  if (patchError) {
    console.error("[deleteAccount] anonymisation", patchError)
    failedSteps.push("anonymisation")
  }

  // 6. Compte Auth : banni et anonymisé, JAMAIS supprimé — personnes.id est
  //    REFERENCES auth.users(id) ON DELETE CASCADE (migration 001), et
  //    notes_de_frais cascade à son tour depuis personnes : un deleteUser
  //    effacerait l'historique des frais.
  const { error: authError } = await admin.auth.admin.updateUserById(personneId, {
    ban_duration: BAN_DURATION,
    email: anonymisedEmailFor(personneId),
    email_confirm: true,
  })
  if (authError) {
    console.error("[deleteAccount] compte Auth non neutralisé", authError)
    failedSteps.push("auth")
  }

  return { ok: failedSteps.length === 0, failedSteps }
}
```

- [ ] **Step 2: Ajouter le handler DELETE**

Dans `app/api/admin/personnes/[id]/route.ts`, ajouter les imports en tête de
fichier :

```ts
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/supabase-security"
import { deleteAccount } from "@/lib/account-deletion/delete-account"
```

Puis ajouter à la fin du fichier :

```ts
// DELETE /api/admin/personnes/[id]
// Suppression d'un compte par un administrateur : accès coupé, données
// personnelles purgées, identité anonymisée. La ligne `personnes` est
// conservée pour ne pas emporter l'historique des missions et des frais.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response

    // Un administrateur qui supprimerait son propre compte se verrouillerait
    // dehors, et perdrait au passage le droit de réparer quoi que ce soit.
    if (guard.userId === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte." },
        { status: 400 },
      )
    }

    const result = await deleteAccount(id)

    await logAudit(createClient(), "personnes", "DELETE", id, {
      failedSteps: result.failedSteps,
    })

    if (!result.ok && result.failedSteps.includes("statut")) {
      return NextResponse.json(
        { error: "La suppression a échoué : le compte est inchangé." },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, failedSteps: result.failedSteps })
  } catch (e: any) {
    console.error("[DELETE /api/admin/personnes/:id]", e?.message ?? e)
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Vérifier les refus**

Avec le serveur démarré, appeler la route sans session :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/admin/personnes/11111111-2222-3333-4444-555555555555
```

Attendu : `401`

Puis, connecté avec un compte **non administrateur** (depuis la console du
navigateur, onglet de l'application) :

```js
await fetch("/api/admin/personnes/11111111-2222-3333-4444-555555555555", { method: "DELETE" }).then(r => r.status)
```

Attendu : `403`

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/Befast && git add lib/account-deletion/delete-account.ts "app/api/admin/personnes/[id]/route.ts" && git commit -m "feat(suppression-compte): suppression effective cote administrateur

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- lib/account-deletion/delete-account.ts "app/api/admin/personnes/[id]/route.ts"
```

---

### Task 8 : Action de suppression dans l'administration (BeFast)

**Files:**
- Modify: `app/(dashboard)/administration/membres/_components/MembresTab.tsx`

- [ ] **Step 1: Ajouter la modale de confirmation**

Dans `MembresTab.tsx`, ajouter `Trash2` à l'import de `lucide-react` (ligne 4) :

```tsx
import { Search, MoreVertical, Loader, ExternalLink, ShieldCheck, ShieldAlert, CheckCircle2, Clock, XCircle, Ban, X, Trash2 } from "lucide-react"
```

Puis ajouter ce composant juste avant `export function MembresTab()` (ligne 88) :

```tsx
/**
 * Confirmation d'une suppression de compte. L'administrateur doit retaper
 * l'email exact du membre : le geste est irréversible et ne doit pas pouvoir
 * partir d'un clic distrait dans une liste.
 */
function DeleteMemberModal({ member, onCancel, onConfirm, busy }: {
  member: PersonneWithRole
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const [saisie, setSaisie] = useState("")
  const correspond = saisie.trim().toLowerCase() === (member.email ?? "").toLowerCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-manrope font-bold text-red-700">
            Supprimer ce compte
          </h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
          L&apos;accès de <strong>{member.prenom} {member.nom}</strong> sera coupé
          immédiatement. Ses documents personnels, ses coordonnées et ses données
          chiffrées seront effacés, et son identité anonymisée.
        </p>
        <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
          L&apos;historique des missions, des candidatures et des notes de frais est
          conservé. <strong>Cette action est irréversible.</strong>
        </p>

        <label className="block text-xs font-medium text-zinc-500 mt-5 mb-1.5">
          Retapez <span className="font-mono text-zinc-700">{member.email}</span> pour confirmer
        </label>
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-200"
          autoComplete="off"
        />

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!correspond || busy}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:hover:bg-red-600"
          >
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter l'état et l'appel réseau**

Dans `MembresTab()`, après la ligne
`const [rejectTarget, setRejectTarget] = useState<PersonneWithRole | null>(null)` :

```tsx
  const [deleteTarget, setDeleteTarget] = useState<PersonneWithRole | null>(null)
```

Puis, juste après la fonction `patchStatus` :

```tsx
  async function deleteMember(member: PersonneWithRole) {
    setUpdating(member.id)
    const res = await fetch(`/api/admin/personnes/${member.id}`, { method: "DELETE" })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      // Une purge partielle doit être signalée : le compte est neutralisé,
      // mais il reste des données à retirer à la main.
      if (json?.failedSteps?.length) {
        alert(`Compte neutralisé, mais ces étapes ont échoué : ${json.failedSteps.join(", ")}`)
      }
      setDeleteTarget(null)
      await loadMembers()
    } else {
      alert(json?.error ?? "Erreur lors de la suppression du compte")
    }
    setUpdating(null)
  }
```

- [ ] **Step 3: Ajouter le filtre, le badge de statut et le bouton**

Dans le tableau des filtres de statut (ligne ~189), ajouter une entrée :

```tsx
                  { value: "rejected", label: "Rejetés" },
                  { value: "deleted", label: "Supprimés" }
```

Dans la cellule de statut, ajouter une branche avant le `:` final — le bloc
devient :

```tsx
                        ) : m.account_status === "rejected" ? (
                          <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs" title={(m as any).rejection_reason || undefined}>
                            <XCircle className="w-3.5 h-3.5" />
                            Rejeté
                          </div>
                        ) : m.account_status === "deleted" ? (
                          <div className="flex items-center gap-1.5 text-zinc-400 font-medium text-xs">
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimé
                          </div>
                        ) : (
```

Dans la cellule d'actions, après le bouton « Rejeter » (ligne ~334) :

```tsx
                          {m.account_status !== "deleted" && (
                            <button
                              onClick={() => setDeleteTarget(m)}
                              disabled={updating === m.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Supprimer
                            </button>
                          )}
```

- [ ] **Step 4: Monter la modale**

À l'endroit où `rejectTarget` est rendu (chercher `rejectTarget &&` dans le
JSX de retour), ajouter à côté :

```tsx
      {deleteTarget && (
        <DeleteMemberModal
          member={deleteTarget}
          busy={updating === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMember(deleteTarget)}
        />
      )}
```

- [ ] **Step 5: Vérifier dans le navigateur**

Connecté en administrateur, ouvrir `/administration/membres`. Sur un **compte
de test** :

1. le bouton « Supprimer » est présent ;
2. la modale refuse de confirmer tant que l'email retapé ne correspond pas ;
3. après confirmation, la ligne repasse avec le statut « Supprimé » ;
4. le filtre « Supprimés » isole bien ce compte.

Contrôler en base :

```sql
select account_status, prenom, nom, email, portable, nss_encrypted, encryption_salt, avatar_url
from personnes where id = '<id du compte de test>';
```

Attendu : `deleted`, `Compte`, `supprimé`, `supprime+<id>@ajc-mail.com`, et
`null` partout ailleurs.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/Befast && git add "app/(dashboard)/administration/membres/_components/MembresTab.tsx" && git commit -m "feat(suppression-compte): action de suppression dans l'administration des membres

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- "app/(dashboard)/administration/membres/_components/MembresTab.tsx"
```

---

### Task 9 : Échappement HTML (RH Manager)

Le motif saisi par le candidat part dans un email HTML : il doit être échappé.
`resend.ts` fait déjà cet échappement en ligne dans `sendResultEmail` ; on en
fait une fonction testée plutôt qu'une troisième copie.

**Files:**
- Create: `src/lib/html.ts`
- Test: `src/lib/html.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/html.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { escapeHtml } from "./html";

describe("escapeHtml", () => {
  it("neutralise une balise injectée", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("échappe les esperluettes avant le reste", () => {
    expect(escapeHtml("Tom & <b>Jerry</b>")).toBe(
      "Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;",
    );
  });

  it("échappe les guillemets, qui ferment un attribut", () => {
    expect(escapeHtml('a" onmouseover="x')).toBe("a&quot; onmouseover=&quot;x");
  });

  it("rend une chaîne vide pour une valeur absente", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
cd ~/Desktop/"RH Manager Anti"/frontend && npx vitest run src/lib/html.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./html"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/lib/html.ts` :

```ts
/**
 * Échappement des valeurs saisies par l'utilisateur avant insertion dans un
 * email HTML. L'ordre compte : l'esperluette d'abord, sinon on ré-échappe les
 * entités que l'on vient de produire.
 */
export function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

```bash
cd ~/Desktop/"RH Manager Anti"/frontend && npx vitest run src/lib/html.test.ts
```

Attendu : `Test Files  1 passed` — 4 tests passés.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/"RH Manager Anti" && git add frontend/src/lib/html.ts frontend/src/lib/html.test.ts && git commit -m "feat(suppression-compte): helper d'echappement HTML teste

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- frontend/src/lib/html.ts frontend/src/lib/html.test.ts
```

---

### Task 10 : Email et route de demande (RH Manager)

**Files:**
- Modify: `src/lib/resend.ts` (ajout en fin de fichier)
- Create: `src/app/api/candidates/delete-request/route.ts`

- [ ] **Step 1: Ajouter la fonction d'envoi**

Ajouter en tête de `src/lib/resend.ts`, après les imports existants :

```ts
import { escapeHtml } from "./html";
```

Puis à la fin du fichier :

```ts
// Demande de suppression de compte émise par un candidat. Rien n'est supprimé
// ici : l'email prévient l'administration, qui traite la demande à la main.
export async function sendAccountDeletionRequestEmail(opts: {
  to: string;
  candidateId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  motif: string | null;
}) {
  const fullName =
    `${escapeHtml(opts.firstName)} ${escapeHtml(opts.lastName)}`.trim() ||
    escapeHtml(opts.email);
  const recu = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const lignes = [
    `<strong>Candidat :</strong> ${fullName}`,
    `<strong>Email :</strong> ${escapeHtml(opts.email)}`,
    `<strong>Identifiant :</strong> ${escapeHtml(opts.candidateId)}`,
    `<strong>Demande reçue le :</strong> ${escapeHtml(recu)}`,
  ];
  if (opts.motif) lignes.push(`<strong>Motif indiqué :</strong> ${escapeHtml(opts.motif)}`);

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#E8446A;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:1px;text-transform:uppercase;">Audencia Junior Conseil</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">Demande de suppression de compte</h1>
        </td></tr>
        <tr><td style="padding:36px 40px 28px;">
          <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">
            Un candidat demande la suppression de son compte sur la plateforme de recrutement.
            La suppression doit être effectuée manuellement.
          </p>
          ${lignes.map((l) => `<p style="margin:0 0 8px;font-size:14px;color:#111827;">${l}</p>`).join("")}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Audencia Junior Conseil — Cet email a été envoyé automatiquement.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Demande de suppression de compte — ${fullName}`,
    html,
  });
}
```

- [ ] **Step 2: Écrire la route**

Créer `src/app/api/candidates/delete-request/route.ts` :

```ts
import { supabaseAdmin } from "@/lib/supabase";
import { getTokenFromRequest, unauthorized } from "@/lib/auth";
import { sendAccountDeletionRequestEmail } from "@/lib/resend";
import { NextRequest } from "next/server";

// Destinataire des notifications d'administration, surchargeable par
// environnement pour ne pas polluer la boîte réelle en préproduction.
const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL ?? "systeme.info@ajc-mail.com";
const MOTIF_MAX = 1000;

// POST /api/candidates/delete-request
// Le candidat demande la suppression de SON compte. L'identité vient de la
// base à partir du jeton : le corps de la requête ne porte que le motif.
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return unauthorized();

  try {
    const body = await req.json().catch(() => ({}));
    const motif =
      typeof body?.motif === "string" ? body.motif.trim().slice(0, MOTIF_MAX) : "";

    const { data: candidate, error } = await supabaseAdmin
      .from("candidates")
      .select("id, first_name, last_name, email")
      .eq("id", payload.id)
      .single();

    if (error || !candidate) {
      return Response.json({ error: "Profil introuvable" }, { status: 404 });
    }

    await sendAccountDeletionRequestEmail({
      to: ADMIN_EMAIL,
      candidateId: candidate.id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      email: candidate.email,
      motif: motif || null,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[candidates/delete-request]", e);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Vérifier le refus des anonymes**

Serveur démarré (`npm run dev` dans `frontend`) :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/candidates/delete-request -H "Content-Type: application/json" -d '{"motif":"test"}'
```

Attendu : `401`

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/"RH Manager Anti" && git add frontend/src/lib/resend.ts frontend/src/app/api/candidates/delete-request/route.ts && git commit -m "feat(suppression-compte): route et email de demande cote candidat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- frontend/src/lib/resend.ts frontend/src/app/api/candidates/delete-request/route.ts
```

---

### Task 11 : Lien discret sur le profil candidat (RH Manager)

**Files:**
- Create: `src/components/candidates/DeleteAccountRequest.tsx`
- Modify: `src/app/candidates/profile/page.tsx`

- [ ] **Step 1: Créer le composant**

Créer `src/components/candidates/DeleteAccountRequest.tsx` :

```tsx
"use client";

import { useState } from "react";
import api from "@/lib/api";

type State = "idle" | "sending" | "sent" | "error";

/**
 * Demande de suppression de compte — discrète à dessein : un lien en petits
 * caractères sous les informations du candidat. La demande part vers
 * l'administration, qui supprime le compte à la main.
 */
export default function DeleteAccountRequest() {
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit() {
    setState("sending");
    try {
      await api.post("/candidates/delete-request", { motif });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  function close() {
    setOpen(false);
    if (state === "error") setState("idle");
  }

  return (
    <>
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={state === "sent"}
          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors disabled:no-underline disabled:hover:text-gray-400"
        >
          {state === "sent"
            ? "Demande de suppression envoyée"
            : "Demander la suppression de mon compte"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md p-6">
            {state === "sent" ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900">
                  Demande envoyée
                </h2>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  L&apos;équipe recrutement a été prévenue. Vous serez recontacté
                  avant que votre compte ne soit supprimé.
                </p>
                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900">
                  Demander la suppression de mon compte
                </h2>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Votre demande est transmise à l&apos;équipe recrutement
                  d&apos;Audencia Junior Conseil. La suppression n&apos;est pas
                  immédiate : elle est effectuée manuellement, et elle est
                  définitive — votre candidature sera retirée du processus.
                </p>

                <label className="block text-xs font-medium text-gray-500 mt-5 mb-1.5">
                  Motif (facultatif)
                </label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                />

                {state === "error" && (
                  <p className="text-sm text-[#B3244A] mt-3">
                    L&apos;envoi a échoué. Réessayez plus tard.
                  </p>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={state === "sending"}
                    className="px-4 py-2 rounded-lg bg-[#E8446A] text-white text-sm font-semibold hover:bg-[#c0395a] transition-colors disabled:opacity-50"
                  >
                    {state === "sending" ? "Envoi…" : "Envoyer la demande"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Insérer le composant dans la page profil**

Dans `src/app/candidates/profile/page.tsx`, ajouter l'import après celui de
`CandidatePhotoUpload` :

```tsx
import DeleteAccountRequest from "@/components/candidates/DeleteAccountRequest";
```

Puis, juste avant la fermeture du conteneur principal — après la balise
fermante `</section>` de « Mes informations » —, ajouter :

```tsx
      <DeleteAccountRequest />
```

La fin du composant doit se lire :

```tsx
      </section>

      <DeleteAccountRequest />
    </div>
  );
}
```

- [ ] **Step 3: Vérifier dans le navigateur**

Serveur démarré, connecté avec un compte candidat, ouvrir `/candidates/profile`.
Vérifier : le lien est en bas de page, discret ; la modale s'ouvre ; l'envoi
affiche « Demande envoyée » ; l'email arrive à l'adresse configurée.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/"RH Manager Anti" && git add frontend/src/components/candidates/DeleteAccountRequest.tsx frontend/src/app/candidates/profile/page.tsx && git commit -m "feat(suppression-compte): lien de demande sur le profil candidat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- frontend/src/components/candidates/DeleteAccountRequest.tsx frontend/src/app/candidates/profile/page.tsx
```

---

### Task 12 : Vérification d'ensemble

**Files:** aucun

- [ ] **Step 1: Suites de tests des deux dépôts**

```bash
cd ~/Desktop/Befast && npm test
```

Attendu : les suites existantes passent, plus `request.test.ts` (5 tests) et
`purge.test.ts` (7 tests).

```bash
cd ~/Desktop/"RH Manager Anti"/frontend && npm test
```

Attendu : les suites existantes passent, plus `html.test.ts` (4 tests).

- [ ] **Step 2: Compilation**

```bash
cd ~/Desktop/Befast && npm run build
```

Attendu : build réussi.

```bash
cd ~/Desktop/"RH Manager Anti"/frontend && npm run build
```

Attendu : build réussi.

- [ ] **Step 3: Parcours complet sur un compte de test BeFast**

Sur un compte membre de test, dérouler les critères de validation de la spec :

1. le lien de demande crée un ticket et envoie l'email ;
2. une seconde demande dans les 24 h ne crée ni ticket ni email ;
3. l'administrateur supprime ce compte depuis l'administration des membres ;
4. le compte supprimé ne peut plus se connecter — vérifier aussi que la
   demande de réinitialisation de mot de passe ne lui redonne pas la main ;
5. en base, les missions et notes de frais qui référençaient ce membre
   existent toujours :

```sql
select count(*) from notes_de_frais where intervenant_id = '<id du compte de test>';
select count(*) from personnes where id = '<id du compte de test>';
```

Attendu : le compte de frais est inchangé par rapport à avant la suppression,
et la ligne `personnes` existe toujours (count = 1).

- [ ] **Step 4: Parcours complet sur un compte de test RH**

Sur un compte candidat de test, vérifier que le lien envoie bien l'email de
demande à l'adresse configurée.

---

## Ce qui a réellement été construit — écarts au plan

Exécuté le 2026-09-05. Les tâches 1 à 11 sont faites et commitées sur
`feat/suppression-compte` dans les deux dépôts. Les revues ont fait dévier le
plan sur sept points, tous délibérés :

1. **Le compte Auth est banni, pas supprimé** (déjà corrigé dans la spec avant
   exécution) : `personnes.id` cascade depuis `auth.users`, et `notes_de_frais`
   cascade depuis `personnes` — un `deleteUser()` aurait effacé l'historique
   des frais.
2. **Migration `059` et non `058`** : le numéro 058 était déjà pris par un
   travail en cours (`058_fix_orphaned_auth_users.sql`).
3. **Le type `account_status` de `types/database.types.ts` a dû être élargi**
   à `"deleted"`, sinon TypeScript rejetait les comparaisons.
4. **Les deux modales ont été revues.** Côté BeFast, réécriture sur la primitive
   `components/ui/dialog.tsx` — deux voisins du même dossier l'utilisaient déjà.
   `role="dialog"`, `aria-modal` et la fermeture par Échap ont été ajoutés une
   fois dans cette primitive, au bénéfice de toutes les modales du dépôt. RH n'a
   pas d'équivalent : sa modale porte ces attributs en propre.
5. **Textes corrigés** : la formule « vous serez recontacté avant que le compte
   ne soit supprimé » promettait une étape que rien ne garantit. Remplacée par
   « traitera votre demande manuellement ».
6. **Fermeture verrouillée pendant l'envoi, bornée à 15 s** : la requête étant
   déjà partie, laisser « Annuler » la fermer aurait menti ; sans la borne, une
   requête qui pend enfermait l'utilisateur.
7. **Trois résidus fermés après la revue finale** : le layout ne redirigeait pas
   un compte `deleted` (il restreignait seulement ses permissions, ce qui
   laissait la session en cours accéder au profil et aux documents) ; un lien de
   réinitialisation émis avant la suppression restait valable 72 h ; la campagne
   mot de passe pouvait recontacter un compte supprimé.

**Reste à faire, hors de portée d'une exécution automatisée :** appliquer la
migration `059` sur la base Supabase, et dérouler les parcours de la tâche 12
avec des sessions authentifiées (membre, administrateur, candidat).

## Ce que ce plan ne fait pas

- Aucune synchronisation entre BeFast et RH Manager : supprimer un compte d'un
  côté ne touche pas l'autre.
- Aucune suppression automatique déclenchée par une demande utilisateur.
- Le hub `~/Desktop/onboarding-ajc` n'est pas modifié.
- Le `TODO` d'envoi d'email de `app/api/support/report/route.ts` reste en l'état.
