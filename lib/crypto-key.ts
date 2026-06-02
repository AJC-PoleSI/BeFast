import "server-only"

/**
 * Master key used to derive the per-record AES keys for legacy PII columns
 * (nss / iban / adresse / date_naissance / ville / code_postal).
 *
 * Fails closed: if ENCRYPTION_MASTER_KEY is missing (or obviously too weak) we
 * throw instead of silently falling back to a public, hard-coded "default-key".
 * A public default key would make every encrypted PII value trivially
 * decryptable by anyone with read access to the database.
 */
export function getMasterKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY
  if (!key || key.length < 16) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY is not configured (min 16 chars). Refusing to process sensitive data."
    )
  }
  return key
}
