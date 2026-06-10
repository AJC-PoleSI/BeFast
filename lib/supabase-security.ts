/**
 * Supabase Security Utilities
 *
 * Server-side permission checks to complement RLS policies.
 * Use these in API routes to validate user permissions before database access.
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'administrateur' | 'manager' | 'intervenant' | 'client';

/**
 * Get current user's profile and role
 */
export async function getCurrentUserProfile(supabase: SupabaseClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: not authenticated');
  }

  const { data: profile, error: profileError } = await supabase
    .from('personnes')
    .select('*, profils_types(slug)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  return { user, profile };
}

/**
 * Require user to have specific role(s)
 */
export async function requireRole(
  supabase: SupabaseClient,
  allowedRoles: UserRole[]
) {
  const { profile } = await getCurrentUserProfile(supabase);
  const userRole = profile.profils_types?.slug as UserRole;

  if (!allowedRoles.includes(userRole)) {
    throw new Error(`Unauthorized: requires role ${allowedRoles.join(' or ')}, got ${userRole}`);
  }

  return profile;
}

/**
 * Check if user is admin
 */
export async function requireAdmin(supabase: SupabaseClient) {
  return requireRole(supabase, ['administrateur']);
}

/**
 * Check if user is admin or manager
 */
export async function requireAdminOrManager(supabase: SupabaseClient) {
  return requireRole(supabase, ['administrateur', 'manager']);
}

/**
 * Verify user owns a resource (by created_by_id)
 */
export async function requireOwnership(
  supabase: SupabaseClient,
  table: string,
  recordId: string,
  ownerField: string = 'created_by_id'
) {
  const { user } = await getCurrentUserProfile(supabase);

  const { data, error } = await supabase
    .from(table)
    .select(ownerField)
    .eq('id', recordId)
    .single();

  if (error || !data) {
    throw new Error(`Record not found: ${table}/${recordId}`);
  }

  if (data[ownerField] !== user.id) {
    throw new Error(`Unauthorized: you do not own this ${table} record`);
  }

  return data;
}

/**
 * Check if user is etude suiveur
 */
export async function requireEtudeSuiveur(
  supabase: SupabaseClient,
  etudeId: string
) {
  const { user } = await getCurrentUserProfile(supabase);

  const { data, error } = await supabase
    .from('etudes')
    .select('suiveur_id')
    .eq('id', etudeId)
    .single();

  if (error || !data) {
    throw new Error(`Etude not found: ${etudeId}`);
  }

  if (data.suiveur_id !== user.id) {
    throw new Error(`Unauthorized: you are not the suiveur for this etude`);
  }

  return data;
}

/**
 * Check if user is intervenant on a mission
 */
export async function requireMissionIntervenant(
  supabase: SupabaseClient,
  missionId: string
) {
  const { user } = await getCurrentUserProfile(supabase);

  const { data, error } = await supabase
    .from('mission_intervenants')
    .select('mission_id')
    .eq('mission_id', missionId)
    .eq('personne_id', user.id)
    .single();

  if (error || !data) {
    throw new Error(
      `Unauthorized: you are not an intervenant on this mission`
    );
  }

  return data;
}

/**
 * Check if user can access a mission
 * (either as intervenant, etude suiveur, or admin)
 */
export async function requireMissionAccess(
  supabase: SupabaseClient,
  missionId: string
) {
  const { user, profile } = await getCurrentUserProfile(supabase);
  const userRole = profile.profils_types?.slug as UserRole;

  // Admins always have access
  if (userRole === 'administrateur') {
    return { access: true as const, role: userRole };
  }

  // Check if intervenant on mission
  const { data: intervenant } = await supabase
    .from('mission_intervenants')
    .select('mission_id')
    .eq('mission_id', missionId)
    .eq('personne_id', user.id)
    .single();

  if (intervenant) {
    return { access: true as const, role: 'intervenant' as const };
  }

  // Check if etude suiveur
  const { data: mission } = await supabase
    .from('missions')
    .select('etude_id')
    .eq('id', missionId)
    .single();

  if (mission) {
    const { data: etude } = await supabase
      .from('etudes')
      .select('suiveur_id')
      .eq('id', mission.etude_id)
      .single();

    if (etude?.suiveur_id === user.id) {
      return { access: true as const, role: 'suiveur' as const };
    }
  }

  throw new Error('Unauthorized: no access to this mission');
}

/**
 * Sanitize response to remove sensitive fields based on user role
 */
export function sanitizeResponse(
  data: any,
  userRole: UserRole,
  resourceType: string
): any {
  if (!data) return data;

  const isArray = Array.isArray(data);
  const records = isArray ? data : [data];

  const sanitized = records.map((record) => {
    const sanitized = { ...record };

    // Only admins see certain fields
    if (userRole !== 'administrateur') {
      // Hide sensitive financial data from non-admins
      if (resourceType === 'factures' || resourceType === 'budget_etude') {
        if (resourceType === 'factures') {
          delete sanitized.montant_ttc;
          delete sanitized.montant_ht;
          delete sanitized.metadata;
        }
      }

      // Hide sensitive personal data
      if (resourceType === 'personnes') {
        delete sanitized.taux_horaire;
        delete sanitized.metadata;
      }
    }

    return sanitized;
  });

  return isArray ? sanitized : sanitized[0];
}

/**
 * Audit log helper
 */
export async function logAudit(
  supabase: SupabaseClient,
  table: string,
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string,
  details?: Record<string, any>
) {
  const { user } = await getCurrentUserProfile(supabase);

  await supabase.from('audit_logs').insert({
    table_name: table,
    operation,
    record_id: recordId,
    user_id: user.id,
    details,
    created_at: new Date().toISOString(),
  });
}
