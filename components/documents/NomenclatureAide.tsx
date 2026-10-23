"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { NOMENCLATURE_EXEMPLES } from "@/lib/documents/nomenclature"

/**
 * Petit « i » : rappelle comment Be Fast nomme les documents
 * (AA CODE[NN] [RDM parent] NUMERO_ETUDE).
 */
export function NomenclatureAide() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-label="Comment sont nommés les documents ?"
        title="Comment sont nommés les documents ?"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#00236f] hover:bg-[#00236f]/10"
      >
        <Info className="h-4 w-4" />
      </button>
      {ouvert && (
        <div className="mt-2 rounded-lg border border-[#00236f]/15 bg-[#00236f]/5 p-3 text-xs text-zinc-700 space-y-2">
          <p>
            <span className="font-semibold text-[#00236f]">AA CODE NN [RDM] N° d&apos;étude</span> — année sur 2 chiffres,
            code du document, compteur, RDM concerné pour un avenant, numéro d&apos;étude sur 2 chiffres.
          </p>
          <ul className="space-y-1">
            {NOMENCLATURE_EXEMPLES.map((e) => (
              <li key={e.code} className="flex gap-2">
                <code className="shrink-0 font-mono font-medium text-[#00236f]">{e.exemple}</code>
                <span className="text-zinc-600">{e.libelle}</span>
              </li>
            ))}
          </ul>
          <p className="text-zinc-500">
            Un avenant prend le numéro du RDM de l&apos;intervenant et repart de 01 pour chaque RDM.
            Le fichier téléchargé ajoute le nom de l&apos;étudiant (« 26 RDM01 18 - Prénom Nom »).
          </p>
        </div>
      )}
    </div>
  )
}
