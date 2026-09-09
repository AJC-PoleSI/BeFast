import { FileSignature } from "lucide-react"
import { getMyPendingSignature } from "@/lib/actions/signature"

/**
 * Bannière membre : affichée sur le dashboard quand l'utilisateur connecté a un
 * document (bulletin d'adhésion) en attente de sa signature. Rend `null` sinon.
 */
export async function MemberSignatureBanner() {
  const res = await getMyPendingSignature()
  if (!res.pending) return null

  const expiry =
    res.daysLeft != null && res.daysLeft > 0
      ? ` Il vous reste ${res.daysLeft} jour${res.daysLeft > 1 ? "s" : ""} pour signer.`
      : ""

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#C9A84C]/40 bg-[#fbf6e9] p-4 shadow-sm">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A84C]/20">
        <FileSignature className="h-5 w-5 text-[#9a7d2e]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#7a6320]">
          {res.requestName ?? "Un document attend votre signature"}
        </p>
        <p className="mt-0.5 text-sm text-[#8a7330]">
          Un email LiveConsent contenant le lien de signature sécurisé vous a été envoyé
          (vérifiez vos spams).{expiry}
        </p>
      </div>
    </div>
  )
}
