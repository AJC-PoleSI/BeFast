"use client"

import { Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  CHAMPS_AVENANT,
  type Alinea,
  type ChampAvenant,
  type ValeursAvenant,
} from "@/lib/documents/avenants"

const CLASSE_CHAMP = "w-full px-3 rounded-md border border-input text-sm bg-white"

/**
 * Formulaire des passages propres à un avenant (objet, nouvelle date, motifs…) :
 * remplace la rédaction dans Word. Les champs laissés vides reprennent les
 * données de la mission.
 */
export function ChampsAvenant({
  category,
  valeurs,
  onChange,
}: {
  category: string
  valeurs: ValeursAvenant
  onChange: (valeurs: ValeursAvenant) => void
}) {
  const champs = CHAMPS_AVENANT[category]
  if (!champs) return null
  const set = (key: string, value: ValeursAvenant[string]) => onChange({ ...valeurs, [key]: value })

  return (
    <div className="space-y-3 rounded-lg border border-[#00236f]/15 bg-[#00236f]/[0.03] p-3">
      <p className="text-xs font-semibold text-[#00236f]">Contenu de l&apos;avenant</p>
      {champs.map((c) => {
        if (c.visibleSi && !valeurs[c.visibleSi]) return null
        return (
          <div key={c.key} className="space-y-1">
            {c.type === "checkbox" ? (
              <Checkbox isSelected={!!valeurs[c.key]} onChange={(v) => set(c.key, v)}>
                {c.label}
              </Checkbox>
            ) : (
              <Label>
                {c.label}
                {c.obligatoire ? " *" : ""}
              </Label>
            )}
            {c.type === "text" && (
              <input
                className={`${CLASSE_CHAMP} h-10`}
                value={String(valeurs[c.key] ?? "")}
                onChange={(e) => set(c.key, e.target.value)}
              />
            )}
            {c.type === "textarea" && (
              <textarea
                className={`${CLASSE_CHAMP} py-2`}
                rows={c.rows ?? 4}
                value={String(valeurs[c.key] ?? "")}
                onChange={(e) => set(c.key, e.target.value)}
              />
            )}
            {c.type === "date" && (
              <input
                type="date"
                className={`${CLASSE_CHAMP} h-10`}
                value={String(valeurs[c.key] ?? "")}
                onChange={(e) => set(c.key, e.target.value)}
              />
            )}
            {c.type === "number" && (
              <input
                type="number"
                step="any"
                min={0}
                className={`${CLASSE_CHAMP} h-10`}
                value={String(valeurs[c.key] ?? "")}
                onChange={(e) => set(c.key, e.target.value)}
              />
            )}
            {c.type === "alineas" && (
              <EditeurAlineas
                alineas={(valeurs[c.key] as Alinea[] | undefined) ?? []}
                onChange={(a) => set(c.key, a)}
              />
            )}
            {c.aide && c.type !== "checkbox" && <p className="text-xs text-zinc-500">{c.aide}</p>}
          </div>
        )
      })}
    </div>
  )
}

function EditeurAlineas({ alineas, onChange }: { alineas: Alinea[]; onChange: (a: Alinea[]) => void }) {
  const maj = (i: number, patch: Partial<Alinea>) =>
    onChange(alineas.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  return (
    <div className="space-y-2">
      {alineas.map((a, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-input bg-white p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600">Alinéa {i + 1}</span>
            <button
              type="button"
              className="text-red-500 hover:text-red-700"
              title="Retirer cet alinéa"
              onClick={() => onChange(alineas.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <input
              className={`${CLASSE_CHAMP} h-9`}
              placeholder="Titre (ex. Délais de réalisation)"
              value={a.titre}
              onChange={(e) => maj(i, { titre: e.target.value })}
            />
            <input
              className={`${CLASSE_CHAMP} h-9`}
              placeholder="Article"
              value={a.article}
              onChange={(e) => maj(i, { article: e.target.value })}
            />
          </div>
          <textarea
            className={`${CLASSE_CHAMP} py-2`}
            rows={3}
            placeholder="Nouveau texte de l'article"
            value={a.texte}
            onChange={(e) => maj(i, { texte: e.target.value })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-[#00236f]"
        onClick={() => onChange([...alineas, { titre: "", article: "", texte: "" }])}
      >
        <Plus className="h-4 w-4 mr-1" /> Ajouter un alinéa
      </Button>
    </div>
  )
}

export type { ChampAvenant }
