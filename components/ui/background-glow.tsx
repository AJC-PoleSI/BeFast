import { cn } from "@/lib/utils"

interface GlowBackgroundProps {
  children?: React.ReactNode
  className?: string
  /** Position du centre du halo. */
  position?: "center" | "top"
  /** Opacité du halo or (0–1). */
  intensity?: number
}

/**
 * Fond signature Be Fast : halo radial doré (#C9A84C) sur surface claire.
 * Adapté du glow jaune de référence aux couleurs de la charte.
 * Le contenu passe au-dessus (z-10) ; le halo est purement décoratif.
 */
export function GlowBackground({
  children,
  className,
  position = "center",
  intensity = 0.5,
}: GlowBackgroundProps) {
  const at = position === "top" ? "50% -5%" : "50% 38%"
  return (
    <div className={cn("relative min-h-screen w-full bg-[#fcfbf8]", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at ${at}, hsl(var(--gold) / ${intensity}) 0%, transparent 68%)`,
          mixBlendMode: "multiply",
        }}
      />
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  )
}

/**
 * Variante "calque seul" : à déposer dans un conteneur `relative` existant
 * (ex. zone de contenu d'une page dashboard) pour un halo discret en fond.
 */
export function GlowLayer({
  className,
  position = "top",
  intensity = 0.18,
}: Pick<GlowBackgroundProps, "className" | "position" | "intensity">) {
  const at = position === "top" ? "50% -10%" : "50% 40%"
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      style={{
        backgroundImage: `radial-gradient(circle at ${at}, hsl(var(--gold) / ${intensity}) 0%, transparent 60%)`,
        mixBlendMode: "multiply",
      }}
    />
  )
}
