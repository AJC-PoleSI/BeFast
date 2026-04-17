import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { customFieldValueSchema } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { NextResponse } from "next/server"
import { z } from "zod"

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Get all custom field definitions
    const { data: fields, error: fieldsError } = await supabase
      .from("custom_fields")
      .select("*")
      .order("ordre", { ascending: true })

    if (fieldsError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des champs" },
        { status: 500 }
      )
    }

    // Get user's custom field values
    const { data: values, error: valuesError } = await supabase
      .from("custom_field_values")
      .select("*")
      .eq("user_id", user.id)

    if (valuesError) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des valeurs" },
        { status: 500 }
      )
    }

    // Map values to field definitions
    const fieldValues = (fields || []).map((field) => ({
      ...field,
      value: (values || []).find((v) => v.field_id === field.id)?.value || "",
    }))

    return NextResponse.json({ fields: fieldValues })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const updates = Array.isArray(body) ? body : [body]

    // Validate all updates
    const validationSchema = z.array(customFieldValueSchema)
    const parsed = validationSchema.safeParse(updates)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const results = []

    for (const update of parsed.data) {
      // Check if field exists
      const { data: fieldExists } = await admin
        .from("custom_fields")
        .select("id")
        .eq("id", update.fieldId)
        .single()

      if (!fieldExists) {
        return NextResponse.json(
          { error: `Champ ${update.fieldId} introuvable` },
          { status: 404 }
        )
      }

      // Upsert the value
      const { data, error } = await admin
        .from("custom_field_values")
        .upsert(
          {
            user_id: user.id,
            field_id: update.fieldId,
            value: update.value || null,
          },
          { onConflict: "user_id,field_id" }
        )
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: "Erreur lors de la mise à jour" },
          { status: 500 }
        )
      }

      results.push(data)
    }

    return NextResponse.json({ success: true, data: results })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}
