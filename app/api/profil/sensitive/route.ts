import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptToString } from "@/lib/encryption"
import {
  sensitiveFieldSchema,
  nssSchema,
  ibanSchema,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = sensitiveFieldSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { field, value } = parsed.data

    // Additional format validation
    if (field === "nss") {
      const nssResult = nssSchema.safeParse(value)
      if (!nssResult.success) {
        return NextResponse.json(
          { error: nssResult.error.issues[0].message },
          { status: 400 }
        )
      }
    } else if (field === "iban") {
      const ibanResult = ibanSchema.safeParse(value)
      if (!ibanResult.success) {
        return NextResponse.json(
          { error: ibanResult.error.issues[0].message },
          { status: 400 }
        )
      }
    }

    // SECURITY: Only the user themselves can update sensitive fields
    const encrypted = encryptToString(value)
    const column =
      field === "nss" ? "nss_encrypted" : "iban_encrypted"

    const admin = createAdminClient()
    const { error } = await admin
      .from("personnes")
      .update({ [column]: encrypted })
      .eq("id", user.id)

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
