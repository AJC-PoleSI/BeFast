// Génération du fichier Excel (.xlsx) d'un budget de proposition, mise en page
// simplifiée du template Audencia (Budget Final + Modalités + Synthèse).
// Server-only (utilise exceljs).

import ExcelJS from "exceljs"
import type { BudgetBreakdown } from "@/lib/budget/compute"
import type { BudgetSheetMeta } from "@/components/budget/BudgetSheet"

const DARK = "FF3F3F46" // zinc-700
const LIGHT = "FFF4F4F5" // zinc-100
const GREY = "FFE4E4E7" // zinc-200

function eur(cell: ExcelJS.Cell) {
  cell.numFmt = '#,##0.00 "€"'
  cell.alignment = { horizontal: "right" }
}

export async function buildBudgetWorkbook(
  b: BudgetBreakdown,
  meta: BudgetSheetMeta
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "BeFast — Audencia Junior Conseil"
  const ws = wb.addWorksheet("Budget")

  ws.columns = [
    { width: 42 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
  ]

  // Titre + détail mission
  ws.mergeCells("A1:D1")
  const title = ws.getCell("A1")
  title.value = "Budget de la proposition"
  title.font = { bold: true, size: 14, color: { argb: "FF00236F" } }

  let r = 3
  const metaLines: [string, string | null | undefined][] = [
    ["Propale", meta.id],
    ["Client", meta.client_company],
    ["Type d'étude", meta.study_type],
    ["Chef de projet", meta.cdp_name],
  ]
  for (const [label, val] of metaLines) {
    if (!val) continue
    ws.getCell(`A${r}`).value = label
    ws.getCell(`A${r}`).font = { color: { argb: "FF71717A" } }
    ws.mergeCells(`B${r}:D${r}`)
    ws.getCell(`B${r}`).value = val
    ws.getCell(`B${r}`).font = { bold: true }
    r++
  }
  r++

  // En-tête tableau principal
  const headerRow = r
  const headers = ["Phases", "J.E.H.", "Montant", "TOTAL"]
  headers.forEach((h, i) => {
    const c = ws.getCell(headerRow, i + 1)
    c.value = h
    c.font = { bold: true, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } }
    c.alignment = { horizontal: i === 0 ? "left" : "right" }
    c.border = allBorders()
  })
  r++

  const rows = [
    ...b.phases.map((p) => [p.name || "Phase", p.jeh, p.prixJeh, p.montant] as const),
    ...(b.suiviJeh > 0 || b.suiviTotal > 0
      ? [["Suivi de l'étude", b.suiviJeh, b.suiviPrixJeh, b.suiviTotal] as const]
      : []),
  ]
  rows.forEach((row, idx) => {
    const c1 = ws.getCell(r, 1)
    c1.value = row[0]
    c1.border = allBorders()
    const c2 = ws.getCell(r, 2)
    c2.value = row[1]
    c2.alignment = { horizontal: "right" }
    c2.border = allBorders()
    const c3 = ws.getCell(r, 3)
    c3.value = row[2]
    eur(c3)
    c3.border = allBorders()
    const c4 = ws.getCell(r, 4)
    c4.value = row[3]
    eur(c4)
    c4.border = allBorders()
    if (idx % 2 === 1) {
      for (let col = 1; col <= 4; col++) {
        ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } }
      }
    }
    r++
  })

  r++
  const synthStart = r

  // Synthèse (colonnes C/D)
  const synth: [string, number, { bold?: boolean; italic?: boolean; net?: boolean }][] = [
    ["Total J.E.H. HT", b.totalJehHt, {}],
    ["Frais de structure*", b.fraisStructure, {}],
    ["Total HT", b.totalHt, { bold: true }],
    [`TVA applicable (${b.tvaPct} %)`, b.tva, { italic: true }],
    ["NET À PAYER", b.netAPayer, { bold: true, net: true }],
  ]
  synth.forEach(([label, val, opt]) => {
    const lc = ws.getCell(r, 3)
    lc.value = label
    lc.font = { bold: !!opt.bold, italic: !!opt.italic }
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opt.net ? GREY : LIGHT } }
    lc.border = allBorders("FFD4D4D8")
    const vc = ws.getCell(r, 4)
    vc.value = val
    eur(vc)
    vc.font = { bold: !!opt.bold, italic: !!opt.italic }
    if (opt.net) vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } }
    vc.border = allBorders("FFD4D4D8")
    r++
  })

  // Modalités de règlement (colonnes A/B, en face de la synthèse)
  ws.getCell(synthStart, 1).value = "Modalités de règlement :"
  ws.getCell(synthStart, 1).font = { bold: true }
  ws.getCell(synthStart + 1, 1).value = `– Acompte de 60 % à la signature : ${fmt(b.acompte60)}`
  ws.getCell(synthStart + 2, 1).value = `– Solde (40 %) au PV de recette : ${fmt(b.solde40)}`
  ws.getCell(synthStart + 4, 1).value =
    "*Frais de structure : administratifs, postaux, logiciels, impression, transport."
  ws.getCell(synthStart + 4, 1).font = { italic: true, size: 9, color: { argb: "FF71717A" } }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}

function allBorders(argb = "FF000000"): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as const, color: { argb } }
  return { top: side, left: side, bottom: side, right: side }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €"
}
