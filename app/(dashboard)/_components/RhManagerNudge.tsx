"use client";

// Bandeau candidat BeFast : « Votre espace RH Manager est prêt ».
// À monter dans le dashboard candidat. Le switch passe par /api/sso/switch
// (session BeFast) → login RH sans ressaisie.
export default function RhManagerNudge({
  documentsComplete = false,
}: {
  documentsComplete?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background: "rgba(202,166,75,0.12)",
        border: "1px solid #caa64b",
        borderRadius: 10,
        padding: "12px 16px",
        margin: "12px 0",
      }}
    >
      <span style={{ fontSize: 14 }}>
        {documentsComplete
          ? "✅ Documents transmis. Suivez votre candidature sur RH Manager."
          : "➡️ Votre espace de recrutement RH Manager est prêt."}
      </span>
      <a
        href="/api/sso/switch"
        style={{
          whiteSpace: "nowrap",
          background: "#caa64b",
          color: "#0b1437",
          borderRadius: 8,
          padding: "9px 14px",
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Aller sur RH Manager →
      </a>
    </div>
  );
}
