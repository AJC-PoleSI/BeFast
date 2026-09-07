import { describe, it, expect } from "vitest"
import fs from "node:fs"
import { PDFDocument } from "pdf-lib"
import { renderFacturePdf } from "./pdf"

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

  // Échantillon visuel à la demande : FACTURE_PDF_OUT=/chemin/x.pdf npm run test
  it.runIf(!!process.env.FACTURE_PDF_OUT)("écrit un échantillon visuel", async () => {
    const ctx = process.env.FACTURE_PDF_CTX
      ? JSON.parse(fs.readFileSync(process.env.FACTURE_PDF_CTX, "utf8"))
      : acompte
    fs.writeFileSync(process.env.FACTURE_PDF_OUT!, await renderFacturePdf(ctx))
    expect(fs.existsSync(process.env.FACTURE_PDF_OUT!)).toBe(true)
  })
})
