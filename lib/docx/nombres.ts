/**
 * Convertit un nombre entier (0 à 999 999 999) en toutes lettres françaises.
 */
export function numberToFrenchWords(num: number): string {
  const units = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
  ]
  const tensNames = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"]

  function under100(n: number): string {
    if (n < 20) return units[n]
    if (n < 70) {
      const t = Math.floor(n / 10)
      const r = n % 10
      if (r === 0) return tensNames[t]
      if (r === 1) return `${tensNames[t]} et un`
      return `${tensNames[t]}-${units[r]}`
    }
    if (n < 80) {
      const r = n - 60
      if (r === 11) return "soixante et onze"
      return `soixante-${units[r]}`
    }
    const r = n - 80
    if (r === 0) return "quatre-vingts"
    return `quatre-vingt-${units[r]}`
  }

  function under1000(n: number): string {
    if (n < 100) return under100(n)
    const c = Math.floor(n / 100)
    const r = n % 100
    const centPart = c === 1 ? "cent" : `${units[c]} cent${r === 0 ? "s" : ""}`
    if (r === 0) return centPart
    return `${centPart} ${under100(r)}`
  }

  function under1e6(n: number): string {
    if (n < 1000) return under1000(n)
    const m = Math.floor(n / 1000)
    const r = n % 1000
    const millePart = m === 1 ? "mille" : `${under1000(m)} mille`
    if (r === 0) return millePart
    return `${millePart} ${under1000(r)}`
  }

  if (num === 0) return "zéro"
  const sign = num < 0 ? "moins " : ""
  const n = Math.round(Math.abs(num))
  if (n < 1e6) return sign + under1e6(n)
  const mi = Math.floor(n / 1e6)
  const rest = n % 1e6
  const millionPart = mi === 1 ? "un million" : `${under1e6(mi)} millions`
  return sign + (rest === 0 ? millionPart : `${millionPart} ${under1e6(rest)}`)
}
