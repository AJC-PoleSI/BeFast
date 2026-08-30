"use client"

import type { PersonneWithRole } from "@/types/database.types"

/**
 * Pôle + rôles cumulés d'un membre.
 *
 * Trois sources coexistent dans le schéma :
 *   - `personnes.profil_type_id` → le rôle de base (Administrateur, Membre AJC,
 *     Intervenant…) ;
 *   - `personne_postes` → les postes cumulables (bureau / pôles) introduits par
 *     la migration 039, qui portent les permissions additionnelles ;
 *   - `personnes.pole` → le pôle saisi en texte libre sur la fiche.
 *
 * Le profil n'en affichait aucune à part le rôle de base, d'où l'impression que
 * le pôle « n'était pas rempli » alors qu'il l'était via les postes.
 */

const ROLES_SANS_AFFECTATION = ["intervenant", "candidat"]

export function estMembreInterne(profile: PersonneWithRole): boolean {
  const slug = profile.profils_types?.slug
  return !!slug && !ROLES_SANS_AFFECTATION.includes(slug)
}

export function RolesBadges({
  profile,
  className = "",
}: {
  profile: PersonneWithRole
  className?: string
}) {
  const postes = (profile.personne_postes ?? [])
    .map((pp) => pp.profils_types)
    .filter((pt): pt is NonNullable<typeof pt> => !!pt)

  const bureau = postes.filter((p) => p.categorie === "bureau")
  const poles = postes.filter((p) => p.categorie === "pole")

  // Un intervenant sans aucun poste n'a rien à afficher ici.
  if (!estMembreInterne(profile) && postes.length === 0 && !profile.pole) return null

  const items: { label: string; cls: string }[] = []

  if (profile.profils_types?.nom) {
    items.push({
      label: profile.profils_types.nom,
      cls: "bg-[#00236f] text-white",
    })
  }
  for (const p of bureau) {
    items.push({ label: p.nom, cls: "bg-amber-100 text-amber-800 border border-amber-200" })
  }
  for (const p of poles) {
    items.push({ label: p.nom, cls: "bg-[#d0d8ff] text-[#00236f] border border-[#b6c2ff]" })
  }
  // Pôle en texte libre : affiché seulement s'il n'est pas déjà couvert par un poste.
  if (profile.pole && !poles.some((p) => p.nom.toLowerCase().includes(profile.pole!.toLowerCase()))) {
    items.push({
      label: `Pôle ${profile.pole}`,
      cls: "bg-[#d0d8ff] text-[#00236f] border border-[#b6c2ff]",
    })
  }

  if (items.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((it) => (
        <span
          key={it.label}
          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${it.cls}`}
        >
          {it.label}
        </span>
      ))}
      {estMembreInterne(profile) && postes.length === 0 && (
        <span className="text-xs text-zinc-400 italic">Aucun poste attribué</span>
      )}
    </div>
  )
}
