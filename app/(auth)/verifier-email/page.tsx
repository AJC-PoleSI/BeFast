import Link from "next/link"
import { MailCheck, AlertTriangle } from "lucide-react"
import { ResendForm } from "./ResendForm"

export default function VerifierEmailPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const status = searchParams?.status

  const banner =
    status === "expired"
      ? "Ce lien de vérification a expiré. Demandez-en un nouveau ci-dessous."
      : status === "invalid"
        ? "Ce lien de vérification est invalide. Demandez-en un nouveau ci-dessous."
        : null

  return (
    <div className="w-full max-w-[400px] bg-[#F5F0E8] border border-[hsl(210,20%,82%)] rounded-lg shadow-md p-12 text-center">
      <MailCheck className="mx-auto mb-6 text-gold" size={48} />

      <h1 className="font-heading text-[22px] font-bold tracking-[-0.01em] mb-4">
        V&eacute;rifiez votre adresse email
      </h1>

      <p className="text-sm text-muted-foreground mb-6">
        Un email de v&eacute;rification vient de vous &ecirc;tre envoy&eacute;. Cliquez sur le
        lien qu&apos;il contient pour activer votre compte. Le lien est valable 24&nbsp;heures.
      </p>

      {banner && (
        <div className="flex items-start gap-2 text-left text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 mb-6">
          <AlertTriangle className="shrink-0 mt-0.5" size={16} />
          <span>{banner}</span>
        </div>
      )}

      <div className="mb-6">
        <ResendForm />
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Pensez &agrave; v&eacute;rifier votre dossier de spams.
      </p>

      <Link href="/login" className="text-blue text-sm hover:underline">
        Retour &agrave; la connexion
      </Link>
    </div>
  )
}
