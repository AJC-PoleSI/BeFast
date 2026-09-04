import { describe, it, expect } from "vitest"
import { isDuplicateRequest, DUPLICATE_WINDOW_MS, DELETION_TICKET_TYPE } from "./request"

const NOW = new Date("2026-09-04T12:00:00.000Z")

describe("isDuplicateRequest", () => {
  it("laisse passer une première demande", () => {
    expect(isDuplicateRequest(null, NOW)).toBe(false)
    expect(isDuplicateRequest(undefined, NOW)).toBe(false)
  })

  it("bloque une demande émise il y a moins de 24 h", () => {
    const recente = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
    expect(isDuplicateRequest(recente, NOW)).toBe(true)
  })

  it("laisse repasser une demande émise il y a plus de 24 h", () => {
    const ancienne = new Date(NOW.getTime() - DUPLICATE_WINDOW_MS - 1000).toISOString()
    expect(isDuplicateRequest(ancienne, NOW)).toBe(false)
  })

  it("ne bloque pas l'utilisateur sur une date illisible", () => {
    expect(isDuplicateRequest("pas-une-date", NOW)).toBe(false)
  })
})

describe("DELETION_TICKET_TYPE", () => {
  it("est la valeur écrite dans support_tickets.type_probleme", () => {
    expect(DELETION_TICKET_TYPE).toBe("suppression_compte")
  })
})
