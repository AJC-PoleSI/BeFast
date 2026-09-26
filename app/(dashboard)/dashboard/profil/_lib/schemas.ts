import { z } from "zod"

export const ETABLISSEMENTS = [
  "Audencia Nantes",
  "Audencia Bachelor",
  "Audencia Paris",
] as const

export const SCOLARITES = [
  "Pré-Master",
  "Master 1",
  "Master 2",
] as const

export const profileSchema = z.object({
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  portable: z.string().optional().or(z.literal("")),
  promo: z.string().optional().or(z.literal("")),
  adresse: z.string().optional().or(z.literal("")),
  ville: z.string().optional().or(z.literal("")),
  code_postal: z.string().optional().or(z.literal("")),
  pole: z.string().optional().or(z.literal("")),
  etablissement: z.enum([...ETABLISSEMENTS, ""]).optional(),
  scolarite: z.enum([...SCOLARITES, ""]).optional(),
  date_naissance: z.string().optional().or(z.literal("")),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

export const sensitiveFieldSchema = z
  .object({
    field: z.enum(["nss", "iban"]),
    value: z.string().min(1, "Ce champ est requis"),
    confirmation: z.string().min(1, "La confirmation est requise"),
  })
  .refine((d) => d.value === d.confirmation, {
    message: "Les valeurs ne correspondent pas.",
    path: ["confirmation"],
  })

export const nssSchema = z
  .string()
  .regex(
    /^\s*[12]\s*\d{2}\s*(0[1-9]|1[0-2])\s*\d{2}\s*\d{3}\s*\d{3}\s*\d{2}\s*$/,
    "Le numéro de sécurité sociale n'est pas valide."
  )

export const ibanSchema = z
  .string()
  .regex(
    /^FR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}$/,
    "L'IBAN n'est pas valide."
  )

export const VALID_DOC_TYPES = [
  "carte_identite_recto",
  "carte_identite_verso",
  "carte_etudiante",
  "carte_vitale",
  "preuve_lydia",
  "rib",
  "bulletin_adhesion",
] as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

export const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]

export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"]

/**
 * Taille maximale réellement acceptée par une route Next.js déployée sur
 * Vercel : au-delà de ~4,5 Mo de corps de requête, la plateforme répond 413
 * `FUNCTION_PAYLOAD_TOO_LARGE` avant même que la fonction ne s'exécute. Les
 * fichiers plus gros passent par une URL présignée (upload direct vers
 * Scaleway), qui ne traverse pas la fonction.
 */
export const MAX_PROXY_UPLOAD_SIZE = 4 * 1024 * 1024 // 4 Mo

/**
 * Valide le type d'un fichier uploadé. Les photos prises depuis un iPhone
 * sont en HEIC et leur `file.type` est souvent vide ou non standard selon le
 * navigateur/OS (Chrome/Firefox/Android en particulier) : on retombe alors
 * sur l'extension du nom de fichier plutôt que de rejeter à tort.
 */
export function isAcceptedFileType(file: { type: string; name: string }): boolean {
  if (ACCEPTED_FILE_TYPES.includes(file.type)) return true
  const ext = file.name.split(".").pop()?.toLowerCase()
  return !!ext && ACCEPTED_EXTENSIONS.includes(ext)
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
}

/**
 * Type MIME à stocker : celui du fichier, ou déduit de l'extension quand le
 * navigateur n'en donne pas (`""`) ou donne le type générique
 * `application/octet-stream` — cas courant des .heic/.heif, et de tout envoi
 * multipart dont la part n'a pas de Content-Type.
 */
export function resolveMimeType(file: { type: string; name: string }): string {
  const ext = file.name.split(".").pop()?.toLowerCase()
  const fromExt = ext ? EXT_TO_MIME[ext] : undefined
  if (!file.type || file.type === "application/octet-stream") {
    return fromExt || "application/octet-stream"
  }
  return file.type
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
}

/**
 * Extension utilisée dans la clé Scaleway. Déterministe : la route qui signe
 * l'URL d'upload et celle qui enregistre la ligne en base doivent calculer
 * exactement la même clé à partir du seul nom de fichier.
 *
 * On ne reprend jamais l'extension brute (un fichier « scan » sans extension
 * donnait la clé `document.scan`, un « carte.PDF » la clé `document.PDF`) :
 * elle est normalisée, et remplacée par celle du type MIME si elle ne fait
 * pas partie des formats acceptés.
 */
export function fileExtension(file: { type: string; name: string }): string {
  const raw = file.name.includes(".") ? file.name.split(".").pop()! : ""
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (ACCEPTED_EXTENSIONS.includes(clean)) return clean
  return MIME_TO_EXT[resolveMimeType(file)] || "bin"
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  carte_identite_recto: "Carte d'identité (recto)",
  carte_identite_verso: "Carte d'identité (verso)",
  carte_etudiante: "Carte étudiante",
  carte_vitale: "Carte vitale",
  preuve_lydia: "Preuve Lydia",
  rib: "RIB",
  bulletin_adhesion: "Bulletin d'adhésion signé",
}

export const DOC_TYPE_ICONS: Record<string, string> = {
  carte_identite_recto: "IdCard",
  carte_identite_verso: "IdCard",
  carte_etudiante: "GraduationCap",
  carte_vitale: "HeartPulse",
  preuve_lydia: "Wallet",
  rib: "Landmark",
  bulletin_adhesion: "FileSignature",
}

// Custom fields schemas
export const customFieldSchema = z.object({
  name: z.string().min(1, "Le nom du champ est requis").max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, "Le slug doit contenir uniquement des minuscules, chiffres et underscores"),
  type: z.enum(["text", "select", "date", "number"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // For select type
  description: z.string().optional().or(z.literal("")),
  ordre: z.number().int().default(0),
})

export type CustomFieldFormValues = z.infer<typeof customFieldSchema>

export const customFieldValueSchema = z.object({
  fieldId: z.string().uuid("ID du champ invalide"),
  value: z.string().optional().or(z.literal("")),
})
