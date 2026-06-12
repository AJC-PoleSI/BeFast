import { getSignatureConfig, listSignatureRequests } from "@/lib/actions/signature"
import { SignaturesClient } from "./SignaturesClient"

export const metadata = {
  title: "Signatures électroniques",
}

export default async function SignaturesPage() {
  const [config, res] = await Promise.all([getSignatureConfig(), listSignatureRequests()])
  const requests = "data" in res ? res.data : []
  const loadError = "error" in res ? res.error : null

  return (
    <SignaturesClient
      configured={config.configured}
      initialRequests={requests}
      loadError={loadError}
    />
  )
}
