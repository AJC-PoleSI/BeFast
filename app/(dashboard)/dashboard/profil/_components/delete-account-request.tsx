"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

/** Adresse affichée en secours si l'envoi échoue. */
const ADMIN_EMAIL = "systeme.info@ajc-mail.com"
const MOTIF_MAX = 1000

/**
 * Au-delà, on abandonne l'attente. La modale se verrouille pendant l'envoi ;
 * sans cette borne, une requête qui ne revient jamais y enfermerait
 * l'utilisateur pour la durée de vie de l'onglet.
 */
const TIMEOUT_MS = 15_000

type State = "idle" | "sending" | "sent" | "error"

/**
 * Demande de suppression de compte — volontairement discrète : un lien en
 * petits caractères, hors des actions principales du profil.
 *
 * La modale ne promet que ce que le système fait réellement : la demande part
 * vers l'administration, qui la traite à la main. Rien n'est supprimé ici.
 */
export function DeleteAccountRequest() {
  const [open, setOpen] = useState(false)
  const [motif, setMotif] = useState("")
  const [state, setState] = useState<State>("idle")

  async function submit() {
    setState("sending")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch("/api/profil/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
        signal: controller.signal,
      })
      setState(res.ok ? "sent" : "error")
    } catch {
      // Inclut l'abandon sur délai. La demande a pu aboutir côté serveur malgré
      // tout ; un nouvel envoi retombera sur la fenêtre anti-doublon de 24 h et
      // ne créera pas de doublon.
      setState("error")
    } finally {
      clearTimeout(timeout)
    }
  }

  function close() {
    // Pendant l'envoi, aucune sortie — ni bouton, ni Échap, ni clic extérieur.
    // La requête est déjà partie : laisser fermer ferait croire à une annulation
    // alors que la demande aboutirait quand même.
    if (state === "sending") return
    setOpen(false)
    // Une demande partie ne se rétracte pas : on ne réarme que si elle a échoué.
    if (state === "error") setState("idle")
  }

  return (
    <>
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={state === "sent"}
          className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 transition-colors disabled:no-underline disabled:hover:text-zinc-400"
        >
          {state === "sent"
            ? "Demande de suppression envoyée"
            : "Demander la suppression de mon compte"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={close} />

          {state === "sent" ? (
            <>
              <DialogHeader>
                <DialogTitle>Demande envoyée</DialogTitle>
                <DialogDescription>
                  L&apos;administration a été prévenue et traitera votre demande
                  manuellement.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={close}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Demander la suppression de mon compte</DialogTitle>
                <DialogDescription>
                  Votre demande est transmise à l&apos;administration d&apos;Audencia
                  Junior Conseil. La suppression n&apos;est pas immédiate : elle est
                  effectuée manuellement, et elle est définitive.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="delete-account-motif">Motif (facultatif)</Label>
                <Textarea
                  id="delete-account-motif"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  maxLength={MOTIF_MAX}
                />
              </div>

              {state === "error" && (
                <p className="text-sm text-red-600 mt-3">
                  L&apos;envoi a échoué. Réessayez, ou écrivez directement à{" "}
                  {ADMIN_EMAIL}.
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  disabled={state === "sending"}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={submit}
                  disabled={state === "sending"}
                >
                  {state === "sending" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    "Envoyer la demande"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
