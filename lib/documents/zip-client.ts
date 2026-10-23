/**
 * Archive .zip de plusieurs documents générés, assemblée dans le navigateur :
 * chaque fichier est téléchargé via la route habituelle (mêmes contrôles
 * d'accès) puis empaqueté sans compression (un .docx est déjà un zip). Évite
 * 26 téléchargements un par un, et les limites de taille d'une réponse serveur.
 */
import { documentDownloadName } from "@/lib/documents/download-name"

export type DocumentAZipper = {
  id: string
  file_name: string
  intervenant?: { prenom?: string | null; nom?: string | null } | null
}

export async function telechargerZip(
  docs: DocumentAZipper[],
  nomArchive: string,
  onProgress?: (fait: number, total: number) => void
): Promise<void> {
  const PizZip = (await import("pizzip")).default
  const zip = new PizZip()
  const utilises = new Set<string>()
  let fait = 0

  let curseur = 0
  const travailleur = async () => {
    while (curseur < docs.length) {
      const d = docs[curseur++]
      const res = await fetch(`/api/documents/${d.id}/download`)
      if (!res.ok) throw new Error(`Téléchargement impossible (${d.file_name})`)
      const buf = await res.arrayBuffer()
      let nom = documentDownloadName(d.file_name, d.intervenant)
      while (utilises.has(nom)) nom = nom.replace(/(\.[a-z]+)$/i, " (2)$1")
      utilises.add(nom)
      zip.file(nom, buf)
      onProgress?.(++fait, docs.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, docs.length) }, travailleur))

  const blob = zip.generate({ type: "blob", compression: "STORE" }) as Blob
  declencherTelechargement(URL.createObjectURL(blob), `${nomArchive}.zip`, true)
}

/** Déclenche un téléchargement sans quitter la page ni dépendre d'un popup autorisé. */
export function declencherTelechargement(url: string, nom?: string, revoquer = false): void {
  const a = document.createElement("a")
  a.href = url
  if (nom) a.download = nom
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (revoquer) setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
