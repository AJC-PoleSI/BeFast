import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    )
  }
  return Buffer.from(hex, "hex")
}

export interface EncryptedPayload {
  iv: string // hex
  ciphertext: string // hex
  tag: string // hex
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    tag: tag.toString("hex"),
  }
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey()
  const iv = Buffer.from(payload.iv, "hex")
  const ciphertext = Buffer.from(payload.ciphertext, "hex")
  const tag = Buffer.from(payload.tag, "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(tag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return plaintext.toString("utf8")
}

// Serialize to a single string for storage in a single DB column
// Format: hex(iv):hex(tag):hex(ciphertext)
export function encryptToString(plaintext: string): string {
  const { iv, tag, ciphertext } = encrypt(plaintext)
  return `${iv}:${tag}:${ciphertext}`
}

export function decryptFromString(encoded: string): string {
  const [iv, tag, ciphertext] = encoded.split(":")
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted format")
  return decrypt({ iv, tag, ciphertext })
}
