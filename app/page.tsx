"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push("/login")
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen bg-[#f7f9fb]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#00236f] mb-2">BeFast</h1>
        <p className="text-slate-600">Redirection en cours...</p>
      </div>
    </div>
  )
}
