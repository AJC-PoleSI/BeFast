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
    /^[12]\d{2}(0[1-9]|1[0-2])\d{5}\d{2}$/,
    "Le numéro de sécurité sociale n'est pas valide."
  )

export const ibanSchema = z
  .string()
  .regex(
    /^FR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}$/,
    "L'IBAN n'est pas valide."
  )

export const VALID_DOC_TYPES = [
  "carte_identite",
  "carte_etudiante",
  "carte_vitale",
  "preuve_lydia",
  "rib",
] as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

export const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]

export const DOC_TYPE_LABELS: Record<string, string> = {
  carte_identite: "Carte d'identité",
  carte_etudiante: "Carte étudiante",
  carte_vitale: "Carte vitale",
  preuve_lydia: "Preuve Lydia",
  rib: "RIB",
}

export const DOC_TYPE_ICONS: Record<string, string> = {
  carte_identite: "IdCard",
  carte_etudiante: "GraduationCap",
  carte_vitale: "HeartPulse",
  preuve_lydia: "Wallet",
  rib: "Landmark",
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
