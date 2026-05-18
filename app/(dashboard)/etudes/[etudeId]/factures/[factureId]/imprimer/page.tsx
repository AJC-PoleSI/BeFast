"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getFactureForPrint } from "@/lib/actions/factures-etude"

function fmtEuro(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return "—"
  return dt.toLocaleDateString("fr-FR")
}

export default function FactureImprimerPage() {
  const params = useParams()
  const etudeId = params.etudeId as string
  const factureId = params.factureId as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const res = (await getFactureForPrint(factureId)) as any
      if (res.error) setError(res.error)
      else setData(res.data)
      setLoading(false)
    })()
  }, [factureId])

  if (loading) {
    return <div className="p-8 text-sm text-zinc-500">Chargement…</div>
  }
  if (error) {
    return (
      <div className="p-8 text-sm text-red-600">
        <p>Erreur : {error}</p>
        <Link href={`/etudes/${etudeId}/factures`}>
          <Button variant="ghost" size="sm" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
          </Button>
        </Link>
      </div>
    )
  }

  const { facture, lignes, etude, structure } = data
  const totalHt = Number(facture.montant_ht ?? 0)

  return (
    <div className="min-h-screen bg-zinc-50 print:bg-white">
      {/* Toolbar (non imprimée) */}
      <div className="print:hidden bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href={`/etudes/${etudeId}/factures`}>
          <Button variant="ghost" size="sm" className="text-zinc-600">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
          </Button>
        </Link>
        <div className="text-sm text-zinc-500">
          Astuce : <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 text-xs">Cmd+P</kbd> → « Enregistrer au format PDF »
        </div>
        <Button onClick={() => window.print()} size="sm" className="bg-[#00236f] text-white hover:bg-[#1e3a8a]">
          <Printer className="h-4 w-4 mr-1.5" /> Imprimer / PDF
        </Button>
      </div>

      {/* Feuille A4 */}
      <div className="max-w-[210mm] mx-auto my-6 bg-white shadow-lg print:shadow-none print:my-0 p-12 print:p-10 text-zinc-800">
        {/* En-tête */}
        <div className="flex items-start justify-between mb-10 pb-6 border-b-2 border-[#00236f]">
          <div>
            <h1 className="text-3xl font-bold text-[#00236f]">FACTURE</h1>
            <p className="text-sm text-zinc-500 mt-1">N° {facture.numero}</p>
            {facture.nom && <p className="text-base font-medium mt-2">{facture.nom}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-base">{structure.raison_sociale || "—"}</p>
            {structure.adresse && <p>{structure.adresse}</p>}
            {(structure.code_postal || structure.ville) && (
              <p>{structure.code_postal} {structure.ville}</p>
            )}
            {structure.email && <p className="text-zinc-500">{structure.email}</p>}
            {structure.telephone && <p className="text-zinc-500">{structure.telephone}</p>}
            {structure.siret && <p className="text-xs text-zinc-400 mt-1">SIRET : {structure.siret}</p>}
            {structure.tva_intra && <p className="text-xs text-zinc-400">TVA Intra : {structure.tva_intra}</p>}
          </div>
        </div>

        {/* Client + dates */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Facturer à</p>
            <p className="font-bold">{etude?.clients?.nom ?? "—"}</p>
            {etude?.clients?.email && <p className="text-sm text-zinc-600">{etude.clients.email}</p>}
            {etude?.clients?.telephone && <p className="text-sm text-zinc-600">{etude.clients.telephone}</p>}
            <div className="mt-3 pt-3 border-t border-zinc-200 text-sm">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Référence étude</p>
              <p>#{etude?.numero ?? "—"} — {etude?.nom ?? ""}</p>
            </div>
          </div>
          <div className="text-sm">
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-zinc-500">Date d&apos;émission</span>
              <span className="text-right font-medium">{fmtDate(facture.date_emission)}</span>
              <span className="text-zinc-500">Date d&apos;échéance</span>
              <span className="text-right font-medium">{fmtDate(facture.date_echeance)}</span>
              <span className="text-zinc-500">Statut</span>
              <span className="text-right font-medium">
                {facture.date_paiement ? (
                  <span className="text-emerald-700">Payée le {fmtDate(facture.date_paiement)}</span>
                ) : (
                  <span className="text-amber-700">En attente</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Tableau des lignes */}
        <table className="w-full mb-8 text-sm">
          <thead>
            <tr className="border-b-2 border-zinc-800">
              <th className="text-left py-2 px-2 font-semibold">Désignation</th>
              <th className="text-right py-2 px-2 font-semibold w-24">%</th>
              <th className="text-right py-2 px-2 font-semibold w-32">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td className="py-3 px-2" colSpan={2}>
                  {facture.nom || "Facturation étude"}
                </td>
                <td className="text-right py-3 px-2 font-medium">{fmtEuro(totalHt)}</td>
              </tr>
            ) : (
              lignes.map((l: any) => (
                <tr key={l.id} className="border-b border-zinc-200">
                  <td className="py-3 px-2">
                    <div className="font-medium">{l.libelle}</div>
                    {l.type === "frais" && (
                      <div className="text-xs text-zinc-500">Frais de dossier</div>
                    )}
                  </td>
                  <td className="text-right py-3 px-2 text-zinc-500">
                    {Number(l.pourcentage).toFixed(0)}%
                  </td>
                  <td className="text-right py-3 px-2 font-medium">{fmtEuro(l.montant)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-800">
              <td className="py-3 px-2 font-bold text-base" colSpan={2}>Total HT</td>
              <td className="text-right py-3 px-2 font-bold text-base text-[#00236f]">{fmtEuro(totalHt)}</td>
            </tr>
            <tr className="text-xs text-zinc-500">
              <td className="px-2 py-1" colSpan={3}>TVA non applicable, art. 293 B du CGI</td>
            </tr>
          </tfoot>
        </table>

        {/* Notes */}
        {facture.notes && (
          <div className="mb-6 p-3 rounded bg-zinc-50 border border-zinc-200 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Notes</p>
            <p className="whitespace-pre-line">{facture.notes}</p>
          </div>
        )}

        {/* RIB / paiement */}
        {(structure.iban || structure.bic) && (
          <div className="border-t border-zinc-200 pt-4 mt-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Coordonnées bancaires</p>
            <div className="grid grid-cols-2 gap-2">
              {structure.iban && (
                <div>
                  <span className="text-zinc-500">IBAN : </span>
                  <span className="font-mono">{structure.iban}</span>
                </div>
              )}
              {structure.bic && (
                <div>
                  <span className="text-zinc-500">BIC : </span>
                  <span className="font-mono">{structure.bic}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pied de page */}
        <div className="mt-12 pt-4 border-t border-zinc-200 text-xs text-zinc-400 text-center">
          {structure.raison_sociale}
          {structure.siret && ` — SIRET ${structure.siret}`}
          {structure.president_nom && ` — Président·e : ${structure.president_nom}`}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
