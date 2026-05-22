"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, X, Download, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

let docxPreviewImported = false

export function DocumentViewer({
  open,
  onOpenChange,
  url,
  fileName,
}: {
  open: boolean
  onOpenChange: (val: boolean) => void
  url: string | null
  fileName: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const docxModuleRef = useRef<any>(null)

  const ext = fileName ? fileName.split(".").pop()?.toLowerCase() : ""
  const isDocx = ext === "docx"
  const isPdf = ext === "pdf"
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")

  useEffect(() => {
    if (!open || !url) {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
      setError(null)
      if (containerRef.current) containerRef.current.innerHTML = ""
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    const loadDocument = async () => {
      try {
        const res = await fetch(url, { cache: "force-cache" })
        if (!res.ok) throw new Error("Erreur lors du chargement du fichier")
        const blob = await res.blob()

        if (!active) return

        if (isDocx) {
          // Pre-import docx-preview module once to avoid repeated imports
          if (!docxModuleRef.current) {
            docxModuleRef.current = await import("docx-preview")
            docxPreviewImported = true
          }
          const docx = docxModuleRef.current
          if (containerRef.current) {
            // Clear container before rendering
            containerRef.current.innerHTML = ""
            await docx.renderAsync(blob, containerRef.current, undefined, {
              className: "docx-viewer-content",
              inWrapper: false,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: false,
              trimXmlDeclaration: true,
              debug: false,
            })
          }
        } else if (isPdf || isImage) {
          const objUrl = URL.createObjectURL(blob)
          setBlobUrl(objUrl)
        } else {
          throw new Error("Format non supporté pour la prévisualisation")
        }
      } catch (err: any) {
        console.error(err)
        if (active) setError(err.message || "Impossible d'afficher ce fichier")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDocument()

    return () => {
      active = false
    }
  }, [open, url, isDocx, isPdf, isImage])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-zinc-50/50">
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-sm font-bold text-zinc-800 truncate">{fileName || "Document"}</h2>
            <p className="text-[11px] text-zinc-500">Aperçu rapide</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#00236f] bg-[#00236f]/10 rounded-lg hover:bg-[#00236f]/20 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger
              </a>
            )}
            <button 
              onClick={() => onOpenChange(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/80 z-20 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin text-[#00236f] mb-3" />
              <p className="text-sm font-medium text-zinc-600">Chargement du document...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center p-6 max-w-md">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-zinc-800 font-bold mb-2">Aperçu indisponible</h3>
              <p className="text-sm text-zinc-500 mb-4">{error}</p>
              {url && (
                <a
                  href={url}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#00236f] rounded-lg shadow-sm hover:bg-[#1e3a8a] transition-colors"
                >
                  Télécharger le fichier original
                </a>
              )}
            </div>
          )}

          {/* Docx Container */}
          <div 
            ref={containerRef} 
            className={`w-full h-full overflow-auto bg-zinc-100/50 p-4 sm:p-8 flex-col items-center ${isDocx && !loading && !error ? "flex" : "hidden"}`}
            style={{ 
              // Basic styling for the docx pages
              "--docx-page-margin": "0 auto 20px auto",
              "--docx-page-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            } as any}
          />

          {/* PDF Container */}
          {isPdf && blobUrl && !loading && !error && (
            <iframe
              src={`${blobUrl}#toolbar=0`}
              className="w-full h-full border-0 bg-white"
              title={fileName || "PDF"}
            />
          )}

          {/* Image Container */}
          {isImage && blobUrl && !loading && !error && (
            <div className="w-full h-full p-6 flex items-center justify-center bg-zinc-50 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={blobUrl} 
                alt={fileName || "Image"} 
                className="max-w-full max-h-full object-contain shadow-sm rounded-lg border border-zinc-200 bg-white" 
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
