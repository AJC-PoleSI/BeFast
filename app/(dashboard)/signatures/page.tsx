import {
  getSignatureConfig,
  getSignaturesAccess,
  listSignatureRequests,
} from "@/lib/actions/signature"
import { SignaturesTabs } from "./SignaturesTabs"

export const metadata = {
  title: "Signatures électroniques",
}

export default async function SignaturesPage() {
  const [config, res, access] = await Promise.all([
    getSignatureConfig(),
    listSignatureRequests(),
    getSignaturesAccess(),
  ])
  const requests = "data" in res ? res.data : []
  const loadError = "error" in res ? res.error : null

  return (
    <SignaturesTabs
      configured={config.configured}
      initialRequests={requests}
      loadError={loadError}
      isAdmin={access.isAdmin}
      isBureau={access.isBureau}
    />
  )
}
