"use client"

import { useState } from "react"
import { Loader, Check } from "lucide-react"
import { setPersonnePostes } from "@/lib/actions/members"
import type { ProfilType } from "@/types/database.types"

/**
 * Multi-sélection des postes (bureau/pôles) d'une personne. Les postes cumulent
 * leurs permissions au rôle de base. Écrit via `setPersonnePostes` (admin only).
 *
 * Le catalogue `postes` est fourni par la page (déjà chargé via getAllRoles) —
 * pas de fetch réseau par ouverture de menu.
 *
 * `onSaved` doit rafraîchir la liste du parent : ce composant est démonté à la
 * fermeture du menu et remonté depuis `initialPosteIds`. Sans rafraîchissement,
 * un poste retiré (et bien supprimé en base) réapparaissait coché à la
 * réouverture, et son badge restait affiché dans le tableau.
 */
export function PostesMultiSelect({
  personneId,
  postes,
  initialPosteIds,
  onSaved,
}: {
  personneId: string
  postes: ProfilType[]
  initialPosteIds: string[]
  onSaved?: () => void | Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPosteIds))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSaved(false)
    setError(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    const r = await setPersonnePostes(personneId, Array.from(selected))
    if (r.success) {
      await onSaved?.()
      setSaved(true)
    } else {
      setError(r.error ?? "Les postes n'ont pas pu être enregistrés.")
    }
    setSaving(false)
  }

  const bureau = postes.filter((p) => p.categorie === "bureau")
  const pole = postes.filter((p) => p.categorie === "pole")

  return (
    <div className="space-y-3">
      {[{ label: "Bureau", list: bureau }, { label: "Pôles", list: pole }].map((g) => (
        <div key={g.label}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">{g.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.list.map((p) => {
              const on = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    on
                      ? "bg-[#00236f] text-white border-[#00236f]"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {p.nom}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
          saved ? "bg-green-100 text-green-700" : "bg-[#00236f] text-white hover:bg-[#1e3a8a]"
        }`}
      >
        {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saved ? "Postes enregistrés" : "Enregistrer les postes"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
