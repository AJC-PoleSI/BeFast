# Charte graphique — Be Fast

Référentiel visuel unique de l'application Be Fast (Audencia Junior Conseil).
**Règle d'or : une même entité = un même composant, partout.** Avant de styler
un élément à la main, vérifier si un composant de cette charte existe déjà.

---

## 1. Couleurs

Source de vérité : variables CSS dans [`app/globals.css`](app/globals.css) (`:root`),
exposées à Tailwind via [`tailwind.config.ts`](tailwind.config.ts).

| Rôle | Token Tailwind | Valeur | Usage |
|------|----------------|--------|-------|
| Navy (marque) | `primary` / `bg-primary` `text-primary` | `#00236f` | Actions principales, état actif, titres de marque |
| Navy survol | `navy-hover` | `#1e3a8a` | Survol des surfaces navy |
| Or (accent marque) | `gold` / `bg-gold` `text-gold` | `#C9A84C` | Accent ponctuel, halo de fond, mises en avant. **Jamais** en couleur de survol par défaut |
| Slate | `secondary` | `#555d7e` | Boutons secondaires, texte tertiaire |
| Highlight neutre | `accent` / `bg-accent` | gris clair | Fonds de survol (menus, items, boutons ghost) |
| Muet | `muted` / `bg-muted` | gris très clair | Fond d'item actif, zones secondaires |
| Texte muet | `muted-foreground` | gris | Sous-titres, libellés secondaires |
| Surface app | `bg-[#f7f9fb]` / `background` | `#f7f9fb` | Fond général |
| Carte / menu | `card` / `popover` | blanc | Cartes, dropdowns, popovers |
| Bordure | `border` `input` | gris clair | Bordures, champs |
| Danger | `destructive` | rouge | Suppression, déconnexion, erreurs |
| Focus | `ring` | navy | Anneau de focus clavier |

> Ne **jamais** réintroduire de `text-[#00236f]` / `bg-[#00236f]` en dur :
> utiliser `text-primary` / `bg-primary`. Idem pour l'or via `gold`.

## 2. Typographie

- **Texte** : `Inter` (`font-sans`, défaut).
- **Titres de marque / logo** : `Manrope` (`font-manrope`), poids `extrabold`.
- Casse normale (jamais de Title Case ni d'ALL CAPS), sauf badges courts.

## 3. Formes & profondeur

- Rayons : `rounded-lg` (0.5rem) pour boutons/inputs/cartes ; `rounded-md` pour
  les items de liste/menu ; `rounded-2xl` pour les grandes cartes (auth).
- Ombres : douces — `shadow-sm shadow-black/5`. Pas de glow ni d'ombre lourde.
- Focus : `ring-[3px] ring-ring/20` sur les champs, `outline-ring/70` sur les boutons.

## 4. Composants (à réutiliser tels quels)

| Besoin | Composant | Fichier |
|--------|-----------|---------|
| Bouton | `Button` (variants `default`/`outline`/`secondary`/`gold`/`ghost`/`destructive`/`link`) | [`components/ui/button.tsx`](components/ui/button.tsx) |
| Champ texte / fichier / recherche | `Input` (`type="file"`, `type="search"` gérés) | [`components/ui/input.tsx`](components/ui/input.tsx) |
| Champ numérique (avec +/−) | `NumberField` | [`components/ui/number-field.tsx`](components/ui/number-field.tsx) |
| Options à cocher (sélection multiple) | `GridList` + `GridListItem` | [`components/ui/grid-list.tsx`](components/ui/grid-list.tsx) |
| Case à cocher seule | `Checkbox` | [`components/ui/checkbox.tsx`](components/ui/checkbox.tsx) |
| Arborescence de documents (étude, intervenant…) | `FileTree` / `FilesystemItem` | [`components/ui/file-tree.tsx`](components/ui/file-tree.tsx) |
| Menu déroulant | `DropdownMenu` & co. | [`components/ui/dropdown-menu.tsx`](components/ui/dropdown-menu.tsx) |
| Fond signature (halo doré) | `GlowBackground` (plein écran) / `GlowLayer` (calque) | [`components/ui/background-glow.tsx`](components/ui/background-glow.tsx) |
| Navigation latérale | `AppSidebar` | [`components/layout/AppSidebar.tsx`](components/layout/AppSidebar.tsx) |

### Règles d'emploi

- **Action principale** d'un écran → `Button` (variant `default`, navy). Une seule
  par zone. Action secondaire → `outline` ou `secondary`. Mise en avant
  marketing/marque → `gold`. Action destructive → `destructive`.
- **Icônes** : `lucide-react` uniquement (taille `h-4 w-4` dans les boutons/nav).
  Ne plus ajouter de Material Symbols dans les nouveaux écrans.
- **Listes d'options cochables** (sélection d'intervenants, de documents, de
  champs…) → toujours `GridList`, jamais une suite de cases bricolées.
- **Dossiers / fichiers** (documents d'une étude, d'un intervenant) → `FileTree`.
- **Fonds** : pages « vitrine » (auth, accueil) → `GlowBackground` ; pages
  applicatives → `GlowLayer` discret derrière le contenu (déjà posé dans le shell).

## 5. Layout applicatif

`AppSidebar` est un rail fixe (≈3 rem) qui s'étend au survol (desktop) et devient
un drawer sur mobile. Il porte la navigation, les paramètres et le menu compte
(profil + déconnexion). Le contenu est décalé via `lg:pl-[3.05rem]` dans
[`app/(dashboard)/dashboard-shell.tsx`](app/(dashboard)/dashboard-shell.tsx).

## 6. Dépendances de la charte

`framer-motion` (sidebar, arborescence), `react-aria-components` (GridList,
Checkbox, NumberField), `@radix-ui/react-dropdown-menu`,
`@radix-ui/react-scroll-area`, `lucide-react`.
