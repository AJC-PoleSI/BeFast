import { describe, it, expect } from "vitest"
import {
  isAcceptedFileType,
  resolveMimeType,
  fileExtension,
  VALID_DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_TYPE_ICONS,
} from "./schemas"
// Chemin relatif : vitest n'a pas l'alias `@/` à l'exécution.
import { BA_REQUIRED_DOC_TYPES } from "../../../../../lib/signature/ba-utils"

describe("type bulletin_adhesion", () => {
  it("est un type de document déposable", () => {
    expect(VALID_DOC_TYPES).toContain("bulletin_adhesion")
  })

  it("a un libellé et une icône", () => {
    expect(DOC_TYPE_LABELS.bulletin_adhesion).toBe("Bulletin d'adhésion signé")
    expect(DOC_TYPE_ICONS.bulletin_adhesion).toBe("FileSignature")
  })

  it("chaque type déposable a un libellé", () => {
    for (const t of VALID_DOC_TYPES) expect(DOC_TYPE_LABELS[t]).toBeTruthy()
  })

  // Le BA part APRÈS validation des pièces : l'exiger pour le générer
  // bloquerait définitivement l'envoi.
  it("n'est pas une pièce requise pour générer le BA", () => {
    expect(BA_REQUIRED_DOC_TYPES as readonly string[]).not.toContain("bulletin_adhesion")
  })
})

describe("isAcceptedFileType", () => {
  it.each([
    ["application/pdf", "ba.pdf"],
    ["image/jpeg", "photo.jpg"],
    ["image/png", "scan.png"],
    ["image/webp", "scan.webp"],
    ["image/heic", "IMG_0001.heic"],
    ["image/heif", "IMG_0001.heif"],
  ])("accepte %s (%s)", (type, name) => {
    expect(isAcceptedFileType({ type, name })).toBe(true)
  })

  it.each(["ba.pdf", "BA.PDF", "photo.JPG", "scan.jpeg", "IMG_0001.HEIC"])(
    "accepte %s quand le navigateur ne donne aucun type",
    (name) => {
      expect(isAcceptedFileType({ type: "", name })).toBe(true)
    }
  )

  it("accepte un HEIC annoncé application/octet-stream", () => {
    expect(
      isAcceptedFileType({ type: "application/octet-stream", name: "IMG_0001.heic" })
    ).toBe(true)
  })

  it.each([
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "ba.docx"],
    ["text/plain", "notes.txt"],
    ["application/x-msdownload", "setup.exe"],
    ["application/zip", "docs.zip"],
    ["image/gif", "anim.gif"],
    ["", "scan"],
    ["application/octet-stream", "scan"],
  ])("refuse %s (%s)", (type, name) => {
    expect(isAcceptedFileType({ type, name })).toBe(false)
  })
})

describe("resolveMimeType", () => {
  it("garde le type donné par le navigateur", () => {
    expect(resolveMimeType({ type: "image/png", name: "scan.png" })).toBe("image/png")
  })

  it("déduit le type de l'extension quand il manque", () => {
    expect(resolveMimeType({ type: "", name: "ba.pdf" })).toBe("application/pdf")
  })

  it("remplace application/octet-stream par le type de l'extension", () => {
    expect(
      resolveMimeType({ type: "application/octet-stream", name: "IMG_0001.HEIC" })
    ).toBe("image/heic")
  })

  it("reste générique sans extension reconnue", () => {
    expect(resolveMimeType({ type: "", name: "scan" })).toBe("application/octet-stream")
  })
})

describe("fileExtension", () => {
  it("normalise une extension en majuscules", () => {
    expect(fileExtension({ type: "application/pdf", name: "BA.PDF" })).toBe("pdf")
  })

  it("garde une extension acceptée", () => {
    expect(fileExtension({ type: "image/jpeg", name: "photo.jpeg" })).toBe("jpeg")
  })

  it("prend l'extension du type MIME quand le nom n'en a pas", () => {
    expect(fileExtension({ type: "application/pdf", name: "scan" })).toBe("pdf")
  })

  it("prend l'extension du type MIME quand celle du nom est inconnue", () => {
    expect(fileExtension({ type: "image/jpeg", name: "photo.scan" })).toBe("jpg")
  })

  it("retombe sur bin quand rien n'est reconnu", () => {
    expect(fileExtension({ type: "", name: "inconnu" })).toBe("bin")
  })
})
