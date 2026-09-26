# Dépôt du bulletin d'adhésion signé — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** ajouter une case « Bulletin d'adhésion signé » dans « Mes documents » (candidats et membres), fiable pour les PDF et les photos.

**Architecture :** nouveau type `bulletin_adhesion` dans le circuit existant `documents_personnes`. Tout le circuit (upload direct Scaleway, repli par la route, validation admin, ZIP, push RH) lit `VALID_DOC_TYPES` et `DOC_TYPE_LABELS`, donc suit sans autre modification. La route d'enregistrement renvoie un message lisible si la contrainte CHECK n'a pas été migrée.

**Tech Stack :** Next.js 14 App Router, Supabase (Postgres), Scaleway S3 (`@aws-sdk/client-s3`), vitest, lucide-react.

Spec : `docs/superpowers/specs/2026-09-24-depot-bulletin-adhesion-design.md`.

**Attention, dépôt partagé :** le working tree de Be Fast contient de nombreuses modifications d'autres chantiers. Toujours commiter avec des chemins explicites (`git commit -- <fichiers>`), jamais `git add -A` ni `git commit -a`.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| Create `app/(dashboard)/dashboard/profil/_lib/schemas.test.ts` | Tests de validation des fichiers + présence du type BA |
| Modify `app/(dashboard)/dashboard/profil/_lib/schemas.ts` | `VALID_DOC_TYPES`, `DOC_TYPE_LABELS`, `DOC_TYPE_ICONS` |
| Modify `types/database.types.ts:86-92` | Union `DocumentType` |
| Create `supabase/migrations/073_document_bulletin_adhesion.sql` | Contrainte CHECK élargie |
| Modify `app/(dashboard)/dashboard/profil/_components/DocumentsGrid.tsx` | Icône + texte d'aide |
| Modify `app/api/profil/documents/route.ts` | 503 lisible + nettoyage de l'orphelin si la contrainte refuse le type |

---

### Task 1 : tests de validation des fichiers (verrouiller l'existant)

**Files :**
- Create : `app/(dashboard)/dashboard/profil/_lib/schemas.test.ts`

- [ ] **Step 1 : écrire les tests du comportement actuel**

```ts
import { describe, it, expect } from "vitest"
import { isAcceptedFileType, resolveMimeType, fileExtension } from "./schemas"

describe("isAcceptedFileType", () => {
  it.each([
    ["application/pdf", "ba.pdf"],
    ["image/jpeg", "photo.jpg"],
    ["image/png", "scan.png"],
    ["image/webp", "scan.webp"],
    ["image/heic", "IMG_0001.heic"],
    ["image/heif", "IMG_0001.heif"],
  ])("accepte %s (%s)", (type, name) => {
    expect(isAcceptedFileType({ type, name })).toBe(true)
  })

  it.each(["ba.pdf", "BA.PDF", "photo.JPG", "scan.jpeg", "IMG_0001.HEIC"])(
    "accepte %s quand le navigateur ne donne aucun type",
    (name) => {
      expect(isAcceptedFileType({ type: "", name })).toBe(true)
    }
  )

  it("accepte un HEIC annoncé application/octet-stream", () => {
    expect(
      isAcceptedFileType({ type: "application/octet-stream", name: "IMG_0001.heic" })
    ).toBe(true)
  })

  it.each([
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "ba.docx"],
    ["text/plain", "notes.txt"],
    ["application/x-msdownload", "setup.exe"],
    ["application/zip", "docs.zip"],
    ["image/gif", "anim.gif"],
    ["", "scan"],
    ["application/octet-stream", "scan"],
  ])("refuse %s (%s)", (type, name) => {
    expect(isAcceptedFileType({ type, name })).toBe(false)
  })
})

describe("resolveMimeType", () => {
  it("garde le type donné par le navigateur", () => {
    expect(resolveMimeType({ type: "image/png", name: "scan.png" })).toBe("image/png")
  })

  it("déduit le type de l'extension quand il manque", () => {
    expect(resolveMimeType({ type: "", name: "ba.pdf" })).toBe("application/pdf")
  })

  it("remplace application/octet-stream par le type de l'extension", () => {
    expect(
      resolveMimeType({ type: "application/octet-stream", name: "IMG_0001.HEIC" })
    ).toBe("image/heic")
  })

  it("reste générique sans extension reconnue", () => {
    expect(resolveMimeType({ type: "", name: "scan" })).toBe("application/octet-stream")
  })
})

describe("fileExtension", () => {
  it("normalise une extension en majuscules", () => {
    expect(fileExtension({ type: "application/pdf", name: "BA.PDF" })).toBe("pdf")
  })

  it("garde une extension acceptée", () => {
    expect(fileExtension({ type: "image/jpeg", name: "photo.jpeg" })).toBe("jpeg")
  })

  it("prend l'extension du type MIME quand le nom n'en a pas", () => {
    expect(fileExtension({ type: "application/pdf", name: "scan" })).toBe("pdf")
  })

  it("prend l'extension du type MIME quand celle du nom est inconnue", () => {
    expect(fileExtension({ type: "image/jpeg", name: "photo.scan" })).toBe("jpg")
  })

  it("retombe sur bin quand rien n'est reconnu", () => {
    expect(fileExtension({ type: "", name: "inconnu" })).toBe("bin")
  })
})
```

- [ ] **Step 2 : lancer les tests**

Run : `npx vitest run "app/(dashboard)/dashboard/profil/_lib/schemas.test.ts"`
Expected : tous PASS (ils décrivent le comportement existant). Si un test échoue, c'est un bug réel de validation : le signaler avant de continuer.

- [ ] **Step 3 : commit**

```bash
git add "app/(dashboard)/dashboard/profil/_lib/schemas.test.ts"
git commit -m "test(documents): verrouiller la validation des fichiers déposés" -- "app/(dashboard)/dashboard/profil/_lib/schemas.test.ts"
```

---

### Task 2 : type `bulletin_adhesion`

**Files :**
- Modify : `app/(dashboard)/dashboard/profil/_lib/schemas.ts` (`VALID_DOC_TYPES`, `DOC_TYPE_LABELS`, `DOC_TYPE_ICONS`)
- Modify : `types/database.types.ts:86-92`
- Test : `app/(dashboard)/dashboard/profil/_lib/schemas.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter aux imports du fichier de test `VALID_DOC_TYPES, DOC_TYPE_LABELS, DOC_TYPE_ICONS`, plus `import { BA_REQUIRED_DOC_TYPES } from "@/lib/signature/ba-utils"`, puis :

```ts
describe("type bulletin_adhesion", () => {
  it("est un type de document déposable", () => {
    expect(VALID_DOC_TYPES).toContain("bulletin_adhesion")
  })

  it("a un libellé et une icône", () => {
    expect(DOC_TYPE_LABELS.bulletin_adhesion).toBe("Bulletin d'adhésion signé")
    expect(DOC_TYPE_ICONS.bulletin_adhesion).toBe("FileSignature")
  })

  it("chaque type déposable a un libellé", () => {
    for (const t of VALID_DOC_TYPES) expect(DOC_TYPE_LABELS[t]).toBeTruthy()
  })

  // Le BA part APRÈS validation des pièces : l'exiger pour le générer
  // bloquerait définitivement l'envoi.
  it("n'est pas une pièce requise pour générer le BA", () => {
    expect(BA_REQUIRED_DOC_TYPES as readonly string[]).not.toContain("bulletin_adhesion")
  })
})
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run "app/(dashboard)/dashboard/profil/_lib/schemas.test.ts"`
Expected : FAIL sur « est un type de document déposable » et « a un libellé et une icône ».

- [ ] **Step 3 : implémenter**

`schemas.ts` : ajouter `"bulletin_adhesion",` en dernier dans `VALID_DOC_TYPES`, `bulletin_adhesion: "Bulletin d'adhésion signé",` en dernier dans `DOC_TYPE_LABELS`, et `bulletin_adhesion: "FileSignature",` en dernier dans `DOC_TYPE_ICONS`.

`types/database.types.ts`, union `DocumentType` :

```ts
export type DocumentType =
  | "carte_identite_recto"
  | "carte_identite_verso"
  | "carte_etudiante"
  | "carte_vitale"
  | "preuve_lydia"
  | "rib"
  | "bulletin_adhesion"
```

- [ ] **Step 4 : vérifier**

Run : `npx vitest run "app/(dashboard)/dashboard/profil/_lib/schemas.test.ts"`
Expected : PASS.

---

### Task 3 : migration 073

**Files :**
- Create : `supabase/migrations/073_document_bulletin_adhesion.sql`

- [ ] **Step 1 : écrire la migration** (contrainte actuelle vérifiée en prod le 24/09 : les six types de la 071)

```sql
-- 073_document_bulletin_adhesion.sql
-- Nouvel emplacement de justificatif : le bulletin d'adhésion signé, que la
-- personne renvoie après l'avoir reçu par mail. Même mécanisme que les autres
-- pièces : une ligne de documents_personnes par (personne, type).
--
-- À appliquer AVANT de déployer le code qui propose la case, sinon chaque
-- dépôt de BA est refusé par la contrainte (cf. 071 : incident du 21/09/2026).
-- Idempotent : ré-exécuter ne casse rien.

ALTER TABLE public.documents_personnes
  DROP CONSTRAINT IF EXISTS documents_personnes_type_check;

ALTER TABLE public.documents_personnes
  ADD CONSTRAINT documents_personnes_type_check
  CHECK (type IN (
    'carte_identite_recto',
    'carte_identite_verso',
    'carte_etudiante',
    'carte_vitale',
    'preuve_lydia',
    'rib',
    'bulletin_adhesion'
  ));
```

Ne pas l'appliquer soi-même : Felix l'applique à la main (règle du projet).

---

### Task 4 : grille « Mes documents »

**Files :**
- Modify : `app/(dashboard)/dashboard/profil/_components/DocumentsGrid.tsx`

- [ ] **Step 1 : icône.** Ajouter `FileSignature,` à l'import `lucide-react` et `bulletin_adhesion: FileSignature,` à `DOC_ICONS`.

- [ ] **Step 2 : texte d'aide.** Remplacer le paragraphe « Bulletin d'adhésion » du bloc « Informations importantes » par :

```tsx
              <p>
                <span className="font-semibold text-[#00236f]">Bulletin d'adhésion :</span>{" "}
                il vous est envoyé par mail. Renvoyez-le signé dans la case « Bulletin
                d'adhésion signé » ci-dessus, de préférence en PDF.
              </p>
```

---

### Task 5 : message lisible si la migration manque

**Files :**
- Modify : `app/api/profil/documents/route.ts`

Un fichier `route.ts` de Next.js ne doit exporter que les handlers HTTP : les helpers restent locaux, non exportés.

- [ ] **Step 1 : helpers** (après `saveDocumentRow`)

```ts
/**
 * La contrainte CHECK de `documents_personnes.type` refuse un type que le code
 * propose déjà : la migration correspondante n'a pas été appliquée. Sans ce
 * cas, la personne lisait « Erreur DB: new row … violates check constraint »
 * (incident 071 du 21/09/2026).
 */
function isTypeCheckViolation(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  return (
    error?.code === "23514" &&
    (error.message ?? "").includes("documents_personnes_type_check")
  )
}

/**
 * Réponse au refus de la contrainte. L'objet vient d'être déposé sous une clé
 * propre à ce type : aucune ligne de ce type ne peut exister (la contrainte
 * l'aurait refusée), on ne supprime donc jamais un justificatif valide.
 */
async function typeNotMigratedResponse(filePath: string, docType: string, error: unknown) {
  console.error(
    `[profil/documents] Type « ${docType} » refusé par documents_personnes_type_check — migration non appliquée ?`,
    error
  )
  try {
    await scalewayS3.send(new DeleteObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: filePath }))
  } catch (err) {
    console.error("Scaleway cleanup error:", err)
  }
  return NextResponse.json(
    {
      error:
        "Ce type de document n'est pas encore disponible. Réessayez plus tard ou contactez le bureau.",
    },
    { status: 503 }
  )
}
```

- [ ] **Step 2 : brancher les deux chemins.** Dans `POST`, aux deux endroits `if (saved.error || !saved.document) {`, insérer en tête du bloc :

```ts
        if (isTypeCheckViolation(saved.error)) {
          return typeNotMigratedResponse(filePath, docType, saved.error)
        }
```

(indentation à adapter à chaque bloc).

- [ ] **Step 3 : typecheck, lint, tests**

Run : `npx tsc --noEmit && npx next lint --file app/api/profil/documents/route.ts --file "app/(dashboard)/dashboard/profil/_components/DocumentsGrid.tsx" --file "app/(dashboard)/dashboard/profil/_lib/schemas.ts" && npm run test`
Expected : 0 erreur TS, 0 warning lint, tous les tests PASS.

- [ ] **Step 4 : commit** (Tasks 2 à 5)

```bash
git add supabase/migrations/073_document_bulletin_adhesion.sql
git commit -m "feat(documents): case « Bulletin d'adhésion signé » dans Mes documents" -- \
  "app/(dashboard)/dashboard/profil/_lib/schemas.ts" \
  "app/(dashboard)/dashboard/profil/_lib/schemas.test.ts" \
  types/database.types.ts \
  supabase/migrations/073_document_bulletin_adhesion.sql \
  "app/(dashboard)/dashboard/profil/_components/DocumentsGrid.tsx" \
  app/api/profil/documents/route.ts
```

Vérifier avant le commit que `git diff` de ces fichiers ne contient que nos changements. `types/database.types.ts` ou `route.ts` pourraient porter des modifications d'un autre chantier : dans ce cas, s'arrêter et le signaler.

---

### Task 6 : vérification réelle

L'environnement local pointe sur la base et le bucket de **production**.

- [ ] **Step 1 : pré-requis.** Felix applique `073_document_bulletin_adhesion.sql` et se connecte lui-même à un compte de test dans l'aperçu (`preview_start` `Next.js Dev`, port 3001). Vérifier la contrainte :
  `select pg_get_constraintdef(oid) from pg_constraint where conname = 'documents_personnes_type_check';` → contient `bulletin_adhesion`.
- [ ] **Step 2 : fichiers de test**, dans le scratchpad : PDF valide (petit), PDF de plus de 4 Mo, JPG, PNG, HEIC (`sips -s format heic`), `.docx`.
- [ ] **Step 3 : dans la case BA**, pour chaque fichier : dépôt, badge « En attente », consultation (URL présignée s'ouvre), téléchargement. Relever les requêtes réseau (`upload-url` → PUT Scaleway → confirmation `POST /api/profil/documents`). Le PDF de plus de 4 Mo doit passer par le PUT direct.
- [ ] **Step 4 :** remplacer le PDF par un JPG. Vérifier en base que `file_path` a changé et que l'ancien objet n'existe plus (`HeadObject` → 404).
- [ ] **Step 5 :** le `.docx` est refusé côté client avec « Format accepté : JPEG, PNG, WebP, HEIC, PDF ».
- [ ] **Step 6 :** vue admin (`/dashboard/profil/<id>` du compte de test) : la ligne BA apparaît, valider → badge « Validé ».
- [ ] **Step 7 : nettoyage.** Supprimer le document de test via l'UI (bouton corbeille), puis vérifier qu'il ne reste aucune ligne `bulletin_adhesion` pour ce compte ni d'objet sous son préfixe `.../bulletin_adhesion/`.
- [ ] **Step 8 :** relancer graphify : `$(cat graphify-out/.graphify_python) -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`.

---

### Task 7 (ajout du 24/09) : modèle de BA téléchargeable

- [ ] `schemas.ts` : `export const BA_TEMPLATE_CATEGORY = "bulletin_adhesion_vierge"`.
- [ ] `administration/documents/page.tsx` : format `pdf_libre` dans `DOCUMENT_TYPES` ; nouvelle entrée `{ key: BA_TEMPLATE_CATEGORY, label: "Bulletin d'adhésion à télécharger", category: CATEGORY_MEMBRE, format: "pdf_libre" }` ; libellé existant renommé « Bulletin d'adhésion (signature électronique) ». `handleUpload` : pour `pdf_libre`, vérifier l'extension `.pdf` et l'en-tête `%PDF`, `placeholders = []`, content-type `application/pdf`. Modale : libellé « Fichier .pdf * » et encadré d'aide propre. Ligne : pas de compteur de balises pour `pdf_libre`. Description de section mise à jour.
- [ ] `app/api/profil/documents/ba-template/route.ts` : `requireApiPermission("documents")`, dernier `document_templates` de la catégorie, `{ available, fileName }` ou `?download=1` → `createSignedUrl(path, 60, { download: file_name })`.
- [ ] `lib/auth/access-map.ts` : déclarer la route (`cles: ["documents"]`).
- [ ] `DocumentsGrid.tsx` : en vue personnelle, `GET /api/profil/documents/ba-template` au montage ; lien « Télécharger le modèle » dans la ligne `bulletin_adhesion` si disponible ; clic → `?download=1` → navigation vers l'URL signée.
- [ ] Vérif : `npx tsc --noEmit`, `npm run test` (le test access-map vérifie le garde de la nouvelle route).
