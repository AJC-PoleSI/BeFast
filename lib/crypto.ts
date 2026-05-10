import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

export interface EncryptedData {
  encrypted: string
  iv: string
  authTag: string
}

export function deriveKey(masterKey: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(masterKey, Buffer.from(salt, 'hex'), 100000, 32, 'sha256')
}

export function encryptData(plaintext: string, masterKey: string, salt: string): EncryptedData {
  const key = deriveKey(masterKey, salt)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }
}

export function decryptData(
  encrypted: string,
  iv: string,
  authTag: string,
  masterKey: string,
  salt: string
): string {
  const key = deriveKey(masterKey, salt)
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  )

  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function generateEncryptionSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString('hex')
}
