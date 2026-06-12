"use client"

import { GripVertical } from "lucide-react"
import {
  Button as AriaButton,
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  type GridListItemProps as AriaGridListItemProps,
  type GridListProps as AriaGridListProps,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

/**
 * Liste à sélection multiple Be Fast (react-aria-components).
 * Usage standard pour toute série d'options à cocher.
 */
export function GridList<T extends object>({
  children,
  ...props
}: AriaGridListProps<T>) {
  return (
    <AriaGridList
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn(
          "flex flex-col gap-1 overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-sm shadow-black/5 outline-none",
          "data-[empty]:p-6 data-[empty]:text-center data-[empty]:text-sm data-[empty]:text-muted-foreground",
          className
        )
      )}
    >
      {children}
    </AriaGridList>
  )
}

export function GridListItem({
  children,
  className,
  ...props
}: AriaGridListItemProps) {
  const textValue = typeof children === "string" ? children : undefined
  return (
    <AriaGridListItem
      textValue={textValue}
      className={composeRenderProps(className, (className) =>
        cn(
          "relative flex w-full cursor-default select-none items-center gap-3 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          "data-[focus-visible]:z-10 data-[focus-visible]:outline-none data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-ring/20",
          "data-[hovered]:bg-accent data-[hovered]:text-accent-foreground",
          "data-[selected]:bg-muted data-[selected]:text-foreground",
          "data-[dragging]:opacity-60",
          className
        )
      )}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          {renderProps.allowsDragging && (
            <AriaButton slot="drag" className="text-muted-foreground">
              <GripVertical className="size-4" />
            </AriaButton>
          )}
          {renderProps.selectionMode === "multiple" &&
            renderProps.selectionBehavior === "toggle" && (
              <Checkbox slot="selection" />
            )}
          {children}
        </>
      ))}
    </AriaGridListItem>
  )
}
