import "server-only"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { customFieldSchema } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { NextResponse } from "next/server"

async function verifyAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from("personnes")
    .select("profils_types(slug)")
    .eq("id", user.id)
    .single()

  const slug = (profile?.profils_types as { slug?: string } | null)?.slug
  return slug === "administrateur" ? user.id : null
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const adminId = await verifyAdmin(supabase)

    if (!adminId) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    const { data: fields, error } = await supabase
      .from("custom_fields")
      .select("*")
      .order("ordre", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération" },
        { status: 500 }
      )
    }

    return NextResponse.json({ fields })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const adminId = await verifyAdmin(supabase)

    if (!adminId) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = customFieldSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const dataToInsert = {
      ...parsed.data,
      options:
        parsed.data.type === "select"
          ? { values: parsed.data.options || [] }
          : null,
    }

    const { data, error } = await admin
      .from("custom_fields")
      .insert(dataToInsert)
      .select()
      .single()

    if (error) {
      if (error.message.includes("duplicate")) {
        return NextResponse.json(
          { error: "Ce champ existe déjà" },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: "Erreur lors de la création" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
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
    const adminId = await verifyAdmin(supabase)

    if (!adminId) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: "ID du champ requis" },
        { status: 400 }
      )
    }

    const parsed = customFieldSchema.partial().safeParse(updateData)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const dataToUpdate = {
      ...parsed.data,
      options:
        parsed.data.type === "select"
          ? { values: parsed.data.options || [] }
          : null,
    }

    const { data, error } = await admin
      .from("custom_fields")
      .update(dataToUpdate)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const adminId = await verifyAdmin(supabase)

    if (!adminId) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "ID du champ requis" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("custom_fields")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
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
