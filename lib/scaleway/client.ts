import "server-only"

import { S3Client } from "@aws-sdk/client-s3"

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
