"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Synchronise un jeu de filtres avec les query params de l'URL.
 *
 * Permet de partager / recharger une vue filtrée (les filtres survivent au
 * reload et au copier-coller du lien). Utilise `router.replace` pour ne pas
 * polluer l'historique de navigation à chaque frappe.
 *
 * @example
 *   const { filters, setFilter, reset } = useUrlFilters(["type", "search"])
 *   <input value={filters.search ?? ""} onChange={e => setFilter("search", e.target.value)} />
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Recalculé seulement quand l'URL change (et non à chaque rendu).
  const filters = useMemo(() => {
    const out = {} as Partial<Record<K, string>>
    for (const k of keys) {
      const v = searchParams.get(k)
      if (v) out[k] = v
    }
    return out
    // keys est stable côté appelant (littéral) ; on dépend de l'URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setFilter = useCallback(
    (key: K, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  return { filters, setFilter, reset }
}
