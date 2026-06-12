import { getProposals } from "@/lib/actions/propositions"
import { PipelineClient, type PipelineProposal } from "./PipelineClient"

export const metadata = {
  title: "Pipeline de prospection",
}

export default async function PipelinePage() {
  const res = await getProposals()
  const proposals: PipelineProposal[] = (res.data ?? []).map((p: any) => ({
    id: p.id,
    client_company: p.client_company ?? "Client inconnu",
    study_type: p.study_type ?? null,
    status: p.status ?? "brouillon",
    budget_status: p.budget_status ?? null,
    total_ht: p.total_ht ?? 0,
    created_at: p.created_at,
  }))

  return <PipelineClient initialProposals={proposals} />
}
