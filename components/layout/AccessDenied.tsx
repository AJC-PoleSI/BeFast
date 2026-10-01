/**
 * Écran de refus d'accès — rendu côté serveur par les layouts protégés
 * (voir lib/auth/page-guards.ts). À la différence de <RoleGuard>, le segment
 * enfant n'est jamais rendu : aucune donnée de la page refusée n'est chargée.
 */
export function AccessDenied({
  titre = "Accès non autorisé",
  message = "Vous n'avez pas les permissions pour accéder à cette page.",
}: {
  titre?: string
  message?: string
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md px-6">
        <h2 className="font-heading text-[20px] font-bold mb-2">{titre}</h2>
        <p className="text-muted-foreground">{message}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez un administrateur
          pour qu&apos;il ajuste votre rôle ou vos postes.
        </p>
      </div>
    </div>
  )
}
