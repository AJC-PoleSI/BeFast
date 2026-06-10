/**
 * API Route Example: Secure Factures Endpoint
 *
 * This shows how to use lib/supabase-security.ts to add server-side permission checks.
 * Copy this pattern to all API routes that access sensitive data.
 */

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentUserProfile,
  requireRole,
  requireAdmin,
  sanitizeResponse,
  logAudit,
} from '@/lib/supabase-security';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/factures
 * List factures (filtered by RLS + additional checks)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Verify user is authenticated and get profile
    const { user, profile } = await getCurrentUserProfile(supabase);
    const userRole = profile.profils_types?.slug;

    // 2. RLS will filter results, but we can add additional checks
    // For admins: see all; for others: RLS handles it
    const { data: factures, error } = await supabase
      .from('factures')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Factures query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch factures' },
        { status: 500 }
      );
    }

    // 3. Optional: Sanitize sensitive fields based on role
    const sanitized = sanitizeResponse(factures, userRole, 'factures');

    // 4. Optional: Log access for audit
    await logAudit(supabase, 'factures', 'SELECT', 'all');

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('GET /api/factures error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 401 }
    );
  }
}

/**
 * POST /api/factures
 * Create a new facture (only authenticated users)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Verify user is authenticated
    const { user } = await getCurrentUserProfile(supabase);

    // 2. Parse request body
    const body = await req.json();
    const { etude_id, montant_ht, montant_ttc, ...data } = body;

    // 3. Validate required fields
    if (!etude_id || !montant_ht) {
      return NextResponse.json(
        { error: 'Missing required fields: etude_id, montant_ht' },
        { status: 400 }
      );
    }

    // 4. Create facture (RLS will enforce ownership via created_by_id)
    const { data: facture, error } = await supabase
      .from('factures')
      .insert({
        etude_id,
        montant_ht,
        montant_ttc,
        created_by_id: user.id,
        ...data,
      })
      .select()
      .single();

    if (error) {
      console.error('Facture insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create facture' },
        { status: 500 }
      );
    }

    // 5. Log creation
    await logAudit(supabase, 'factures', 'INSERT', facture.id, {
      montant_ht,
      montant_ttc,
    });

    return NextResponse.json(facture, { status: 201 });
  } catch (error) {
    console.error('POST /api/factures error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 401 }
    );
  }
}

/**
 * PATCH /api/factures/[id]
 * Update facture (only owner or admin)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // 1. Verify user is authenticated
    const { user, profile } = await getCurrentUserProfile(supabase);
    const userRole = profile.profils_types?.slug;
    const facturId = params.id;

    // 2. Fetch existing facture to verify ownership
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('created_by_id')
      .eq('id', facturId)
      .single();

    if (fetchError || !facture) {
      return NextResponse.json(
        { error: 'Facture not found' },
        { status: 404 }
      );
    }

    // 3. Check ownership (unless admin)
    if (userRole !== 'administrateur' && facture.created_by_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: you can only edit your own factures' },
        { status: 403 }
      );
    }

    // 4. Parse and apply updates
    const updates = await req.json();

    // 5. Prevent unauthorized field changes
    // (RLS trigger will catch this too, but fail early here)
    if (updates.created_by_id && updates.created_by_id !== user.id) {
      return NextResponse.json(
        { error: 'Cannot change ownership' },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('factures')
      .update(updates)
      .eq('id', facturId)
      .select()
      .single();

    if (updateError) {
      console.error('Facture update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update facture' },
        { status: 500 }
      );
    }

    // 6. Log update
    await logAudit(supabase, 'factures', 'UPDATE', facturId, updates);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/factures error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/factures/[id]
 * Delete facture (only admin)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // 1. Require admin role
    await requireAdmin(supabase);

    const facturId = params.id;

    // 2. Delete
    const { error } = await supabase
      .from('factures')
      .delete()
      .eq('id', facturId);

    if (error) {
      console.error('Facture delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete facture' },
        { status: 500 }
      );
    }

    // 3. Log deletion
    await logAudit(supabase, 'factures', 'DELETE', facturId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/factures error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
