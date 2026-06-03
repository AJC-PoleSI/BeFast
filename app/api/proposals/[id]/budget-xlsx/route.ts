export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getProposalBudget } from "@/lib/actions/propositions"
import { computeBudget } from "@/lib/budget/compute"
import { buildBudgetWorkbook } from "@/lib/budget/xlsx"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await getProposalBudget(params.id)
  if ("error" in res || !res.data) {
    const msg = "error" in res ? res.error : "Introuvable"
    return NextResponse.json({ error: msg }, { status: msg === "Non autorisé" ? 403 : 404 })
  }

  const detail = res.data
  const breakdown = computeBudget(detail.budget)
  const buf = await buildBudgetWorkbook(breakdown, {
    id: detail.id,
    client_company: detail.client_company,
    study_type: detail.study_type,
    cdp_name: detail.cdp_name,
  })

  const safeName = `budget-${(detail.client_company || detail.id || "propale")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 60)}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  })
}
