"use client"

import { Minus, Plus } from "lucide-react"
import {
  Button as AriaButton,
  Group,
  Input as AriaInput,
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

interface NumberFieldProps extends AriaNumberFieldProps {
  className?: string
}

/**
 * Champ numérique Be Fast avec incrément/décrément (react-aria-components).
 * Aligné sur la charte des Input (rounded-lg, ombre, focus ring-3).
 */
function NumberField({ className, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField
      className={composeRenderProps(className, (c) => cn("group", c))}
      {...props}
    >
      <Group className="relative inline-flex h-9 w-full items-center overflow-hidden rounded-lg border border-input bg-background text-sm text-foreground shadow-sm shadow-black/5 transition-shadow data-[focus-within]:border-ring data-[focus-within]:outline-none data-[focus-within]:ring-[3px] data-[focus-within]:ring-ring/20 data-[disabled]:opacity-50">
        <AriaButton
          slot="decrement"
          aria-label="Diminuer"
          className="flex h-full w-9 items-center justify-center border-r border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus className="size-4" />
        </AriaButton>
        <AriaInput className="w-full grow bg-transparent px-3 py-2 text-center tabular-nums focus:outline-none" />
        <AriaButton
          slot="increment"
          aria-label="Augmenter"
          className="flex h-full w-9 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-4" />
        </AriaButton>
      </Group>
    </AriaNumberField>
  )
}

export { NumberField }
