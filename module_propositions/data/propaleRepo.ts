// Accès données du module Propositions.
// Modèle : une proposition = une `etude` (statut 'prospect') + son contenu commercial
// dans `etude_propale` (1:1) + ses phases dans `echeancier_blocs`.
// Le CDP est une `personne` (suiveur_id) ; le client une `clients` (optionnel).

import type { SupabaseClient } from '@supabase/supabase-js';

export type Cdp = { id: string; prenom: string; nom: string; email?: string; portable?: string };
export type PhaseType = {
  id: number; name: string; objectifs?: string; methodologie?: string; contraintes?: string;
  duree_semaines?: number; intervenants_count?: number; jeh_price?: number;
};

// --- RÉFÉRENTIELS -----------------------------------------------------------

export async function loadCdps(supabase: SupabaseClient): Promise<Cdp[]> {
  // Le CDP est le suiveur de l'étude : n'importe quelle personne active nommée peut l'être.
  const { data } = await supabase
    .from('personnes')
    .select('id, prenom, nom, email, portable')
    .eq('actif', true)
    .order('nom');
  if (!data) return [];
  return (data as any[])
    .filter((p) => (p.prenom || p.nom))
    .map((p) => ({ id: p.id, prenom: p.prenom || '', nom: p.nom || '', email: p.email, portable: p.portable }));
}

export type Client = { id: string; nom: string; secteur?: string; contact_prenom?: string; contact_nom?: string; contact_civilite?: string; contact_email?: string; contact_phone?: string; is_autoentrepreneur?: boolean };

export async function loadClients(supabase: SupabaseClient): Promise<Client[]> {
  const { data } = await supabase.from('clients').select('*').eq('actif', true).order('nom');
  return (data as Client[]) || [];
}

/**
 * Retourne l'id du client rattaché à la proposition :
 * - si `form.clientId` est fourni, on le garde ;
 * - sinon on cherche un client existant par nom (insensible à la casse) ;
 * - sinon, si un nom d'entreprise est saisi, on crée le client en prospection.
 */
async function resolveClientId(supabase: SupabaseClient, form: any): Promise<string | null> {
  if (form.clientId) return form.clientId;
  const nom = (form.companyName || '').trim();
  if (!nom) return null;

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .ilike('nom', nom)
    .limit(1)
    .maybeSingle();
  if (existing) return (existing as any).id;

  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      nom,
      type: 'prospection', // nouveau client => en cours de prospection
      actif: true,
      contact_civilite: form.clientCivilite || 'M.',
      contact_prenom: form.clientFirstName || null,
      contact_nom: form.clientLastName || null,
      contact_email: form.clientEmail || null,
      contact_phone: form.clientPhone || null,
      is_autoentrepreneur: !!form.isAutoentrepreneur,
    })
    .select('id')
    .single();
  if (error) { console.warn('[Propale] Création client impossible :', error.message); return null; }
  return (created as any)?.id || null;
}

export async function loadCatalogPhases(supabase: SupabaseClient): Promise<PhaseType[]> {
  const { data } = await supabase
    .from('catalog_phases')
    .select('*')
    .eq('is_active', true)
    .order('ordre');
  return (data as PhaseType[]) || [];
}

// --- CALCUL DE L'ÉCHÉANCIER (semaine de début de chaque phase) --------------

function computeStartWeeks(phases: any[]): number[] {
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const duree = Number(p.dureeSemaines || 1);
    let start = 1;
    const after = p.startAfterPhaseId != null ? String(p.startAfterPhaseId) : 'project_start';
    if (after !== 'project_start') {
      const refIdx = phases.findIndex((q) => String(q.phaseId) === after);
      if (refIdx !== -1 && ends[refIdx] !== undefined) start = ends[refIdx] + 1;
      else if (i > 0 && ends[i - 1] !== undefined) start = ends[i - 1] + 1;
    }
    starts.push(start);
    ends.push(start + duree - 1);
  }
  return starts;
}

// --- SAUVEGARDE -------------------------------------------------------------

/**
 * Crée/met à jour une proposition (etude + etude_propale + echeancier_blocs).
 * `form` est l'objet du react-hook-form. Retourne l'id (uuid) de l'étude.
 */
export async function savePropale(supabase: SupabaseClient, form: any): Promise<string | null> {
  const numero: string = form.propaleId;
  const studyType = form.studyTypeSelect !== 'autre' ? form.studyTypeSelect : form.studyTypeCustom;
  const cdpId = form.cdpSelect && form.cdpSelect !== 'autre' ? form.cdpSelect : null;

  // Totaux
  let totalHt = 0;
  (form.phases || []).forEach((p: any) => { totalHt += Number(p.jehCount || 0) * Number(p.jehPrice || 0); });
  totalHt += Number(form.suiviJehCount || 0) * Number(form.suiviJehPrice || 0);
  totalHt += Number(form.globalFraisAnnexes || 0);
  const totalTtc = totalHt * 1.2;

  // Rattachement du client (réutilise un client existant ou en crée un en prospection)
  const clientId = await resolveClientId(supabase, form);

  // 1. Upsert de l'étude (clé naturelle = numero)
  const { data: etude, error: etudeErr } = await supabase
    .from('etudes')
    .upsert(
      {
        numero,
        nom: studyType || 'Proposition commerciale',
        client_id: clientId,
        suiveur_id: cdpId,
        statut: 'prospect',
        budget_ht: totalHt,
        date_debut: form.projectStartDate || null,
      },
      { onConflict: 'numero' }
    )
    .select('id')
    .single();

  if (etudeErr || !etude) {
    console.warn('[Propale] Échec upsert etude :', etudeErr?.message);
    return null;
  }
  const etudeId = (etude as any).id as string;

  // 2. Upsert du contenu commercial (1:1)
  await supabase.from('etude_propale').upsert(
    {
      etude_id: etudeId,
      propale_statut: form.propaleStatut || 'envoyée',
      study_type: studyType,
      contexte_situation: form.contextSituation,
      contexte_intervention: form.contextIntervention,
      contexte_enjeu: form.contextEnjeu,
      cdc_objectifs: form.cdcObjectifs,
      cdc_contraintes: form.cdcContraintes,
      cdc_livrables: form.cdcLivrables,
      suivi_jeh_count: Number(form.suiviJehCount || 0),
      suivi_jeh_price: Number(form.suiviJehPrice || 0),
      global_frais_annexes: Number(form.globalFraisAnnexes || 0),
      total_ht: totalHt,
      total_ttc: totalTtc,
      is_autoentrepreneur: !!form.isAutoentrepreneur,
      client_company: form.companyName,
      client_civilite: form.clientCivilite,
      client_first_name: form.clientFirstName,
      client_last_name: form.clientLastName,
      client_email: form.clientEmail,
      client_phone: form.clientPhone,
    },
    { onConflict: 'etude_id' }
  );

  // 3. Remplacement des phases (echeancier_blocs)
  await supabase.from('echeancier_blocs').delete().eq('etude_id', etudeId);
  const phases = form.phases || [];
  if (phases.length > 0) {
    const startWeeks = computeStartWeeks(phases);
    const blocs = phases.map((p: any, i: number) => {
      const after = p.startAfterPhaseId != null ? String(p.startAfterPhaseId) : 'project_start';
      const startAfterOrder = after === 'project_start'
        ? null
        : (() => { const idx = phases.findIndex((q: any) => String(q.phaseId) === after); return idx === -1 ? null : idx; })();
      return {
        etude_id: etudeId,
        nom: p.name,
        ordre: i,
        semaine_debut: startWeeks[i],
        duree_semaines: Number(p.dureeSemaines || 1),
        start_after_order: startAfterOrder,
        objectifs: p.objectifs,
        methodologie: p.methodologie,
        contraintes: p.contraintes,
        intervenants_count: Number(p.intervenantsCount || 1),
        intervenants_niveau: p.intervenantsNiveau,
        jeh_count: Number(p.intervenantsCount || p.jehCount || 1),
        jeh_price: Number(p.jehPrice || 100),
      };
    });
    await supabase.from('echeancier_blocs').insert(blocs);
  }

  return etudeId;
}

// --- LECTURE ----------------------------------------------------------------

const PROPALE_SELECT =
  '*, etude_propale(*), echeancier_blocs(*), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email, portable)';

/** Charge une proposition par son numero et la renvoie au format du formulaire. */
export async function loadPropale(supabase: SupabaseClient, numero: string): Promise<any | null> {
  const { data } = await supabase.from('etudes').select(PROPALE_SELECT).eq('numero', numero).maybeSingle();
  if (!data) return null;
  return mapEtudeToForm(data);
}

/** Liste toutes les propositions (format dashboard). */
export async function listPropales(supabase: SupabaseClient): Promise<any[]> {
  const { data } = await supabase
    .from('etudes')
    .select(PROPALE_SELECT)
    .eq('statut', 'prospect')
    .order('created_at', { ascending: false });
  if (!data) return [];
  return (data as any[]).map(mapEtudeToDashboard);
}

function sortedBlocs(row: any): any[] {
  return (row.echeancier_blocs || []).slice().sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

function blocToPhase(b: any, blocs: any[]): any {
  const startAfter = b.start_after_order == null
    ? 'project_start'
    : (blocs.find((x) => x.ordre === b.start_after_order)?.id || 'project_start');
  return {
    phaseId: b.id,
    name: b.nom,
    objectifs: b.objectifs || '',
    methodologie: b.methodologie || '',
    contraintes: b.contraintes || '',
    dureeSemaines: b.duree_semaines || 1,
    startAfterPhaseId: startAfter,
    intervenantsCount: b.intervenants_count ?? 1,
    intervenantsNiveau: b.intervenants_niveau || 'L3',
    jehCount: b.jeh_count ?? 1,
    jehPrice: b.jeh_price ?? 100,
  };
}

function mapEtudeToForm(row: any): any {
  const ep = row.etude_propale || {};
  const blocs = sortedBlocs(row);
  return {
    id: row.numero,
    cdpId: row.suiveur_id,
    clientId: row.client_id || '',
    clientName: ep.client_company || '',
    isAutoentrepreneur: !!ep.is_autoentrepreneur,
    clientCivilite: ep.client_civilite || 'M.',
    clientFirstName: ep.client_first_name || '',
    clientLastName: ep.client_last_name || '',
    clientEmail: ep.client_email || '',
    clientPhone: ep.client_phone || '',
    studyType: ep.study_type || row.nom,
    contextSituation: ep.contexte_situation || '',
    contextIntervention: ep.contexte_intervention || '',
    contextEnjeu: ep.contexte_enjeu || '',
    cdcObjectifs: ep.cdc_objectifs || '',
    cdcContraintes: ep.cdc_contraintes || '',
    cdcLivrables: ep.cdc_livrables || '',
    suiviJehCount: ep.suivi_jeh_count ?? 1,
    suiviJehPrice: ep.suivi_jeh_price ?? 200,
    globalFraisAnnexes: ep.global_frais_annexes ?? 0,
    date: row.date_debut,
    totalHT: ep.total_ht ?? row.budget_ht ?? 0,
    totalTTC: ep.total_ttc ?? 0,
    phases: blocs.map((b) => blocToPhase(b, blocs)),
  };
}

function mapEtudeToDashboard(row: any): any {
  const ep = row.etude_propale || {};
  const blocs = sortedBlocs(row);
  const cdp = row.suiveur;
  return {
    id: row.numero,
    cdpId: row.suiveur_id,
    cdpName: cdp ? `${cdp.prenom} ${cdp.nom}` : '',
    clientName: ep.client_company || '',
    studyType: ep.study_type || row.nom,
    date: row.date_debut,
    totalHT: ep.total_ht ?? row.budget_ht ?? 0,
    totalTTC: ep.total_ttc ?? 0,
    status: ep.propale_statut || 'envoyée',
    phases: blocs.map((b) => ({ name: b.nom, dureeSemaines: b.duree_semaines })),
  };
}

/** Met à jour uniquement le statut commercial d'une proposition. */
export async function updatePropaleStatut(supabase: SupabaseClient, numero: string, statut: string) {
  const { data } = await supabase.from('etudes').select('id').eq('numero', numero).maybeSingle();
  if (!data) return;
  await supabase.from('etude_propale').update({ propale_statut: statut }).eq('etude_id', (data as any).id);
}

/** Supprime une proposition (cascade sur etude_propale + echeancier_blocs). */
export async function deletePropale(supabase: SupabaseClient, numero: string) {
  await supabase.from('etudes').delete().eq('numero', numero);
}
