"use client"

import { useState } from "react"

type State = "idle" | "sending" | "sent" | "error"

/**
 * Demande de suppression de compte — volontairement discrète : un lien en
 * petits caractères, hors des actions principales du profil. Le clic ouvre une
 * modale qui explique que la demande part vers l'administration et qu'elle
 * n'est pas immédiate.
 */
export function DeleteAccountRequest() {
  const [open, setOpen] = useState(false)
  const [motif, setMotif] = useState("")
  const [state, setState] = useState<State>("idle")

  async function submit() {
    setState("sending")
    try {
      const res = await fetch("/api/profil/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      })
      setState(res.ok ? "sent" : "error")
    } catch {
      setState("error")
    }
  }

  function close() {
    setOpen(false)
    // La demande envoyée reste envoyée : on ne réarme pas le formulaire.
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-md p-6">
            {state === "sent" ? (
              <>
                <h2 className="text-lg font-manrope font-bold text-[#00236f]">
                  Demande envoyée
                </h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                  L&apos;administration a été prévenue. Vous serez recontacté avant
                  que le compte ne soit supprimé.
                </p>
                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-manrope font-bold text-[#00236f]">
                  Demander la suppression de mon compte
                </h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                  Votre demande est transmise à l&apos;administration d&apos;Audencia
                  Junior Conseil. La suppression n&apos;est pas immédiate : elle est
                  effectuée manuellement, et elle est définitive.
                </p>

                <label className="block text-xs font-medium text-zinc-500 mt-5 mb-1.5">
                  Motif (facultatif)
                </label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                />

                {state === "error" && (
                  <p className="text-sm text-red-600 mt-3">
                    L&apos;envoi a échoué. Réessayez, ou écrivez directement à
                    l&apos;administration.
                  </p>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={state === "sending"}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {state === "sending" ? "Envoi…" : "Envoyer la demande"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
