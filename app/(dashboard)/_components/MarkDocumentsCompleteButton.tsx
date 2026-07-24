"use client";

import { useState } from "react";

// Bouton candidat BeFast : « J'ai déposé tous mes documents ».
// Déclenche le push CURÉ des documents vers RH Manager (sens unique).
// À monter en bas de la page de dépôt de documents du portail candidat.
export default function MarkDocumentsCompleteButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [msg, setMsg] = useState("");

  async function submit() {
    setState("loading");
    try {
      const res = await fetch("/api/integration/documents-complete", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error ?? "Échec de l'envoi.");
        setState("error");
      } else {
        setState("done");
      }
    } catch {
      setMsg("Service indisponible.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p style={{ color: "#16a34a", fontWeight: 600 }}>
        ✅ Documents transmis à RH Manager.
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={submit}
        disabled={state === "loading"}
        style={{
          background: "#caa64b",
          color: "#0b1437",
          border: "none",
          borderRadius: 8,
          padding: "11px 18px",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          opacity: state === "loading" ? 0.7 : 1,
        }}
      >
        {state === "loading" ? "Envoi…" : "J'ai déposé tous mes documents"}
      </button>
      {state === "error" && (
        <p style={{ color: "#b91c1c", fontSize: 13 }}>{msg}</p>
      )}
    </div>
  );
}
