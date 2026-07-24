import "server-only"
import { postSigned, RH_BASE_URL } from "./token"

// Appels signés Befast → RH Manager (Befast est le maître).

export async function provisionRhCandidate(input: {
  email: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  befastPersonId: string
  source: string
}): Promise<{ ok: boolean; candidateId?: string; error?: string }> {
  try {
    const res = await postSigned(`${RH_BASE_URL}/api/internal/provision`, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth ?? null,
      befastPersonId: input.befastPersonId,
      source: input.source,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error ?? `HTTP ${res.status}` }
    return { ok: true, candidateId: json?.candidateId }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export interface CuratedDocument {
  type: string
  filename: string
  signedUrl: string
  expiresAt?: string | null
}

export async function pushDocumentsToRh(input: {
  email: string
  documents: CuratedDocument[]
  complete: boolean
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await postSigned(`${RH_BASE_URL}/api/internal/documents`, {
      email: input.email,
      documents: input.documents,
      complete: input.complete,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error ?? `HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
