/**
 * Rendu PDF d'une facture AJC — reproduction de la maquette Word
 * (`facture-befast-v3.docx`) sans passer par Word.
 *
 * Le PDF et le .docx consomment EXACTEMENT le même contexte, celui construit
 * par `buildFactureContext` (lib/actions/documents.ts) : un seul jeu de règles
 * métier (montants, TVA, libellés par type de facture, objet), deux sorties.
 * Toute évolution du calcul se fait donc dans le contexte, jamais ici.
 *
 * Repère : pdf-lib place l'origine en bas à gauche ; tout le code ci-dessous
 * raisonne en coordonnées « depuis le haut » via `y()`.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib"
import { LOGO_AJC_PNG_BASE64, LOGO_AJC_RATIO } from "./logo"

// ── Gabarit A4 ────────────────────────────────────────────────────────────
const PAGE_W = 595.28
const PAGE_H = 841.89
const M_LEFT = 50
const M_RIGHT = 566
const COL_RIGHT = 318 // colonne de droite de l'en-tête (n° de facture, client)

const NOIR = rgb(0.12, 0.12, 0.13)
const GRIS = rgb(0.5, 0.5, 0.52)
const GRIS_FOND = rgb(0.898, 0.898, 0.898)
const GRIS_LIGNE = rgb(0.72, 0.72, 0.74)
const ZEBRE = rgb(0.957, 0.957, 0.961)

export type FactureRenderContext = Record<string, any>

const fmtMontant = (n: unknown): string => {
  const v = Number(n ?? 0)
  return (Number.isFinite(v) ? v : 0).toFixed(2)
}

const fmtEntier = (n: unknown): string => {
  const v = Number(n ?? 0)
  return String(Number.isFinite(v) ? Math.round(v) : 0)
}

/**
 * Les polices standard PDF sont encodées en WinAnsi (CP1252) : un caractère
 * hors de ce jeu (guillemets typographiques exotiques, tirets longs rares,
 * emoji collé dans un nom de client…) ferait planter `drawText`. On remplace
 * les cas courants et on écarte le reste plutôt que de rendre la facture
 * ingénérable à cause d'un caractère parasite dans une donnée saisie.
 */
function winAnsi(input: unknown): string {
  const s = String(input ?? "")
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E -ÿ€–—]/g, "")
}

class Sheet {
  readonly page: PDFPage
  constructor(
    page: PDFPage,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly italic: PDFFont
  ) {
    this.page = page
  }

  /** Convertit une ordonnée « depuis le haut » en ordonnée PDF. */
  y(fromTop: number): number {
    return PAGE_H - fromTop
  }

  text(
    value: unknown,
    x: number,
    top: number,
    opts: {
      size?: number
      bold?: boolean
      italic?: boolean
      color?: RGB
      align?: "left" | "right" | "center"
      width?: number
    } = {}
  ): void {
    const t = winAnsi(value)
    if (!t) return
    const size = opts.size ?? 10
    const font = opts.bold ? this.bold : opts.italic ? this.italic : this.regular
    let x0 = x
    if (opts.align === "right") {
      x0 = x - font.widthOfTextAtSize(t, size)
    } else if (opts.align === "center") {
      x0 = x - font.widthOfTextAtSize(t, size) / 2
    }
    this.page.drawText(t, {
      x: x0,
      y: this.y(top) - size,
      size,
      font,
      color: opts.color ?? NOIR,
    })
  }

  /** Écrit un texte en le repliant sur `maxWidth`, et renvoie l'ordonnée finale. */
  paragraph(
    value: unknown,
    x: number,
    top: number,
    maxWidth: number,
    opts: { size?: number; color?: RGB; lineHeight?: number } = {}
  ): number {
    const size = opts.size ?? 8.5
    const lh = opts.lineHeight ?? size + 2.5
    const mots = winAnsi(value).split(/\s+/).filter(Boolean)
    let ligne = ""
    let cursor = top
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot
      if (this.regular.widthOfTextAtSize(essai, size) > maxWidth && ligne) {
        this.text(ligne, x, cursor, { size, color: opts.color })
        cursor += lh
        ligne = mot
      } else {
        ligne = essai
      }
    }
    if (ligne) {
      this.text(ligne, x, cursor, { size, color: opts.color })
      cursor += lh
    }
    return cursor
  }

  line(x1: number, top: number, x2: number, opts: { color?: RGB; width?: number } = {}): void {
    this.page.drawLine({
      start: { x: x1, y: this.y(top) },
      end: { x: x2, y: this.y(top) },
      thickness: opts.width ?? 0.7,
      color: opts.color ?? GRIS_LIGNE,
    })
  }

  rect(x: number, top: number, w: number, h: number, color: RGB): void {
    this.page.drawRectangle({ x, y: this.y(top + h), width: w, height: h, color })
  }

  border(x: number, top: number, w: number, h: number, color: RGB = GRIS_LIGNE): void {
    this.page.drawRectangle({
      x,
      y: this.y(top + h),
      width: w,
      height: h,
      borderColor: color,
      borderWidth: 0.7,
    })
  }
}

/**
 * Produit le PDF de la facture à partir du contexte de `buildFactureContext`.
 * Renvoie les octets du fichier.
 */
export async function renderFacturePdf(ctx: FactureRenderContext): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_W, PAGE_H])
  const s = new Sheet(
    page,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
    await doc.embedFont(StandardFonts.HelveticaOblique)
  )

  const f = ctx.facturation ?? {}
  const junior = ctx.junior ?? {}
  const entreprise = ctx.entreprise ?? {}
  const signataire = ctx.signataire ?? {}
  const tresorier = ctx.tresorier ?? {}
  const etude = ctx.etude ?? {}
  const phases: any[] = Array.isArray(ctx.phases) ? ctx.phases : []

  // ── Logo ────────────────────────────────────────────────────────────────
  const logo = await doc.embedPng(Buffer.from(LOGO_AJC_PNG_BASE64, "base64"))
  const logoW = 104
  page.drawImage(logo, {
    x: M_LEFT + 2,
    y: s.y(18 + logoW / LOGO_AJC_RATIO),
    width: logoW,
    height: logoW / LOGO_AJC_RATIO,
  })

  // ── En-tête droite : n° de facture + destinataire ────────────────────────
  s.text(`Facture N° ${winAnsi(f.numero || "")}`, COL_RIGHT, 30, { size: 13, bold: true })
  s.text("A l'attention de :", COL_RIGHT, 86, { size: 11 })

  let top = 110
  s.text(entreprise.nom, COL_RIGHT, top, { size: 13, bold: true })
  top += 18
  const contact = [signataire.civilite, signataire.nom, signataire.prenom]
    .filter(Boolean)
    .join(" ")
  if (contact) {
    s.text(contact, COL_RIGHT, top, { size: 13, bold: true })
    top += 18
  }
  for (const ligne of [
    entreprise.adresse,
    [entreprise.code_postal, entreprise.ville].filter(Boolean).join(" - "),
    entreprise.pays,
  ]) {
    if (!String(ligne ?? "").trim()) continue
    s.text(ligne, COL_RIGHT, top, { size: 12.5 })
    top += 18
  }

  // ── En-tête gauche : identité de la Junior ───────────────────────────────
  let g = 163
  s.text(junior.raison_sociale, M_LEFT, g, { size: 11, bold: true })
  g += 17
  const statut = [junior.statut_juridique, junior.affiliation || "affiliée à la CNJE"]
    .filter(Boolean)
    .join(", ")
  s.text(statut, M_LEFT, g, { size: 11, color: GRIS })
  g += 19
  for (const ligne of [junior.adresse1, junior.adresse2]) {
    if (!String(ligne ?? "").trim()) continue
    s.text(ligne, M_LEFT, g, { size: 11 })
    g += 19
  }
  s.text([junior.code_postal, junior.ville].filter(Boolean).join(" - "), M_LEFT, g, { size: 11 })
  g += 22

  for (const [label, valeur] of [
    ["SIRET :", junior.siret],
    ["Code APE :", junior.code_ape],
    ["N° URSSAF :", junior.n_urssaf],
    ["N° TVA intra :", junior.n_tva_intra],
    ["SIREN :", junior.siren],
  ] as const) {
    s.text(label, M_LEFT, g, { size: 10, bold: true })
    s.text(valeur, M_LEFT + s.bold.widthOfTextAtSize(winAnsi(label), 10) + 4, g, {
      size: 10,
      color: GRIS,
    })
    g += 13
  }

  // ── Bandeau « Objet » ────────────────────────────────────────────────────
  const objet = String(f.objet ?? "").trim()
  const objetTop = 328
  const objetLignes = decouper(
    objet,
    s.regular,
    10.5,
    M_RIGHT - M_LEFT - 24 - s.bold.widthOfTextAtSize("Objet : ", 10.5)
  )
  const objetH = 12 + objetLignes.length * 14
  s.rect(M_LEFT, objetTop, M_RIGHT - M_LEFT, objetH, GRIS_FOND)
  objetLignes.forEach((ligne, i) => {
    const prefix = i === 0 ? "Objet : " : ""
    const largeur =
      s.bold.widthOfTextAtSize(prefix, 10.5) + s.regular.widthOfTextAtSize(ligne, 10.5)
    const x0 = (PAGE_W - largeur) / 2
    if (prefix) s.text(prefix, x0, objetTop + 8 + i * 14, { size: 10.5, bold: true })
    s.text(ligne, x0 + s.bold.widthOfTextAtSize(prefix, 10.5), objetTop + 8 + i * 14, {
      size: 10.5,
    })
  })

  // ── Tableau des prestations ──────────────────────────────────────────────
  const X_JEH = 400 // bord droit de la colonne « Nombre de JEH »
  const X_PU = 495 // bord droit de « Montant unitaire »
  const X_HT = M_RIGHT - 4 // bord droit de « Montant HT »

  let t = objetTop + objetH + 22
  s.line(M_LEFT, t, M_RIGHT, { color: NOIR, width: 1 })
  t += 3
  s.text("Désignation", M_LEFT + 4, t, { size: 10, bold: true })
  s.text("Nombre de JEH", X_JEH, t, { size: 10, bold: true, align: "right" })
  s.text("Montant unitaire", X_PU, t, { size: 10, bold: true, align: "right" })
  s.text("Montant HT", X_HT, t, { size: 10, bold: true, align: "right" })
  t += 14
  s.line(M_LEFT, t, M_RIGHT, { color: NOIR, width: 1 })

  phases.forEach((p, i) => {
    const h = 16
    if (i % 2 === 0) s.rect(M_LEFT, t, M_RIGHT - M_LEFT, h, ZEBRE)
    s.text(p.nom, M_LEFT + 4, t + 3.5, { size: 10 })
    s.text(fmtEntier(p.nombre_jeh), X_JEH, t + 3.5, { size: 10, align: "right" })
    s.text(fmtMontant(p.prix_jeh), X_PU, t + 3.5, { size: 10, align: "right" })
    s.text(fmtMontant(p.montant_ht), X_HT, t + 3.5, { size: 10, align: "right" })
    t += h
  })
  s.line(M_LEFT, t, M_RIGHT, { color: NOIR, width: 1 })

  // ── Dates + synthèse de l'étude (colonne gauche) ─────────────────────────
  const blocTop = Math.max(t + 34, 470)
  let d = blocTop
  for (const [label, valeur] of [
    ["Date d'émission de la facture :", f.emitted_at],
    ["Date d'échéance de la facture :", f.due_at],
  ] as const) {
    s.text(label, M_LEFT, d, { size: 10, bold: true })
    s.text(valeur, 232, d, { size: 10 })
    d += 14
  }
  d += 16
  for (const [label, valeur] of [
    ["Nombre total de JEH(s) :", fmtEntier(ctx.nb_jeh)],
    ["Montant total HT (EUR) de l'étude :", fmtMontant(f.total_ht_etude ?? etude.tarif_ht)],
  ] as const) {
    s.text(label, M_LEFT, d, { size: 10, bold: true })
    s.text(valeur, 232, d, { size: 10 })
    d += 14
  }

  // ── Bloc des totaux (colonne droite, encadré) ────────────────────────────
  const estAcompte = !!f.est_acompte
  const totaux: Array<{ label: string; valeur: string; bold?: boolean; note?: string }> = [
    { label: "Total prestation", valeur: fmtMontant(f.total_prestation) },
    { label: "Frais", valeur: fmtMontant(f.ligne_frais) },
    { label: String(f.libelle_deduction ?? ""), valeur: fmtMontant(f.montant_deduction), bold: true },
    { label: String(f.libelle_ligne ?? ""), valeur: fmtMontant(f.montant_ht), bold: true },
    {
      label: `Montant TVA${winAnsi(f.mention_tva_acompte ?? "")} (${fmtMontant(f.tva_taux)}%)`,
      valeur: fmtMontant(f.montant_tva),
      bold: true,
      note: String(f.mention_regime_tva || "TVA sur les encaissements"),
    },
  ]

  const BOX_X = 329
  const BOX_W = M_RIGHT - BOX_X
  const X_LABEL_R = 496 // bord droit de la colonne des libellés
  const X_SEP = 502 // filet vertical entre libellés et montants
  const X_VAL_R = M_RIGHT - 8 // bord droit des montants
  const boxTop = blocTop - 4
  let b = boxTop
  totaux.forEach((r, i) => {
    const h = r.note ? 24 : 14
    s.text(r.label, X_LABEL_R, b + 2, { size: 9.5, bold: r.bold, align: "right" })
    s.text(r.valeur, X_VAL_R, b + 2, { size: 9.5, align: "right" })
    if (r.note) s.text(r.note, X_LABEL_R, b + 13, { size: 8, italic: true, align: "right" })
    // Filet après « Frais » : sépare le rappel du budget de l'étude du calcul
    // propre à cette facture.
    if (i === 1) s.line(BOX_X, b + h, M_RIGHT)
    b += h
  })
  s.line(BOX_X, b, M_RIGHT, { color: NOIR, width: 1 })

  const libelleTtc = `${winAnsi(f.libelle_ttc ?? "Total")} TTC à payer`
  s.text(libelleTtc, X_LABEL_R, b + 3, { size: 10, bold: true, align: "right" })
  s.text(`${fmtMontant(f.montant_ttc)} €`, X_VAL_R, b + 3, {
    size: 10,
    bold: true,
    align: "right",
  })
  b += 17
  s.border(BOX_X, boxTop, BOX_W, b - boxTop)
  s.page.drawLine({
    start: { x: X_SEP, y: s.y(boxTop) },
    end: { x: X_SEP, y: s.y(b) },
    thickness: 0.7,
    color: GRIS_LIGNE,
  })

  // ── Mentions légales ─────────────────────────────────────────────────────
  let m = Math.max(b + 20, 548)
  s.text(
    f.mention_escompte || "Aucun escompte n'est accordé en cas de paiement anticipé",
    M_LEFT,
    m,
    { size: 8.5, color: GRIS }
  )
  m += 10.5
  const penalites = f.taux_penalites || "3 fois le taux d'intérêt légal en vigueur"
  const indemnite = f.indemnite_recouvrement || "40 euros"
  m = s.paragraph(
    `En cas de retard de paiement, conformément à la loi 2008-776 du 4 août 2008, il sera appliqué des pénalités au taux de ${winAnsi(penalites)} et en application des articles L441-3 et L441-6 du code de commerce, il sera appliqué une indemnité de recouvrement de ${winAnsi(indemnite)}.`,
    M_LEFT,
    m,
    300,
    { size: 8.5, color: GRIS, lineHeight: 10.5 }
  )
  m = s.paragraph(
    "Cette pénalité court à compter de la date d'échéance jusqu'au jour du paiement complet des sommes dues.",
    M_LEFT,
    m,
    460,
    { size: 8.5, color: GRIS, lineHeight: 10.5 }
  )
  s.text(f.conditions_reglement || "A réception de facture", M_LEFT, m, {
    size: 8.5,
    color: GRIS,
  })

  // ── Modalités de paiement ────────────────────────────────────────────────
  let p = Math.max(m + 18, 626)
  s.text("Modalités de paiement :", M_LEFT, p, { size: 10, bold: true })
  const nomTresorier = [tresorier.prenom, tresorier.nom].filter(Boolean).join(" ")
  if (nomTresorier) {
    // « Le Trésorier » / « La Trésorière » : accordé sur parametres.tresorier_genre.
    const titre = `${winAnsi(tresorier.titre_fonction || "Le Trésorier")},`
    s.text(titre, 355, p, { size: 10, bold: true })
    s.text(nomTresorier, 355 + s.bold.widthOfTextAtSize(titre, 10) + 4, p, { size: 10 })
  }
  p += 15

  const gaucheModalites = [
    { texte: "Pour les versements", italic: false },
    { texte: "Merci d'indiquer votre nom", italic: true },
    { texte: "et numéro de facture", italic: false },
  ]
  const droiteModalites = [
    junior.banque_rib ? `RIB : ${winAnsi(junior.banque_rib)}` : "",
    junior.banque_domiciliation ? `Domiciliation : ${winAnsi(junior.banque_domiciliation)}` : "",
    junior.banque_iban ? `IBAN : ${winAnsi(junior.banque_iban)}` : "",
    junior.banque_bic ? `BIC ${winAnsi(junior.banque_bic)}` : "",
  ]
  for (let i = 0; i < Math.max(gaucheModalites.length, droiteModalites.length); i++) {
    const l = gaucheModalites[i]
    if (l) s.text(l.texte, M_LEFT, p, { size: 10, italic: l.italic, color: l.italic ? GRIS : NOIR })
    if (droiteModalites[i]) s.text(droiteModalites[i], 195, p, { size: 10 })
    p += 12.5
  }

  p += 8
  s.text("Pour les chèques", M_LEFT, p, { size: 10 })
  s.text(`A l'ordre de ${winAnsi(junior.ordre_cheques || junior.raison_sociale || "")}`, 160, p, {
    size: 10,
  })

  // ── Pied de page ─────────────────────────────────────────────────────────
  // Le pied suit toujours le flux : le borner par le haut le faisait remonter
  // au-dessus du bloc « Pour les chèques » dès que l'objet passait sur deux
  // lignes (facture de solde citant la convention ET le PVRF).
  const pied = Math.max(p + 26, 726)
  s.text(
    "Pour un règlement par chèque, nous vous remercions d'envoyer votre règlement accompagné du papillon à l'adresse :",
    PAGE_W / 2,
    pied,
    { size: 9, bold: true, align: "center" }
  )
  const adresseComplete = [
    junior.raison_sociale,
    [junior.adresse1, junior.adresse2, junior.code_postal, junior.ville]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")
  s.text(adresseComplete, PAGE_W / 2, pied + 14, { size: 9.5, align: "center" })

  s.line(M_LEFT, pied + 36, M_RIGHT)
  s.text(
    `Client : ${winAnsi(entreprise.nom || "")} ${winAnsi(f.numero || "")} – Net à payer : ${fmtMontant(
      f.montant_ttc
    )} EUR`,
    M_LEFT,
    pied + 44,
    { size: 10, color: GRIS }
  )

  return doc.save()
}

/** Découpe un texte en lignes tenant dans `maxWidth` pour la police donnée. */
function decouper(texte: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const mots = winAnsi(texte).split(/\s+/).filter(Boolean)
  if (mots.length === 0) return [""]
  const lignes: string[] = []
  let courante = ""
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, size) > maxWidth && courante) {
      lignes.push(courante)
      courante = mot
    } else {
      courante = essai
    }
  }
  if (courante) lignes.push(courante)
  return lignes
}
