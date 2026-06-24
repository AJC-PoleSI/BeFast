import { describe, it, expect } from "vitest"
import { escapeXml } from "./xml"

describe("escapeXml", () => {
  it("escapes the five XML metacharacters", () => {
    expect(escapeXml("<>&'\"")).toBe("&lt;&gt;&amp;&apos;&quot;")
  })

  it("neutralises a tag-injection attempt", () => {
    // Une valeur utilisateur malveillante ne doit pas pouvoir fermer/ouvrir une balise.
    expect(escapeXml("</a:t></a:r><a:r><a:t>injected")).toBe(
      "&lt;/a:t&gt;&lt;/a:r&gt;&lt;a:r&gt;&lt;a:t&gt;injected"
    )
  })

  it("returns empty string for null and undefined", () => {
    expect(escapeXml(null)).toBe("")
    expect(escapeXml(undefined)).toBe("")
  })

  it("coerces non-string values", () => {
    expect(escapeXml(42)).toBe("42")
    expect(escapeXml(0)).toBe("0")
    expect(escapeXml(false)).toBe("false")
  })

  it("leaves safe text untouched", () => {
    expect(escapeXml("Phase 1 : cadrage")).toBe("Phase 1 : cadrage")
    expect(escapeXml("Société Dupont")).toBe("Société Dupont")
  })

  it("escapes every occurrence, not just the first", () => {
    expect(escapeXml("a & b & c")).toBe("a &amp; b &amp; c")
  })
})
