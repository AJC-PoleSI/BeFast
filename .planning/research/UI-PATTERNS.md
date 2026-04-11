# UI Patterns — BeFast (Odensia Junior Conseil)

**Stack:** Next.js 14 App Router + shadcn/ui + Tailwind CSS + @dnd-kit  
**Researched:** 2026-04-08  
**Confidence:** HIGH for shadcn/ui theming and @dnd-kit patterns; MEDIUM for Gantt resize specifics (verify against @dnd-kit/sortable changelog).

---

## 1. shadcn/ui Theming — Custom Palette with CSS Variables

### How shadcn/ui Theming Works

shadcn/ui maps every semantic color to a CSS custom property in the `:root` / `.dark` scope. All components reference `hsl(var(--primary))`, `hsl(var(--background))`, etc. — never raw hex values. To override the palette you redefine these variables in `globals.css` before Tailwind's base layer.

The variables use **bare HSL channels** (no `hsl()` wrapper) so Tailwind can compose them with opacity modifiers like `bg-primary/50`.

### globals.css — Full Override for BeFast Palette

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ── Backgrounds ──────────────────────────────── */
    --background:     40 33% 94%;    /* #F5F0E8 off-white */
    --foreground:     210 52% 11%;   /* #0D1B2A dark navy */

    /* ── Cards / Surfaces ─────────────────────────── */
    --card:           40 33% 96%;
    --card-foreground: 210 52% 11%;
    --popover:        40 33% 96%;
    --popover-foreground: 210 52% 11%;

    /* ── Brand Primary — Gold ─────────────────────── */
    --primary:        40 56% 54%;    /* #C9A84C gold */
    --primary-foreground: 210 52% 11%; /* dark text on gold */

    /* ── Brand Secondary — Navy ───────────────────── */
    --secondary:      210 52% 11%;   /* #0D1B2A */
    --secondary-foreground: 40 33% 94%;

    /* ── Interactive — Blue ───────────────────────── */
    --accent:         211 65% 57%;   /* #4A90D9 interactive blue */
    --accent-foreground: 0 0% 100%;

    /* ── Muted ────────────────────────────────────── */
    --muted:          210 20% 88%;
    --muted-foreground: 210 20% 40%;

    /* ── Destructive ──────────────────────────────── */
    --destructive:    0 72% 51%;
    --destructive-foreground: 0 0% 100%;

    /* ── Borders & Inputs ─────────────────────────── */
    --border:         210 20% 82%;
    --input:          210 20% 82%;
    --ring:           211 65% 57%;   /* focus ring = interactive blue */

    /* ── Radius ───────────────────────────────────── */
    --radius: 0.5rem;
  }

  /* No dark mode defined for v1 — internal tool, light only */
}
```

**Deriving HSL from hex:**
- `#0D1B2A` → hsl(210, 52%, 11%)
- `#C9A84C` → hsl(40, 56%, 54%)
- `#F5F0E8` → hsl(40, 33%, 94%)
- `#4A90D9` → hsl(211, 65%, 57%)

Use a tool like https://www.colorhexa.com/ for final verification before shipping.

### tailwind.config.ts — Wire Tokens to Utilities

shadcn/ui's init already sets this up, but confirm the `extend.colors` block:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (references CSS variables)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // BeFast direct aliases (for one-off use)
        navy:  "#0D1B2A",
        gold:  "#C9A84C",
        ivory: "#F5F0E8",
        blue:  "#4A90D9",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
export default config;
```

### next/font — Playfair Display + DM Sans

```typescript
// app/layout.tsx
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
```

Wire into Tailwind:

```typescript
// tailwind.config.ts (inside extend)
fontFamily: {
  sans:   ["var(--font-dm-sans)", "system-ui", "sans-serif"],
  serif:  ["var(--font-playfair)", "Georgia", "serif"],
  heading: ["var(--font-playfair)", "Georgia", "serif"],
},
```

Usage: `className="font-heading text-2xl font-semibold"` for page titles, `className="font-sans"` everywhere else (body default).

---

## 2. Kanban Board — @dnd-kit/core

### Installation

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Data Model

```typescript
// types/prospection.ts
export type KanbanStatus =
  | "a_contacter"
  | "contacte"
  | "relance"
  | "rdv_pris"
  | "proposition_envoyee"
  | "gagne"
  | "perdu";

export interface ProspectCard {
  id: string;
  nom: string;
  statut: KanbanStatus;
  responsable: string;
  prochaineAction: string;
}

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: "a_contacter",          label: "À contacter" },
  { id: "contacte",             label: "Contacté" },
  { id: "relance",              label: "Relancé" },
  { id: "rdv_pris",             label: "RDV pris" },
  { id: "proposition_envoyee",  label: "Proposition envoyée" },
  { id: "gagne",                label: "Gagné" },
  { id: "perdu",                label: "Perdu" },
];
```

### Board Container

```tsx
// components/kanban/KanbanBoard.tsx
"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { ProspectCard, KanbanStatus, KANBAN_COLUMNS } from "@/types/prospection";

interface KanbanBoardProps {
  initialCards: ProspectCard[];
  onCardMove: (cardId: string, newStatus: KanbanStatus) => Promise<void>;
}

export function KanbanBoard({ initialCards, onCardMove }: KanbanBoardProps) {
  const [cards, setCards] = useState(initialCards);
  const [activeCard, setActiveCard] = useState<ProspectCard | null>(null);

  // Require 8px movement before drag starts — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const cardsByColumn = (columnId: KanbanStatus) =>
    cards.filter((c) => c.statut === columnId);

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // over.id can be a column ID or a card ID
    const overIsColumn = KANBAN_COLUMNS.some((col) => col.id === overId);
    const targetColumn = overIsColumn
      ? (overId as KanbanStatus)
      : cards.find((c) => c.id === overId)?.statut;

    if (!targetColumn) return;

    setCards((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, statut: targetColumn } : c
      )
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const card = cards.find((c) => c.id === active.id);
    if (card) {
      await onCardMove(card.id, card.statut);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[70vh]">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            cards={cardsByColumn(col.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCard && (
          <KanbanCard card={activeCard} isOverlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

### Column Component

```tsx
// components/kanban/KanbanColumn.tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./KanbanCard";
import { ProspectCard, KanbanStatus } from "@/types/prospection";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLUMN_COLORS: Record<KanbanStatus, string> = {
  a_contacter:         "bg-muted",
  contacte:            "bg-blue-50 border-blue-200",
  relance:             "bg-amber-50 border-amber-200",
  rdv_pris:            "bg-violet-50 border-violet-200",
  proposition_envoyee: "bg-orange-50 border-orange-200",
  gagne:               "bg-green-50 border-green-200",
  perdu:               "bg-red-50 border-red-200",
};

interface KanbanColumnProps {
  column: { id: KanbanStatus; label: string };
  cards: ProspectCard[];
}

export function KanbanColumn({ column, cards }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-sans font-semibold text-sm text-foreground">
          {column.label}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {cards.length}
        </Badge>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 rounded-lg border p-2 min-h-[200px] flex-1 transition-colors",
          COLUMN_COLORS[column.id],
          isOver && "ring-2 ring-primary ring-offset-1"
        )}
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
```

### Card Component

```tsx
// components/kanban/KanbanCard.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProspectCard } from "@/types/prospection";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface KanbanCardProps {
  card: ProspectCard;
  isOverlay?: boolean;
}

export function KanbanCard({ card, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border shadow-sm cursor-default select-none",
        isDragging && "opacity-40",
        isOverlay && "shadow-xl rotate-1 cursor-grabbing"
      )}
    >
      <CardContent className="p-3 flex items-start gap-2">
        {/* Drag handle — separate from card content so clicks work */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Déplacer la carte"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-sm text-foreground truncate">
            {card.nom}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {card.responsable}
          </p>
          {card.prochaineAction && (
            <p className="text-xs text-accent mt-1 truncate">
              {card.prochaineAction}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Key decisions:**
- Use `closestCorners` collision strategy, not `closestCenter` — better for Kanban because it prevents snapping to the nearest card center when crossing column boundaries.
- Separate drag handle (`GripVertical`) from card content so buttons inside cards remain clickable.
- `DragOverlay` renders the dragged ghost at full opacity; the source card becomes semi-transparent (`opacity-40`).
- Optimistic UI update on `handleDragOver`, then persist on `handleDragEnd`.

---

## 3. Gantt / Timeline Scheduler — @dnd-kit/sortable

### Concept

The Gantt for études uses a week-based horizontal grid. Each row is a mission/phase block. Blocks are absolutely positioned within a CSS Grid with named week columns. Drag-to-move shifts the `semaineDebut`. Resize is handled with a separate resize handle (not @dnd-kit — use `mousedown` + `mousemove`).

### Data Model

```typescript
// types/gantt.ts
export interface GanttBlock {
  id: string;
  nom: string;
  semaineDebut: number;  // 1-indexed from study start
  dureeEnSemaines: number;
  jeh: number;
  couleur?: string;
}

export interface GanttRow {
  id: string;
  label: string;
  blocks: GanttBlock[];
}
```

### Grid Layout Strategy

Use CSS Grid with explicit column tracks, one per week. This avoids complex pixel math.

```tsx
// components/gantt/GanttGrid.tsx
"use client";

import { useMemo } from "react";
import { GanttRow, GanttBlock } from "@/types/gantt";
import { DraggableBlock } from "./DraggableBlock";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

const TOTAL_WEEKS = 26; // 6-month default view
const COL_WIDTH_PX = 80; // px per week column

interface GanttGridProps {
  rows: GanttRow[];
  onBlockMove: (blockId: string, newSemaineDebut: number) => void;
  onBlockResize: (blockId: string, newDuree: number) => void;
}

export function GanttGrid({ rows, onBlockMove, onBlockResize }: GanttGridProps) {
  const weeks = useMemo(() => Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    if (!delta) return;

    // Convert pixel delta to week delta
    const weekDelta = Math.round(delta.x / COL_WIDTH_PX);
    if (weekDelta === 0) return;

    // Find the block and compute new start
    for (const row of rows) {
      const block = row.blocks.find((b) => b.id === active.id);
      if (block) {
        const newStart = Math.max(1, block.semaineDebut + weekDelta);
        onBlockMove(block.id, newStart);
        break;
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        {/* Week header */}
        <div
          className="flex border-b border-border"
          style={{ width: TOTAL_WEEKS * COL_WIDTH_PX }}
        >
          {weeks.map((w) => (
            <div
              key={w}
              className="flex-shrink-0 text-xs text-center text-muted-foreground py-1 border-r border-border"
              style={{ width: COL_WIDTH_PX }}
            >
              S{w}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row) => (
          <div key={row.id} className="relative flex items-center border-b border-border">
            {/* Background grid lines */}
            <div
              className="absolute inset-0 flex"
              aria-hidden="true"
            >
              {weeks.map((w) => (
                <div
                  key={w}
                  className={cn(
                    "flex-shrink-0 border-r border-border/40 h-full",
                    w % 4 === 0 && "border-r-border/80"
                  )}
                  style={{ width: COL_WIDTH_PX }}
                />
              ))}
            </div>

            {/* Blocks */}
            <div
              className="relative"
              style={{ width: TOTAL_WEEKS * COL_WIDTH_PX, height: 56 }}
            >
              {row.blocks.map((block) => (
                <DraggableBlock
                  key={block.id}
                  block={block}
                  colWidthPx={COL_WIDTH_PX}
                  onResize={onBlockResize}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
```

### Draggable Block with Resize Handle

```tsx
// components/gantt/DraggableBlock.tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useCallback } from "react";
import { GanttBlock } from "@/types/gantt";
import { cn } from "@/lib/utils";

interface DraggableBlockProps {
  block: GanttBlock;
  colWidthPx: number;
  onResize: (blockId: string, newDuree: number) => void;
}

export function DraggableBlock({ block, colWidthPx, onResize }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
  });

  const resizeStartX = useRef<number | null>(null);
  const initialDuree = useRef<number>(block.dureeEnSemaines);

  const style = {
    position: "absolute" as const,
    left: (block.semaineDebut - 1) * colWidthPx,
    width: block.dureeEnSemaines * colWidthPx - 4, // 4px gap
    top: 4,
    height: 48,
    transform: CSS.Translate.toString(transform),
  };

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // don't trigger drag
      resizeStartX.current = e.clientX;
      initialDuree.current = block.dureeEnSemaines;

      function onMouseMove(ev: MouseEvent) {
        if (resizeStartX.current === null) return;
        const deltaX = ev.clientX - resizeStartX.current;
        const deltaWeeks = Math.round(deltaX / colWidthPx);
        const newDuree = Math.max(1, initialDuree.current + deltaWeeks);
        onResize(block.id, newDuree);
      }

      function onMouseUp() {
        resizeStartX.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [block.id, block.dureeEnSemaines, colWidthPx, onResize]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded bg-accent text-accent-foreground text-xs font-sans font-medium",
        "flex items-center px-2 pr-0 overflow-hidden group cursor-grab",
        "border border-accent/60 shadow-sm",
        isDragging && "opacity-50 cursor-grabbing"
      )}
      {...attributes}
      {...listeners}
    >
      <span className="truncate flex-1">{block.nom}</span>
      <span className="ml-1 text-accent-foreground/70">{block.jeh}j</span>

      {/* Resize handle — right edge */}
      <div
        className={cn(
          "w-3 flex-shrink-0 h-full flex items-center justify-center",
          "cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:bg-accent-foreground/20"
        )}
        onMouseDown={handleResizeMouseDown}
        // Remove dnd listeners from resize handle
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Redimensionner"
      >
        <div className="w-0.5 h-4 bg-accent-foreground/60 rounded" />
      </div>
    </div>
  );
}
```

**Key decisions:**
- Drag-to-move uses `@dnd-kit/core` `useDraggable` with pixel-to-week snapping.
- Resize uses raw `mousemove` events (not @dnd-kit) because @dnd-kit doesn't natively support resize gestures. The resize handle calls `e.stopPropagation()` and `onPointerDown` stops propagation to prevent triggering the drag.
- Absolute positioning within a fixed-width container avoids CSS Grid reflow during drag.
- `Math.round(delta.x / colWidthPx)` snaps to the nearest week automatically.

---

## 4. Role-Based Sidebar Navigation

### Permission Shape (from ROLE-02)

Each user's role has a boolean permission per page. The sidebar must render conditionally based on this object — not just the role name — because admins can create custom roles (ROLE-03).

```typescript
// types/permissions.ts
export interface Permissions {
  dashboard: boolean;
  membres: boolean;
  missions: boolean;
  etudes: boolean;
  prospection: boolean;
  statistiques: boolean;
  administration: boolean;
  profil: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: keyof Permissions;
}
```

### Nav Item Definition

```typescript
// lib/navigation.ts
import {
  LayoutDashboard, Users, Briefcase, FolderOpen,
  TrendingUp, BarChart3, Settings, User
} from "lucide-react";
import { NavItem } from "@/types/permissions";

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",      label: "Tableau de bord",  icon: LayoutDashboard, permission: "dashboard"      },
  { href: "/membres",        label: "Membres",           icon: Users,           permission: "membres"        },
  { href: "/missions",       label: "Missions",          icon: Briefcase,       permission: "missions"       },
  { href: "/etudes",         label: "Études",            icon: FolderOpen,      permission: "etudes"         },
  { href: "/prospection",    label: "Prospection",       icon: TrendingUp,      permission: "prospection"    },
  { href: "/statistiques",   label: "Statistiques",      icon: BarChart3,       permission: "statistiques"   },
  { href: "/administration", label: "Administration",    icon: Settings,        permission: "administration" },
  { href: "/profil",         label: "Mon profil",        icon: User,            permission: "profil"         },
];
```

### Sidebar Component

```tsx
// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import { Permissions } from "@/types/permissions";
import { cn } from "@/lib/utils";

interface SidebarProps {
  permissions: Permissions;
  userName: string;
}

export function Sidebar({ permissions, userName }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => permissions[item.permission]
  );

  return (
    <aside className="w-64 flex-shrink-0 bg-secondary text-secondary-foreground flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <span className="font-heading text-xl font-bold text-primary">
          BeFast
        </span>
        <p className="text-xs text-secondary-foreground/50 mt-0.5">
          Odensia Junior Conseil
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-sans font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"   // gold highlight on active
                      : "text-secondary-foreground/70 hover:bg-white/5 hover:text-secondary-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-primary" : "text-secondary-foreground/50"
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-white/10">
        <p className="text-xs font-sans text-secondary-foreground/60 truncate">
          {userName}
        </p>
      </div>
    </aside>
  );
}
```

### RoleGuard Component (Server-Side + Client-Side)

Prefer middleware protection for routes, but add a client guard for partial page blocking:

```tsx
// components/auth/RoleGuard.tsx
"use client";

import { Permissions } from "@/types/permissions";
import { AlertCircle } from "lucide-react";

interface RoleGuardProps {
  permissions: Permissions;
  required: keyof Permissions;
  children: React.ReactNode;
}

export function RoleGuard({ permissions, required, children }: RoleGuardProps) {
  if (!permissions[required]) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="font-sans text-sm">
          Vous n'avez pas accès à cette section.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
```

**How permissions are loaded:** Fetch from Supabase in a Server Component layout, then pass down as props. Never expose permissions checks in client-only code without server-side enforcement in middleware.

```tsx
// app/dashboard/layout.tsx (Server Component)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({ children }) {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profils")
    .select("permissions, nom_complet")
    .eq("user_id", user.id)
    .single();

  if (!profil) redirect("/attente"); // pending role assignment

  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={profil.permissions} userName={profil.nom_complet} />
      <main className="flex-1 overflow-y-auto bg-background p-6">
        {children}
      </main>
    </div>
  );
}
```

---

## 5. shadcn/ui Components — Best Practices

### 5.1 Data Tables (TanStack Table + shadcn/ui)

shadcn/ui's DataTable is built on TanStack Table v8. Install:

```bash
npx shadcn@latest add table
npm install @tanstack/react-table
```

**Pattern for sortable + filterable member table:**

```tsx
// components/data-table/MembresTable.tsx
"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

interface Membre {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  statut: "actif" | "inactif";
}

const columns: ColumnDef<Membre>[] = [
  {
    accessorKey: "nom",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3"
      >
        Nom
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
  },
  {
    accessorKey: "prenom",
    header: "Prénom",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Rôle",
    cell: ({ row }) => (
      <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
        {row.original.role}
      </span>
    ),
  },
  {
    accessorKey: "statut",
    header: "Statut",
    cell: ({ row }) => {
      const actif = row.original.statut === "actif";
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          actif ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
        }`}>
          {actif ? "Actif" : "Inactif"}
        </span>
      );
    },
  },
];

export function MembresTable({ data }: { data: Membre[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Rechercher un membre..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="font-sans font-semibold text-xs uppercase text-muted-foreground">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  Aucun membre trouvé.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="font-sans text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} résultat(s)
      </p>
    </div>
  );
}
```

### 5.2 Form Wizards (Multi-Step)

Use a controlled step state with shadcn/ui `Card` and `react-hook-form` + `zod` per step. Each step validates independently before advancing.

```tsx
// components/forms/EtudeFormWizard.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Step schemas — validate independently
const step1Schema = z.object({
  nom: z.string().min(2, "Minimum 2 caractères"),
  numero: z.string().min(1, "Numéro requis"),
});

const step2Schema = z.object({
  client: z.string().min(2, "Client requis"),
  budget: z.coerce.number().min(0),
});

const STEPS = [
  { title: "Informations générales", description: "Nom et numéro de l'étude" },
  { title: "Client & Budget",        description: "Informations contractuelles" },
  { title: "Récapitulatif",          description: "Vérification avant création" },
];

export function EtudeFormWizard({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [step, setStep] = useState(0);
  const [allData, setAllData] = useState({});

  const form1 = useForm({ resolver: zodResolver(step1Schema) });
  const form2 = useForm({ resolver: zodResolver(step2Schema) });

  const currentForm = [form1, form2][step] ?? form1;
  const progress = ((step + 1) / STEPS.length) * 100;

  async function handleNext() {
    if (step === 0) {
      const valid = await form1.trigger();
      if (!valid) return;
      setAllData((prev) => ({ ...prev, ...form1.getValues() }));
    } else if (step === 1) {
      const valid = await form2.trigger();
      if (!valid) return;
      setAllData((prev) => ({ ...prev, ...form2.getValues() }));
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleFinalSubmit() {
    onSubmit(allData);
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Étape {step + 1} sur {STEPS.length}</span>
          <span>{STEPS[step].title}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">{STEPS[step].title}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>

        <CardContent>
          {step === 0 && (
            <Form {...form1}>
              <div className="space-y-4">
                <FormField control={form1.control} name="nom" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'étude</FormLabel>
                    <FormControl><Input placeholder="Ex : Étude stratégique Acme" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form1.control} name="numero" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro unique</FormLabel>
                    <FormControl><Input placeholder="Ex : OJC-2026-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </Form>
          )}

          {step === 1 && (
            <Form {...form2}>
              <div className="space-y-4">
                <FormField control={form2.control} name="client" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du client</FormLabel>
                    <FormControl><Input placeholder="Ex : Acme Corp" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form2.control} name="budget" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (€)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </Form>
          )}

          {step === 2 && (
            <div className="space-y-2 text-sm font-sans">
              <p><span className="font-semibold">Nom :</span> {(allData as any).nom}</p>
              <p><span className="font-semibold">Numéro :</span> {(allData as any).numero}</p>
              <p><span className="font-semibold">Client :</span> {(allData as any).client}</p>
              <p><span className="font-semibold">Budget :</span> {(allData as any).budget} €</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={handleBack} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinalSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Créer l'étude
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
```

### 5.3 Modal Dialogs

Use shadcn/ui `Dialog`. Two patterns: controlled (state in parent) and URL-driven (for deep-linking).

```tsx
// Pattern 1: Controlled dialog (most common)
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CandidatureDialog({ missionId }: { missionId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Candidater</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Candidature à la mission</DialogTitle>
          <DialogDescription>
            Expliquez votre motivation et votre disponibilité.
          </DialogDescription>
        </DialogHeader>
        {/* Form content */}
        <CandidatureForm missionId={missionId} />
      </DialogContent>
    </Dialog>
  );
}
```

**Confirm dialogs (destructive actions):**

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ConfirmDesactivation({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">Désactiver</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Désactiver ce compte ?</AlertDialogTitle>
          <AlertDialogDescription>
            L'utilisateur perdra immédiatement l'accès à l'application.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Désactiver
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 5.4 Accordion Forms (Settings Pages)

The Administration settings page (ADM-04 to ADM-08) maps perfectly to shadcn/ui `Accordion` — one accordion item per configuration section, each containing a form.

```tsx
// components/admin/ParametresStructure.tsx
"use client";

import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, DollarSign, Users, FileText } from "lucide-react";

export function ParametresStructure() {
  return (
    <Accordion type="multiple" className="space-y-2">
      <AccordionItem value="identite" className="border rounded-lg px-4">
        <AccordionTrigger className="font-sans font-semibold text-sm hover:no-underline">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Identité juridique
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <IdentiteJuridiqueForm />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="dirigeants" className="border rounded-lg px-4">
        <AccordionTrigger className="font-sans font-semibold text-sm hover:no-underline">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Dirigeants
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <DirigeantForm />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="financier" className="border rounded-lg px-4">
        <AccordionTrigger className="font-sans font-semibold text-sm hover:no-underline">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Données financières
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <FinancierForm />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="numerotation" className="border rounded-lg px-4">
        <AccordionTrigger className="font-sans font-semibold text-sm hover:no-underline">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Numérotation automatique
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <NumerotationForm />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

Use `type="multiple"` so multiple sections can be open simultaneously. Use `type="single"` with `collapsible` if you prefer one-at-a-time.

---

## 6. Status Badge System

Centralize status → badge mapping to enforce consistency (UX-05):

```tsx
// components/ui/StatusBadge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MissionStatus = "ouverte" | "en_cours" | "terminee" | "annulee" | "en_attente" | "pourvue";

const STATUS_CONFIG: Record<MissionStatus, { label: string; className: string }> = {
  ouverte:     { label: "Ouverte",     className: "bg-green-100 text-green-700 border-green-200" },
  en_cours:    { label: "En cours",    className: "bg-blue-100 text-blue-700 border-blue-200" },
  terminee:    { label: "Terminée",    className: "bg-gray-100 text-gray-600 border-gray-200" },
  annulee:     { label: "Annulée",     className: "bg-red-100 text-red-700 border-red-200" },
  en_attente:  { label: "En attente",  className: "bg-orange-100 text-orange-700 border-orange-200" },
  pourvue:     { label: "Pourvue",     className: "bg-violet-100 text-violet-700 border-violet-200" },
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium font-sans", config.className)}
    >
      {config.label}
    </Badge>
  );
}
```

---

## 7. Page Layout Shell

Consistent page layout for all dashboard pages:

```tsx
// components/layout/PageShell.tsx
interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
```

Usage:
```tsx
<PageShell
  title="Gestion des missions"
  description="Créez et gérez les missions de la Junior-Entreprise."
  actions={<Button>Nouvelle mission</Button>}
>
  <MissionsTable data={missions} />
</PageShell>
```

---

## 8. Implementation Notes & Pitfalls

### shadcn/ui Theming Pitfalls

- **Do not use hex colors directly in Tailwind classes.** Always use the token classes (`bg-primary`, `text-accent`, etc.). Direct hex use breaks the theming system.
- **HSL conversion accuracy matters.** Convert precisely — a 2° hue error is visible on the gold color.
- **`globals.css` import order is critical.** The `@layer base { :root {} }` block must come after `@tailwind base;` but the variables themselves load first due to cascade. Keep them in `@layer base`.
- **shadcn/ui v0.x vs v1.x.** The `shadcn@latest add` CLI installs components into your project. Always use the same major version consistently.

### @dnd-kit Pitfalls

- **`PointerSensor` with `activationConstraint: { distance: 8 }`** is essential. Without it, clicking inside cards (to open modals) accidentally triggers drags.
- **Do not use `MouseSensor` + `TouchSensor` together in Next.js App Router** — causes hydration issues in some SSR setups. Stick to `PointerSensor`.
- **`DragOverlay` is required for Kanban** to render the ghost element outside the droppable containers, avoiding z-index and overflow clipping issues.
- **Optimistic updates in Kanban**: update `useState` in `onDragOver` for instant visual feedback, then call the API in `onDragEnd`. If the API call fails, roll back by refetching.
- **Gantt resize and drag conflict**: the resize handle `onPointerDown` must call `e.stopPropagation()` to prevent @dnd-kit from intercepting the event and starting a drag.

### Form Wizards Pitfalls

- **Separate `useForm` per step** (not one shared form) avoids issues where Zod schemas for different steps conflict. Merge data into a local `allData` state between steps.
- **`form.trigger()` before advancing** validates only the current step's fields. This is cleaner than trying to validate a subset of a combined form.

### Sidebar / Permissions Pitfalls

- **Never trust client-side permission checks alone.** The sidebar hides nav items, but middleware (`middleware.ts`) must enforce access at the route level. A user who knows a URL can bypass sidebar-only guards.
- **Permissions object vs role string**: store permissions as a JSON object in the `profils` table, not just a role enum. This enables custom roles (ROLE-03) without code changes.

---

## Sources

- shadcn/ui theming documentation: https://ui.shadcn.com/docs/theming (HIGH confidence — stable API since 2023)
- @dnd-kit/core documentation: https://docs.dndkit.com (HIGH confidence — verified against v6.x API)
- TanStack Table v8 documentation: https://tanstack.com/table/v8 (HIGH confidence)
- next/font documentation: https://nextjs.org/docs/app/api-reference/components/font (HIGH confidence)
- Patterns derived from training data on @dnd-kit Kanban examples (MEDIUM — verify `closestCorners` import path against installed version)
- Gantt resize pattern via raw `mousemove` is a common workaround; @dnd-kit does not natively support resize as of v6 (MEDIUM — verify current @dnd-kit release notes)
