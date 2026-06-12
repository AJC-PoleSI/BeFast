"use client"

import { Check, Minus } from "lucide-react"
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

/**
 * Case à cocher Be Fast (react-aria-components).
 * Bordure navy, remplissage navy à la sélection. Utilisée seule ou via
 * `slot="selection"` dans une {@link GridList}.
 */
function Checkbox({ className, children, ...props }: AriaCheckboxProps) {
  return (
    <AriaCheckbox
      className={composeRenderProps(className, (className) =>
        cn(
          "group/checkbox flex items-center gap-x-2 text-sm",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          className
        )
      )}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          <div
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-primary text-current shadow-sm shadow-black/5 transition-colors",
              "group-data-[selected]/checkbox:border-primary group-data-[selected]/checkbox:bg-primary group-data-[selected]/checkbox:text-primary-foreground",
              "group-data-[indeterminate]/checkbox:border-primary group-data-[indeterminate]/checkbox:bg-primary group-data-[indeterminate]/checkbox:text-primary-foreground",
              "group-data-[focus-visible]/checkbox:outline-none group-data-[focus-visible]/checkbox:ring-[3px] group-data-[focus-visible]/checkbox:ring-ring/20"
            )}
          >
            {renderProps.isIndeterminate ? (
              <Minus className="size-3" />
            ) : renderProps.isSelected ? (
              <Check className="size-3" />
            ) : null}
          </div>
          {children}
        </>
      ))}
    </AriaCheckbox>
  )
}

export { Checkbox }
