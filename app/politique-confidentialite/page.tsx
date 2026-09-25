import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Politique de confidentialité — BeFast",
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">{children}</ul>
  )
}

function CnilLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="https://www.cnil.fr/fr/plaintes"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#00236f] hover:underline"
    >
      {children}
    </a>
  )
}

// Page publique (hors layouts auth/dashboard) : lisible sans être connecté.
export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-[#00236f] hover:underline"
        >
          ← Retour à BeFast
        </Link>

        <h1 className="mb-8 text-3xl font-semibold text-zinc-900">
          Politique de confidentialité
        </h1>

        <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-700 sm:p-8">
          <p>
            Cette politique explique comment Audencia Junior Conseil traite les
            données personnelles collectées sur BeFast, son outil de gestion
            interne, que vous soyez membre de l&apos;association ou intervenant
            sur une étude.
          </p>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 sm:p-5">
            <p className="mb-1 font-semibold text-zinc-900">En bref</p>
            <p>
              Les informations recueillies sur BeFast sont traitées par Audencia
              Junior Conseil pour gérer votre adhésion à l&apos;association et,
              si vous intervenez sur une étude, vos missions et leur
              rémunération. Elles sont conservées pendant toute la durée de
              votre adhésion puis 3 ans après votre départ ; les pièces
              comptables et sociales liées à vos missions sont conservées
              pendant les durées imposées par la loi (jusqu&apos;à 10 ans). Elles
              sont destinées aux membres du bureau et des pôles habilités,
              chacun selon son rôle. Vous pouvez y accéder, les corriger ou les
              faire supprimer en écrivant à{" "}
              <strong>contact@ajc-mail.com</strong>. Vous pouvez aussi saisir la{" "}
              <CnilLink>CNIL</CnilLink>.
            </p>
          </div>

          <Section title="1. Responsable du traitement">
            <p>
              Audencia Junior Conseil, association loi 1901, SIRET 331 647 750
              00016, dont le siège est situé 8 route de la Jonelière, BP 31222,
              44312 Nantes Cedex 3. Contact : contact@ajc-mail.com.
            </p>
          </Section>

          <Section title="2. Données collectées">
            <p className="font-medium text-zinc-900">Membres</p>
            <List>
              <li>
                Identité et contact : nom, prénom, adresse email, téléphone
                portable, adresse postale, date de naissance, photo de profil
                (facultative)
              </li>
              <li>Scolarité : établissement, programme, promotion</li>
              <li>
                Vie de l&apos;association : pôle, poste, statut du compte,
                bulletin d&apos;adhésion signé, preuve de paiement de la
                cotisation
              </li>
              <li>
                Pièces justificatives : carte d&apos;identité, carte étudiante,
                carte Vitale, RIB
              </li>
              <li>
                Mot de passe, stocké uniquement sous forme chiffrée irréversible
                (hachage)
              </li>
            </List>

            <p className="mt-4 font-medium text-zinc-900">Intervenants</p>
            <List>
              <li>
                Numéro de sécurité sociale et IBAN, nécessaires à votre
                rémunération et aux déclarations sociales
              </li>
              <li>
                Candidatures aux missions, missions réalisées, nombre de jours
                d&apos;étude, rétributions et notes de frais
              </li>
              <li>
                Documents générés et signés : récapitulatifs de mission,
                conventions, bulletins de versement, signatures électroniques
              </li>
            </List>

            <p className="mt-4 font-medium text-zinc-900">
              Interlocuteurs des entreprises clientes et prospectées
            </p>
            <List>
              <li>Nom, adresse email et téléphone professionnels</li>
            </List>

            <p className="mt-4 font-medium text-zinc-900">
              Données techniques (tous les utilisateurs)
            </p>
            <List>
              <li>
                Journal des actions sensibles réalisées dans l&apos;outil
                (validation ou suppression d&apos;un compte, par exemple)
              </li>
              <li>Journaux techniques de l&apos;hébergeur</li>
              <li>
                Statistiques de fréquentation et de performance anonymes, sans
                cookie (Vercel Web Analytics et Speed Insights)
              </li>
            </List>

            <p className="mt-3">
              Si vous avez candidaté via RH Manager, la plateforme de
              recrutement de l&apos;association, votre compte a été créé à
              partir des nom, prénom, email et date de naissance saisis lors de
              votre candidature.
            </p>
          </Section>

          <Section title="3. Finalités et bases légales">
            <List>
              <li>
                <strong>Gérer votre adhésion</strong> : compte, annuaire interne,
                pôles et postes, bulletin d&apos;adhésion, cotisation. Base
                légale : exécution de votre adhésion à l&apos;association (art.
                6.1.b RGPD).
              </li>
              <li>
                <strong>Organiser les études et les missions</strong> :
                candidatures, affectation des intervenants, documents de mission,
                signature électronique. Même base légale.
              </li>
              <li>
                <strong>Rémunérer les intervenants</strong> et remplir les
                obligations comptables, sociales et fiscales de
                l&apos;association : bulletins de versement, déclarations
                sociales, conservation des pièces comptables. Base légale :
                obligation légale (art. 6.1.c RGPD).
              </li>
              <li>
                <strong>Afficher votre photo de profil</strong> : sur la base de
                votre consentement (art. 6.1.a RGPD), que vous pouvez retirer à
                tout moment en supprimant la photo.
              </li>
              <li>
                <strong>Suivre la relation avec les clients et prospects</strong>{" "}
                : intérêt légitime de l&apos;association (art. 6.1.f RGPD).
              </li>
              <li>
                <strong>Sécuriser l&apos;outil</strong>, tracer les actions
                sensibles et produire des statistiques globales : intérêt
                légitime de l&apos;association (art. 6.1.f RGPD).
              </li>
            </List>
          </Section>

          <Section title="4. Destinataires">
            <List>
              <li>
                <strong>Membres du bureau et des pôles habilités</strong>, chacun
                selon les droits attachés à son rôle (par exemple, la trésorerie
                pour les données de rémunération). Les pièces justificatives et
                les données sensibles ne sont accessibles qu&apos;aux
                administrateurs habilités.
              </li>
              <li>
                <strong>Organismes sociaux et fiscaux</strong> (Urssaf,
                administration fiscale), lorsque la loi impose de leur déclarer
                la rémunération des intervenants.
              </li>
              <li>
                <strong>Prestataires techniques</strong>, qui agissent sur
                instruction de l&apos;association : Supabase (base de données et
                authentification, hébergée en Irlande, Union européenne),
                Scaleway (stockage des documents, Paris, France), Vercel Inc.
                (hébergement de l&apos;application et statistiques de
                fréquentation, États-Unis), Resend (envoi des emails,
                États-Unis), Brevo (envoi des emails, France) et LiveConsent
                (signature électronique, France).
              </li>
            </List>
            <p className="mt-3">
              Vos données ne sont ni vendues ni transmises à des tiers à des
              fins commerciales.
            </p>
          </Section>

          <Section title="5. Transferts hors de l'Union européenne">
            <p>
              Certains prestataires sont établis aux États-Unis. Ces transferts
              sont encadrés par des garanties appropriées : certification de
              Vercel au Data Privacy Framework UE–États-Unis, et clauses
              contractuelles types de la Commission européenne pour les autres
              prestataires.
            </p>
          </Section>

          <Section title="6. Durée de conservation">
            <List>
              <li>
                Données de membre et pièces justificatives : pendant toute la
                durée de votre adhésion, puis 3 ans après votre départ.
              </li>
              <li>
                Pièces comptables et sociales liées aux missions (conventions,
                bulletins de versement, notes de frais, factures) : pendant les
                durées imposées par la loi, jusqu&apos;à 10 ans. Lorsqu&apos;un
                compte est supprimé, l&apos;identité est anonymisée mais cet
                historique est conservé pour cette raison.
              </li>
              <li>
                Interlocuteurs des clients et prospects : 3 ans après le dernier
                échange.
              </li>
              <li>Données techniques de sécurité : 12 mois au plus.</li>
            </List>
          </Section>

          <Section title="7. Sécurité">
            <p>
              L&apos;association met en œuvre des mesures techniques et
              organisationnelles adaptées : échanges chiffrés (HTTPS), données
              sensibles (numéro de sécurité sociale, IBAN, adresse, date de
              naissance) chiffrées en base (AES-256), documents stockés dans un
              espace privé et accessibles uniquement par des liens temporaires,
              mots de passe hachés, accès aux données limité selon le rôle et
              contrôlé côté serveur, journalisation des actions sensibles.
            </p>
          </Section>

          <Section title="8. Vos droits">
            <p>
              Conformément au RGPD et à la loi Informatique et Libertés, vous
              disposez des droits suivants sur vos données :
            </p>
            <List>
              <li>accès et copie</li>
              <li>rectification</li>
              <li>effacement</li>
              <li>limitation du traitement</li>
              <li>opposition au traitement fondé sur l&apos;intérêt légitime</li>
              <li>portabilité</li>
              <li>retrait de votre consentement à tout moment</li>
              <li>
                définition de directives sur le sort de vos données après votre
                décès
              </li>
            </List>
            <p className="mt-3">
              Pour les exercer, écrivez à <strong>contact@ajc-mail.com</strong>.
              Vous pouvez aussi utiliser le lien « Demander la suppression de mon
              compte » en bas de votre profil. Nous répondons dans un délai
              d&apos;un mois. L&apos;effacement ne s&apos;applique pas aux pièces
              que la loi nous oblige à conserver (voir la section 6).
            </p>
            <p className="mt-2">
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez
              adresser une réclamation à la CNIL :{" "}
              <CnilLink>www.cnil.fr</CnilLink>.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              BeFast ne dépose aucun cookie publicitaire ni de suivi. Les seuls
              cookies utilisés conservent votre session de connexion : ils sont
              strictement nécessaires au service et ne requièrent donc pas de
              consentement. Les statistiques de fréquentation sont anonymes et
              fonctionnent sans cookie.
            </p>
          </Section>

          <Section title="10. Modification de cette politique">
            <p>
              Cette politique peut être mise à jour, par exemple lorsque
              l&apos;outil évolue. La date de dernière mise à jour figure
              ci-dessous.
            </p>
          </Section>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          Dernière mise à jour : 25 septembre 2026
        </p>
      </div>
    </div>
  )
}
