"use client"

// Rendu « façon Excel » d'un budget de proposition (moitié droite du template
// Audencia : Budget Final + Modalités de règlement + Synthèse).
// Sobre : gris / blanc / noir. Réutilisé par la modale trésorerie et le récap CDP.

import { fmtEURBudget, type BudgetBreakdown } from "@/lib/budget/compute"

export interface BudgetSheetMeta {
  id?: string | null
  client_company?: string | null
  study_type?: string | null
  cdp_name?: string | null
}

export function BudgetSheet({
  breakdown,
  meta,
}: {
  breakdown: BudgetBreakdown
  meta?: BudgetSheetMeta
}) {
  const b = breakdown
  const rows = [
    ...b.phases.map((p) => ({ name: p.name || "Phase", jeh: p.jeh, montant: p.prixJeh, total: p.montant })),
    ...(b.suiviJeh > 0 || b.suiviTotal > 0
      ? [{ name: "Suivi de l'étude", jeh: b.suiviJeh, montant: b.suiviPrixJeh, total: b.suiviTotal }]
      : []),
  ]

  return (
    <div className="text-zinc-800">
      {/* Détail mission (optionnel) */}
      {meta && (meta.id || meta.client_company || meta.study_type || meta.cdp_name) && (
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {meta.id && (
            <p><span className="text-zinc-500">Propale :</span> <span className="font-mono font-medium">{meta.id}</span></p>
          )}
          {meta.client_company && (
            <p><span className="text-zinc-500">Client :</span> <span className="font-medium">{meta.client_company}</span></p>
          )}
          {meta.study_type && (
            <p><span className="text-zinc-500">Type d&apos;étude :</span> <span className="font-medium">{meta.study_type}</span></p>
          )}
          {meta.cdp_name && (
            <p><span className="text-zinc-500">Chef de projet :</span> <span className="font-medium">{meta.cdp_name}</span></p>
          )}
        </div>
      )}

      {/* Tableau principal — Budget Final */}
      <table className="w-full text-sm border border-zinc-800 border-collapse">
        <thead>
          <tr className="bg-zinc-700 text-white">
            <th className="border border-zinc-800 px-3 py-2 text-left font-semibold">Phases</th>
            <th className="border border-zinc-800 px-3 py-2 text-right font-semibold w-20">J.E.H.</th>
            <th className="border border-zinc-800 px-3 py-2 text-right font-semibold w-32">Montant</th>
            <th className="border border-zinc-800 px-3 py-2 text-right font-semibold w-32">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="border border-zinc-800 px-3 py-4 text-center text-zinc-400">
                Aucune phase renseignée.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
                <td className="border border-zinc-800 px-3 py-1.5 text-left">{r.name}</td>
                <td className="border border-zinc-800 px-3 py-1.5 text-right tabular-nums">{r.jeh}</td>
                <td className="border border-zinc-800 px-3 py-1.5 text-right tabular-nums">{fmtEURBudget(r.montant)}</td>
                <td className="border border-zinc-800 px-3 py-1.5 text-right tabular-nums">{fmtEURBudget(r.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Modalités de règlement */}
        <div className="text-sm">
          <p className="font-bold mb-2">Modalités de règlement :</p>
          <ul className="space-y-1.5 text-zinc-700">
            <li className="flex gap-2">
              <span>–</span>
              <span>
                Acompte de 60 % à la signature de la convention d&apos;étude :{" "}
                <span className="font-bold">{fmtEURBudget(b.acompte60)}</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span>–</span>
              <span>
                Solde (40 % restants) à la signature du procès-verbal de recette final :{" "}
                <span className="font-bold">{fmtEURBudget(b.solde40)}</span>
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs italic text-zinc-500">
            *Frais de structure : administratifs, postaux, de logiciels, d&apos;impression et de transport.
          </p>
        </div>

        {/* Synthèse */}
        <div className="text-sm">
          <table className="w-full border border-zinc-300 border-collapse">
            <tbody>
              <tr>
                <td className="border border-zinc-300 px-3 py-1.5 bg-zinc-50 text-zinc-600">Total J.E.H. HT</td>
                <td className="border border-zinc-300 px-3 py-1.5 text-right tabular-nums">{fmtEURBudget(b.totalJehHt)}</td>
              </tr>
              <tr>
                <td className="border border-zinc-300 px-3 py-1.5 bg-zinc-50 text-zinc-600">Frais de structure*</td>
                <td className="border border-zinc-300 px-3 py-1.5 text-right tabular-nums">{fmtEURBudget(b.fraisStructure)}</td>
              </tr>
              <tr>
                <td className="border border-zinc-300 px-3 py-1.5 bg-zinc-50 font-semibold">Total HT</td>
                <td className="border border-zinc-300 px-3 py-1.5 text-right tabular-nums font-semibold">{fmtEURBudget(b.totalHt)}</td>
              </tr>
              <tr>
                <td className="border border-zinc-300 px-3 py-1.5 bg-zinc-50 italic text-zinc-600">TVA applicable ({b.tvaPct} %)</td>
                <td className="border border-zinc-300 px-3 py-1.5 text-right tabular-nums italic">{fmtEURBudget(b.tva)}</td>
              </tr>
              <tr>
                <td className="border border-zinc-300 px-3 py-2 bg-zinc-200 font-bold">NET À PAYER</td>
                <td className="border border-zinc-300 px-3 py-2 text-right tabular-nums font-bold bg-zinc-200">{fmtEURBudget(b.netAPayer)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
