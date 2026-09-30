import { User } from "lucide-react"

/**
 * Pastille « intervenant concerné » d'un document généré
 * (generated_documents.intervenant_id) — le nom n'est jamais mis dans le
 * nom du fichier, seulement affiché à côté.
 */
export function IntervenantConcerne({
  personne,
}: {
  personne: { prenom: string | null; nom: string | null } | null | undefined
}) {
  const nom = [personne?.prenom, personne?.nom].filter(Boolean).join(" ")
  if (!nom) return null
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0 rounded-full bg-[#00236f]/5 px-2 py-0.5 text-xs text-[#00236f]"
      title="Intervenant concerné"
    >
      <User className="h-3 w-3" />
      {nom}
    </span>
  )
}
