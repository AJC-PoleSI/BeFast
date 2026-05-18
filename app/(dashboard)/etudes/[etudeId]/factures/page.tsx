"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Plus, Pencil, Banknote, Ban, Trash2, Loader2, ShieldAlert, FileDown, Check, Hourglass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/hooks/useUser"
import {
  getFacturesEtude,
  createFactureEtude,
  updateFactureEtude,
  deleteFactureEtude,
  marquerFactureEtudePaiement,
  type FactureEtude,
  type PhaseRow,
  type FraisRow,
  type FactureLigneInput,
} from "@/lib/actions/factures-etude"

type LigneState = {
  type: "phase" | "frais"
  bloc_id: string | null
  libelle: string
  montant_total: number
  deja_facture_autres: number // facturé sur les autres factures (hors celle en cours)
  montant: number
  pourcentage: number
}

function fmtEuro(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
}

export default function FacturesEtudePage() {
  const params = useParams()
  const etudeId = params.etudeId as string
  const { isAdmin, permissions, loading: authLoading } = useUser()
  const canManage = isAdmin || !!permissions?.voir_factures

  const [loading, setLoading] = useState(true)
  const [etude, setEtude] = useState<any>(null)
  const [tarifJeh, setTarifJeh] = useState(0)
  const [phases, setPhases] = useState<PhaseRow[]>([])
  const [frais, setFrais] = useState<FraisRow>({ montant_total: 0, deja_facture: 0, reste: 0, pourcentage_facture: 0 })
  const [factures, setFactures] = useState<FactureEtude[]>([])

  // Mode édition / création
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formNom, setFormNom] = useState("Facture")
  const [formDateEmission, setFormDateEmission] = useState<string>("")
  const [formDateEcheance, setFormDateEcheance] = useState<string>("")
  const [formDatePaiement, setFormDatePaiement] = useState<string>("")
  const [acomptePct, setAcomptePct] = useState<number>(60)
  const [lignes, setLignes] = useState<LigneState[]>([])
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = (await getFacturesEtude(etudeId)) as any
    if (res.error) {
      toast.error(res.error)
    } else {
      setEtude(res.data.etude)
      setTarifJeh(res.data.tarifJeh)
      setPhases(res.data.phases)
      setFrais(res.data.frais)
      setFactures(res.data.factures)
    }
    setLoading(false)
  }, [etudeId])

  useEffect(() => {
    if (!authLoading && canManage) refresh()
  }, [authLoading, canManage, refresh])

  // Permission gate
  if (!authLoading && !canManage) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <Link href={`/etudes/${etudeId}`}>
          <Button variant="ghost" size="sm" className="text-muted-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour à l&apos;étude
          </Button>
        </Link>
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <ShieldAlert className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-700 mb-1">Accès refusé</h2>
          <p className="text-sm text-zinc-500">
            Tu n&apos;as pas la permission <code className="px-1 py-0.5 bg-zinc-100 rounded text-xs">voir_factures</code> pour accéder à cette page.
          </p>
        </div>
      </div>
    )
  }

  const editingFacture = useMemo(
    () => factures.find((f) => f.id === editingId) ?? null,
    [factures, editingId]
  )

  // Initialise les lignes du formulaire à partir de l'état (phases/frais + facture en cours d'édition)
  const buildLignesFor = useCallback(
    (facture: FactureEtude | null) => {
      const result: LigneState[] = []

      // Frais en premier (comme dans le screenshot)
      if (frais.montant_total > 0) {
        const dejaFactureAutres =
          frais.deja_facture - (facture?.lignes.find((l) => l.type === "frais")?.montant ?? 0)
        const ligneCourante = facture?.lignes.find((l) => l.type === "frais")
        result.push({
          type: "frais",
          bloc_id: null,
          libelle: "Frais",
          montant_total: frais.montant_total,
          deja_facture_autres: dejaFactureAutres,
          montant: ligneCourante ? Number(ligneCourante.montant) : 0,
          pourcentage: ligneCourante ? Number(ligneCourante.pourcentage) : 0,
        })
      }

      // Puis les phases
      for (const ph of phases) {
        const ligneCourante = facture?.lignes.find(
          (l) => l.type === "phase" && l.bloc_id === ph.id
        )
        const dejaFactureAutres = ph.deja_facture - (ligneCourante ? Number(ligneCourante.montant) : 0)
        result.push({
          type: "phase",
          bloc_id: ph.id,
          libelle: ph.nom,
          montant_total: ph.montant_total,
          deja_facture_autres: dejaFactureAutres,
          montant: ligneCourante ? Number(ligneCourante.montant) : 0,
          pourcentage: ligneCourante ? Number(ligneCourante.pourcentage) : 0,
        })
      }

      return result
    },
    [phases, frais]
  )

  const openCreate = () => {
    setCreating(true)
    setEditingId(null)
    const today = new Date().toISOString().slice(0, 10)
    const echeance = new Date()
    echeance.setMonth(echeance.getMonth() + 1)
    setFormNom("Facture d'acompte")
    setFormDateEmission(today)
    setFormDateEcheance(echeance.toISOString().slice(0, 10))
    setFormDatePaiement("")
    setAcomptePct(60)
    // Pré-remplit les montants avec un acompte 60% du reste à facturer
    const base = buildLignesFor(null)
    const preFilled = base.map((l) => {
      const reste = Math.max(0, l.montant_total - l.deja_facture_autres)
      const montant = Math.round(reste * 0.6 * 100) / 100
      return { ...l, montant, pourcentage: 60 }
    })
    setLignes(preFilled)
  }

  const openEdit = (facture: FactureEtude) => {
    setCreating(false)
    setEditingId(facture.id)
    setFormNom(facture.nom ?? "Facture")
    setFormDateEmission(facture.date_emission ?? "")
    setFormDateEcheance(facture.date_echeance ?? "")
    setFormDatePaiement(facture.date_paiement ?? "")
    setAcomptePct(60)
    setLignes(buildLignesFor(facture))
  }

  const closeForm = () => {
    setCreating(false)
    setEditingId(null)
  }

  // Applique un pourcentage d'acompte à toutes les lignes (sur le reste à facturer)
  const applyAcompte = (pct: number) => {
    setLignes((curr) =>
      curr.map((l) => {
        const reste = Math.max(0, l.montant_total - l.deja_facture_autres)
        const montant = Math.round(reste * (pct / 100) * 100) / 100
        return {
          ...l,
          montant,
          pourcentage: pct,
        }
      })
    )
  }

  // Met à jour le montant d'une ligne et recalcule son pourcentage
  const updateLigneMontant = (idx: number, montant: number) => {
    setLignes((curr) =>
      curr.map((l, i) => {
        if (i !== idx) return l
        const reste = Math.max(0, l.montant_total - l.deja_facture_autres)
        const pct = reste > 0 ? (montant / reste) * 100 : 0
        return { ...l, montant: Math.max(0, montant), pourcentage: pct }
      })
    )
  }

  // Solder une ligne = facturer le reste à facturer
  const solderLigne = (idx: number) => {
    setLignes((curr) =>
      curr.map((l, i) => {
        if (i !== idx) return l
        const reste = Math.max(0, l.montant_total - l.deja_facture_autres)
        return { ...l, montant: reste, pourcentage: 100 }
      })
    )
  }

  const totalFacture = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
    [lignes]
  )

  const handleSave = async () => {
    if (lignes.length === 0) {
      toast.error(
        "Cette étude n'a ni budget HT ni phases d'échéancier. Renseigne le budget HT dans la fiche étude avant de créer une facture."
      )
      return
    }
    if (lignes.every((l) => Number(l.montant) <= 0)) {
      toast.error(
        "Tous les montants sont à 0. Clique sur « Appliquer » avec un % d'acompte, utilise « Solder » ou saisis un montant manuellement."
      )
      return
    }
    setSaving(true)

    const payload: FactureLigneInput[] = lignes
      .filter((l) => Number(l.montant) > 0)
      .map((l, i) => ({
        type: l.type,
        bloc_id: l.bloc_id,
        libelle: l.libelle,
        montant_total: l.montant_total,
        montant: Number(l.montant),
        pourcentage: Number(l.pourcentage),
        ordre: i,
      }))

    let res: any
    if (creating) {
      res = await createFactureEtude({
        etude_id: etudeId,
        nom: formNom || "Facture",
        date_emission: formDateEmission || null,
        date_echeance: formDateEcheance || null,
        date_paiement: formDatePaiement || null,
        lignes: payload,
      })
    } else if (editingId) {
      res = await updateFactureEtude(editingId, {
        nom: formNom,
        date_emission: formDateEmission || null,
        date_echeance: formDateEcheance || null,
        date_paiement: formDatePaiement || null,
        lignes: payload,
      })
    }
    setSaving(false)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success(creating ? "Facture créée" : "Facture mise à jour")
      closeForm()
      refresh()
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    if (!confirm("Supprimer cette facture ?")) return
    const res = (await deleteFactureEtude(editingId)) as any
    if (res?.error) toast.error(res.error)
    else {
      toast.success("Facture supprimée")
      closeForm()
      refresh()
    }
  }

  const togglePaiement = async (facture: FactureEtude) => {
    const date = facture.date_paiement ? null : new Date().toISOString().slice(0, 10)
    const res = (await marquerFactureEtudePaiement(facture.id, date)) as any
    if (res?.error) toast.error(res.error)
    else {
      toast.success(date ? "Paiement enregistré" : "Paiement annulé")
      refresh()
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/etudes/${etudeId}`}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour à l&apos;étude{etude?.numero ? ` ${etude.numero}` : ""}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-[#00236f] text-white text-xs font-semibold">
            {factures.length}
          </span>
          <Button
            onClick={openCreate}
            size="sm"
            className="bg-[#00236f] text-white hover:bg-[#1e3a8a] rounded-full w-9 h-9 p-0"
            title="Nouvelle facture"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#00236f] inline-flex items-center gap-2">
          <Banknote className="h-6 w-6" /> Factures
          <span className="text-[#00236f]/70 font-normal text-lg">
            de l&apos;étude {etude?.numero}
          </span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Émettez et suivez ici vos factures</p>
      </div>

      {/* Liste des factures existantes */}
      {!creating && !editingId && (
        <div className="space-y-3">
          {factures.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              Aucune facture pour cette étude. Cliquez sur «&nbsp;+&nbsp;» pour en créer une.
            </div>
          ) : (
            factures.map((f) => {
              const isPaye = !!f.date_paiement
              return (
                <div
                  key={f.id}
                  className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-0 min-w-[200px]">
                    <div className="text-lg font-bold text-[#00236f] flex items-center gap-2">
                      {f.nom ?? "Facture"}
                      {f.numero && (
                        <span className="text-xs font-mono font-normal text-zinc-400">#{f.numero}</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {f.date_emission
                        ? `émise le ${new Date(f.date_emission).toLocaleDateString("fr-FR")}`
                        : "Brouillon"}
                      {f.date_echeance && ` · à échéance le ${new Date(f.date_echeance).toLocaleDateString("fr-FR")}`}
                    </div>
                  </div>

                  {/* Statut paiement (badge, non cliquable) */}
                  {isPaye ? (
                    <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Payée
                    </span>
                  ) : (
                    <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 font-medium inline-flex items-center gap-1">
                      <Hourglass className="h-3 w-3" /> En attente
                    </span>
                  )}

                  <div className="text-right">
                    <div className="text-lg font-bold text-[#00236f]">{fmtEuro(f.montant_ht)} €</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Générer document PDF */}
                    <button
                      onClick={() => window.open(`/etudes/${etudeId}/factures/${f.id}/imprimer`, "_blank")}
                      className="text-xs px-2 py-1.5 rounded text-[#00236f] hover:bg-[#00236f]/10 inline-flex items-center gap-1"
                      title="Générer / imprimer la facture"
                    >
                      <FileDown className="h-4 w-4" />
                    </button>

                    {/* Toggle paiement */}
                    <button
                      onClick={() => togglePaiement(f)}
                      className={
                        isPaye
                          ? "text-xs px-2 py-1.5 rounded text-zinc-500 hover:bg-zinc-100"
                          : "text-xs px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium inline-flex items-center gap-1"
                      }
                      title={isPaye ? "Annuler le paiement" : "Marquer comme payée"}
                    >
                      {isPaye ? "Annuler paiement" : (<><Check className="h-3 w-3" /> Marquer payée</>)}
                    </button>

                    {/* Édition */}
                    <button
                      onClick={() => openEdit(f)}
                      className="text-zinc-400 hover:text-[#00236f] p-1.5"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Formulaire création / édition */}
      {(creating || editingId) && lignes.length === 0 && (
        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/50 p-6 text-center text-sm text-amber-800 space-y-2">
          <p className="font-semibold">Impossible de facturer cette étude</p>
          <p>
            L&apos;étude n&apos;a ni <strong>budget HT</strong> renseigné, ni <strong>phases d&apos;échéancier</strong> définies.<br />
            Renseigne au moins le budget HT dans la fiche étude pour pouvoir créer une facture.
          </p>
          <Button variant="ghost" onClick={closeForm} size="sm">Fermer</Button>
        </div>
      )}
      {(creating || editingId) && lignes.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-600">Nom</Label>
              <Input value={formNom} onChange={(e) => setFormNom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-600">Date d&apos;émission</Label>
              <Input
                type="date"
                value={formDateEmission}
                onChange={(e) => setFormDateEmission(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-600">Date d&apos;échéance</Label>
              <Input
                type="date"
                value={formDateEcheance}
                onChange={(e) => setFormDateEcheance(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-600 flex items-center gap-1">
                Date de paiement
                {formDatePaiement && (
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-red-500"
                    onClick={() => setFormDatePaiement("")}
                    title="Annuler le paiement"
                  >
                    <Ban className="h-3 w-3" />
                  </button>
                )}
              </Label>
              <Input
                type="date"
                value={formDatePaiement}
                onChange={(e) => setFormDatePaiement(e.target.value)}
                placeholder="Date de paiement"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-600">Facturer un acompte de</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={acomptePct}
                  onChange={(e) => setAcomptePct(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm">%</span>
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => applyAcompte(acomptePct)}
                >
                  Appliquer
                </Button>
              </div>
            </div>
          </div>

          {editingFacture?.numero_dans_etude && (
            <div className="text-xs text-zinc-500">
              Numéro dans l&apos;étude : <span className="font-semibold">{editingFacture.numero_dans_etude}</span>
              <span className="ml-3">({editingFacture.numero})</span>
            </div>
          )}

          {/* Frais */}
          {lignes.filter((l) => l.type === "frais").length > 0 && (
            <div>
              <h3 className="text-center text-[#00236f] font-semibold mb-3">Frais</h3>
              {lignes
                .map((l, i) => ({ l, i }))
                .filter(({ l }) => l.type === "frais")
                .map(({ l, i }) => (
                  <LigneRow
                    key={`frais-${i}`}
                    ligne={l}
                    onMontantChange={(v) => updateLigneMontant(i, v)}
                    onSolder={() => solderLigne(i)}
                  />
                ))}
            </div>
          )}

          {/* Phases */}
          {lignes.filter((l) => l.type === "phase").length > 0 && (
            <div>
              <h3 className="text-center text-[#00236f] font-semibold mb-3">Phases à facturer</h3>
              {lignes
                .map((l, i) => ({ l, i }))
                .filter(({ l }) => l.type === "phase")
                .map(({ l, i }) => (
                  <LigneRow
                    key={`phase-${i}`}
                    ligne={l}
                    onMontantChange={(v) => updateLigneMontant(i, v)}
                    onSolder={() => solderLigne(i)}
                  />
                ))}
            </div>
          )}

          {/* Total */}
          <div className="flex justify-end text-sm">
            <div className="text-right">
              <div className="text-xs text-zinc-500">Total facture</div>
              <div className="text-2xl font-bold text-[#00236f]">{fmtEuro(totalFacture)} €</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="ghost" onClick={closeForm}>
              Annuler
            </Button>
            {editingId && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Supprimer
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Sauvegarder
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sous-composant : ligne de facture (frais ou phase)
// ============================================================

function LigneRow({
  ligne,
  onMontantChange,
  onSolder,
}: {
  ligne: LigneState
  onMontantChange: (v: number) => void
  onSolder: () => void
}) {
  const restant = Math.max(0, ligne.montant_total - ligne.deja_facture_autres)
  const dejaFactureSiTotal = ligne.deja_facture_autres + (Number(ligne.montant) || 0)
  const pctTotal = ligne.montant_total > 0 ? (dejaFactureSiTotal / ligne.montant_total) * 100 : 0
  const pctLigne = ligne.montant_total > 0 ? (Number(ligne.montant) / ligne.montant_total) * 100 : 0

  return (
    <div className="grid grid-cols-12 items-center gap-3 py-2">
      <div className="col-span-3 text-sm text-zinc-700 text-right pr-2">{ligne.libelle}</div>
      <div className="col-span-4">
        <div className="relative h-2 rounded-full bg-zinc-200 overflow-hidden">
          {/* Déjà facturé sur d'autres factures (barre claire) */}
          {ligne.deja_facture_autres > 0 && ligne.montant_total > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-amber-200"
              style={{
                width: `${Math.min(100, (ligne.deja_facture_autres / ligne.montant_total) * 100)}%`,
              }}
            />
          )}
          {/* Cette facture (barre dorée) */}
          {ligne.montant > 0 && ligne.montant_total > 0 && (
            <div
              className="absolute inset-y-0 bg-[#C9A84C]"
              style={{
                left: `${Math.min(100, (ligne.deja_facture_autres / ligne.montant_total) * 100)}%`,
                width: `${Math.min(100, pctLigne)}%`,
              }}
            />
          )}
        </div>
      </div>
      <div className="col-span-2 flex items-center gap-1 text-sm">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={Number(ligne.montant).toFixed(2)}
          onChange={(e) => onMontantChange(Number(e.target.value))}
          className="h-8 text-right"
        />
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          €/{ligne.montant_total.toLocaleString("fr-FR")} €
        </span>
      </div>
      <div className="col-span-1 text-sm text-zinc-600 text-right">
        {pctTotal.toFixed(0)} %
      </div>
      <div className="col-span-2 flex justify-end">
        <Button
          size="sm"
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
          onClick={onSolder}
          disabled={restant <= 0}
          title={restant <= 0 ? "Déjà soldée" : "Facturer le reste"}
        >
          Solder
        </Button>
      </div>
    </div>
  )
}
