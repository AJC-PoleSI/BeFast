import "server-only"

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const region = process.env.NEXT_PUBLIC_SCALEWAY_REGION ?? "fr-par"

export const scalewayS3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.SCALEWAY_ACCESS_KEY!,
    secretAccessKey: process.env.SCALEWAY_SECRET_KEY!,
  },
  endpoint: `https://s3.${region}.scw.cloud`,
})

export const SCALEWAY_BUCKET = process.env.SCALEWAY_BUCKET_NAME!

/**
 * Normalise une valeur stockée en clé d'objet S3. Accepte soit une clé
 * (nouveau format privé), soit une ancienne URL publique complète
 * (`https://<bucket>.s3.<region>.scw.cloud/<key>`) — rétro-compatibilité.
 */
export function objectKeyFromValue(value: string): string {
  if (!value) return value
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      // Le chemin de l'URL (sans le "/" initial) est la clé de l'objet.
      return decodeURIComponent(new URL(value).pathname.replace(/^\/+/, ""))
    } catch {
      return value
    }
  }
  return value
}

/**
 * Génère une URL de téléchargement présignée à courte durée pour un objet privé.
 * `expiresIn` en secondes (défaut 5 min). N'expose jamais d'objet en public-read.
 */
export async function getSignedDownloadUrl(value: string, expiresIn = 300): Promise<string> {
  const key = objectKeyFromValue(value)
  return getSignedUrl(
    scalewayS3,
    new GetObjectCommand({ Bucket: SCALEWAY_BUCKET, Key: key }),
    { expiresIn }
  )
}
