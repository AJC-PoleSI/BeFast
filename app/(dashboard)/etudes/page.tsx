import { getEtudes, getClients, getMembers, getParametre } from "@/lib/actions/etudes"
import { EtudesClient } from "./_components/EtudesClient"
import type { EtudeWithRelations, Client } from "@/types/database.types"

// Server component — fetches all data before sending HTML.
// No more empty page → spinner → data waterfall.
export default async function EtudesPage() {
  const [etudesRes, clientsRes, membresRes, tvaValue] = await Promise.all([
    getEtudes(),
    getClients(),
    getMembers(),
    getParametre("tva_rate"),
  ])

  return (
    <EtudesClient
      initialEtudes={((etudesRes as any).data ?? []) as EtudeWithRelations[]}
      initialClients={((clientsRes as any).data ?? []) as Client[]}
      initialMembres={(membresRes as any).data ?? []}
      initialTva={Number(tvaValue) || 20}
    />
  )
}
