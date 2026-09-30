import { describe, it, expect } from "vitest"
import fs from "node:fs"
import { PDFDocument } from "pdf-lib"
import { renderFacturePdf, PAGE_H, type TexteTrace } from "./pdf"

const acompte = {
  nb_jeh: 12,
  phases: [
    { nom: "Recueil terrain & grille", nombre_jeh: 2, prix_jeh: 439, montant_ht: 878 },
    { nom: "Suivi de l'étude", nombre_jeh: 6, prix_jeh: 361, montant_ht: 2166 },
  ],
  etude: { tarif_ht: "5000.00" },
  junior: { raison_sociale: "Audencia Junior Conseil", siret: "331 647 750 00016" },
  entreprise: { nom: "RESOTIC", ville: "CLERMONT-FERRAND" },
  signataire: { nom: "Lusseau", prenom: "Guillaume" },
  tresorier: { prenom: "Arthur", nom: "Robin" },
  facturation: {
    numero: "26030",
    objet: "Facture d'acompte concernant l'étude 2615 en référence à la convention d'étude 26CE15.",
    est_acompte: true,
    total_prestation: 4800,
    ligne_frais: 200,
    libelle_deduction: "Total HT de l'étude",
    montant_deduction: 5000,
    libelle_ligne: "Montant de l'acompte (60%)",
    montant_ht: 3000,
    mention_tva_acompte: " sur l'acompte",
    tva_taux: 20,
    montant_tva: 600,
    libelle_ttc: "Acompte",
    montant_ttc: 3600,
    total_ht_etude: 5000,
    emitted_at: "18/05/2026",
    due_at: "17/06/2026",
  },
}

const solde = {
  ...acompte,
  facturation: {
    ...acompte.facturation,
    numero: "26036",
    // Objet sur deux lignes : c'est ce cas qui faisait remonter le pied de page
    // par-dessus le bloc « Pour les chèques ».
    objet:
      "Facture de solde concernant l'étude 2615 en référence à la convention d'étude 26CE15 et au Procès-Verbal de Recette Final 26PVRF15.",
    est_acompte: false,
    libelle_deduction: "Déduction des factures précédentes (HT)",
    montant_deduction: 3000,
    libelle_ligne: "Total HT",
    montant_ht: 2000,
    mention_tva_acompte: "",
    montant_tva: 400,
    libelle_ttc: "Total",
    montant_ttc: 2400,
  },
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount()
}

// Désignations réelles de l'étude 2620 : bien plus larges que la colonne.
const ambassadeurs = {
  ...acompte,
  phases: [
    "Ambassadeurs digitaux - Création de contenus stratégiques. 05/10/2026 → 29/11/2027",
    "Ambassadeurs digitaux - Création de contenus stratégiques. 01/02/2027 → 27/06/2027",
    "Suivi d'étude",
    "Ambassadeurs digitaux - Création de contenus stratégiques.30/11/2026 → 31/01/2027",
    "Création de contenus stratégiques par 26 intervenants - 29/03/2027 → 27/06/2027",
  ].map((nom) => ({ nom, nombre_jeh: 26, prix_jeh: 227, montant_ht: 5902 })),
}

async function tracer(ctx: Record<string, any>): Promise<TexteTrace[]> {
  const textes: TexteTrace[] = []
  await renderFacturePdf(ctx, { trace: (t) => textes.push(t) })
  return textes
}

function chevauchements(textes: TexteTrace[]): string[] {
  const conflits: string[] = []
  textes.forEach((a, i) =>
    textes.slice(i + 1).forEach((b) => {
      const memePage = a.page === b.page
      const x = a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5
      const y = a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
      if (memePage && x && y) conflits.push(`« ${a.texte} » / « ${b.texte} »`)
    })
  )
  return conflits
}

describe("renderFacturePdf", () => {
  it("rend une facture d'acompte sur une page", async () => {
    const bytes = await renderFacturePdf(acompte)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-")
    expect(await pageCount(bytes)).toBe(1)
  })

  it("rend une facture de solde (objet sur deux lignes) sur une page", async () => {
    expect(await pageCount(await renderFacturePdf(solde))).toBe(1)
  })

  it("ne casse pas sur un contexte vide (facture sans étude ni client)", async () => {
    const bytes = await renderFacturePdf({})
    expect(await pageCount(bytes)).toBe(1)
  })

  it("neutralise les caractères hors WinAnsi au lieu de planter", async () => {
    // Une donnée saisie peut contenir n'importe quoi ; les polices standard
    // PDF ne connaissent que CP1252 et `drawText` lèverait une exception.
    const bytes = await renderFacturePdf({
      ...acompte,
      entreprise: { nom: "Клиент 🚀 — Ünïcode", ville: "Nantes" },
    })
    expect(await pageCount(bytes)).toBe(1)
  })

  it("ne superpose aucun texte sur une facture courte", async () => {
    expect(chevauchements(await tracer(solde))).toEqual([])
  })

  it("replie les désignations longues au lieu de déborder sur la colonne JEH (étude 2620)", async () => {
    const textes = await tracer(ambassadeurs)
    expect(chevauchements(textes)).toEqual([])
    const jeh = textes.find((t) => t.texte === "Nombre de JEH")!
    for (const t of textes.filter((t) => t.texte.includes("Ambassadeurs"))) {
      expect(t.x1).toBeLessThan(jeh.x0)
    }
  })

  it("garde la flèche des périodes lisible (hors WinAnsi)", async () => {
    const texte = (await tracer(ambassadeurs)).map((t) => t.texte).join(" ")
    expect(texte).toContain("05/10/2026 – 29/11/2027")
  })

  it("passe sur une seconde page plutôt que de couper le bas de la facture", async () => {
    const phases = Array.from({ length: 14 }, (_, i) => ({ ...ambassadeurs.phases[0], nom: `${ambassadeurs.phases[0].nom} (${i + 1})` }))
    const ctx = { ...ambassadeurs, phases }
    const textes = await tracer(ctx)
    expect(await pageCount(await renderFacturePdf(ctx))).toBeGreaterThan(1)
    expect(chevauchements(textes)).toEqual([])
    for (const t of textes) expect(t.bottom).toBeLessThanOrEqual(PAGE_H - 15)
    // Le récapitulatif de fin (« Net à payer ») est bien imprimé.
    expect(textes.some((t) => t.texte.includes("Net à payer"))).toBe(true)
  })

  it("tient la facture 2620 (5 lignes sur deux lignes chacune) sans rien couper", async () => {
    const textes = await tracer(ambassadeurs)
    for (const t of textes) expect(t.bottom).toBeLessThanOrEqual(PAGE_H - 15)
    expect(textes.some((t) => t.texte.includes("Net à payer"))).toBe(true)
  })

  // Échantillon visuel à la demande : FACTURE_PDF_OUT=/chemin/x.pdf npm run test
  it.runIf(!!process.env.FACTURE_PDF_OUT)("écrit un échantillon visuel", async () => {
    const ctx = process.env.FACTURE_PDF_CTX
      ? JSON.parse(fs.readFileSync(process.env.FACTURE_PDF_CTX, "utf8"))
      : acompte
    fs.writeFileSync(process.env.FACTURE_PDF_OUT!, await renderFacturePdf(ctx))
    expect(fs.existsSync(process.env.FACTURE_PDF_OUT!)).toBe(true)
  })
})
