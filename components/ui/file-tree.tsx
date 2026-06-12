"use client"

import { useState } from "react"
import { ChevronRight, File, Folder } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

export type FileNode = {
  name: string
  nodes?: FileNode[]
}

interface FilesystemItemProps {
  node: FileNode
  animated?: boolean
}

/**
 * Élément d'arborescence de fichiers Be Fast.
 * Dossiers en navy (couleur de marque), fichiers neutres + accent or.
 * Usage standard pour présenter les documents d'une étude / d'un intervenant.
 */
export function FilesystemItem({ node, animated = false }: FilesystemItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  const ChevronIcon = () =>
    animated ? (
      <motion.span
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="flex"
      >
        <ChevronRight className="size-4 text-muted-foreground" />
      </motion.span>
    ) : (
      <ChevronRight
        className={`size-4 text-muted-foreground transition-transform ${
          isOpen ? "rotate-90" : ""
        }`}
      />
    )

  const ChildrenList = () => {
    const children = node.nodes?.map((child) => (
      <FilesystemItem node={child} key={child.name} animated={animated} />
    ))

    if (animated) {
      return (
        <AnimatePresence>
          {isOpen && (
            <motion.ul
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="flex flex-col justify-end overflow-hidden pl-6"
            >
              {children}
            </motion.ul>
          )}
        </AnimatePresence>
      )
    }

    return isOpen ? <ul className="pl-6">{children}</ul> : null
  }

  return (
    <li className="text-sm text-foreground">
      <span className="flex items-center gap-1.5 py-1">
        {node.nodes && node.nodes.length > 0 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="-m-1 p-1"
            aria-label={isOpen ? "Réduire" : "Développer"}
          >
            <ChevronIcon />
          </button>
        )}

        {node.nodes ? (
          <Folder
            className={`size-5 text-primary ${
              node.nodes.length === 0 ? "ml-[22px]" : ""
            }`}
            fill="currentColor"
            fillOpacity={0.12}
          />
        ) : (
          <File className="ml-[22px] size-5 text-gold" />
        )}
        {node.name}
      </span>

      <ChildrenList />
    </li>
  )
}

interface FileTreeProps {
  nodes: FileNode[]
  animated?: boolean
  className?: string
}

/** Conteneur prêt à l'emploi pour une arborescence complète. */
export function FileTree({ nodes, animated = true, className }: FileTreeProps) {
  return (
    <ul className={className}>
      {nodes.map((node) => (
        <FilesystemItem key={node.name} node={node} animated={animated} />
      ))}
    </ul>
  )
}
