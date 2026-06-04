"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Calendar, Briefcase, Plus, Trash2, FileText, Settings, Download, Users, Calculator, FileSignature, Save } from 'lucide-react';
import { studyTypes } from '../data/mockDB';
import phasesJson from '../../local_db/phases.json';
import { getProposalMembers, getProposal, saveProposal } from '@/lib/actions/propositions';
import { getParametres, getMargesRecommandees } from '@/lib/actions/parametres';
import { getPhasesDefaut } from '@/lib/actions/phases';

// Catalogue de phases utilisé par le formulaire (forme normalisée).
type PhaseCatalogue = {
  id: number;
  name: string;
  objectifs: string;
  methodologie: string;
  contraintes: string;
  dureeSemaines: number;
  intervenantsCount: number;
  jehPrice: number;
};

// Fallback : le JSON local, si la table phases_defaut n'est pas encore disponible.
const phasesFallback: PhaseCatalogue[] = (phasesJson as any[]).map((p) => ({
  id: p.id,
  name: p.name,
  objectifs: p.objectifs ?? '',
  methodologie: p.methodologie ?? '',
  contraintes: p.contraintes ?? '',
  dureeSemaines: p.dureeSemaines ?? 2,
  intervenantsCount: p.intervenantsCount ?? 3,
  jehPrice: p.jehPrice ?? 100,
}));
import { TAILLES_ENTREPRISE, type MargesMap } from '@/lib/proposals-constants';
import { computeBudget, DEFAULT_MODALITES } from '@/lib/budget/compute';
import { BudgetSheet } from '@/components/budget/BudgetSheet';

// --- COULEURS GANTT (identiques à la page Étude) ---
const GANTT_COLORS = [
  "#00236f", "#2563eb", "#0891b2", "#059669", "#65a30d",
  "#d97706", "#dc2626", "#db2777", "#7c3aed", "#475569",
];

// --- UTILS POUR GÉNÉRER L'ID ---
function generatePropaleId(initials: string) {
  const code = initials || 'XXX';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
  return `${code}-${dateStr}-${timeStr}`;
}

// --- UTILS POUR L'ÉCHÉANCIER ---
function getNextMonday(date: Date | string) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 1) return d;
  const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
  return new Date(d.setDate(diff));
}

function addWeeks(date: Date, weeks: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7 - 3); // Finit un vendredi
  return d;
}

// --- COMPOSANT INPUT RAPIDE ---
const FastNumberInput = ({ value, onChange, min = 0, className = "" }: any) => {
  const [val, setVal] = useState(value);
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => { setVal(value) }, [value]);

  const handleChange = (newVal: number) => {
    if (isNaN(newVal)) newVal = min;
    if (newVal < min) newVal = min;
    setVal(newVal);
    onChange(newVal);
  }

  const startHold = (direction: number) => {
    handleChange(Number(val) + direction);
    let speed = 1;
    let ticks = 0;

    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        ticks++;
        if (ticks > 5) speed = 5;
        if (ticks > 15) speed = 10;
        setVal((prev: any) => {
          const nv = Number(prev) + (direction * speed);
          const finalVal = nv < min ? min : nv;
          onChange(finalVal);
          return finalVal;
        });
      }, 100);
    }, 400);
  };

  const stopHold = () => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
  };

  return (
    <div className={`flex items-stretch border border-slate-300 rounded-md overflow-hidden bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${className}`}>
      <button type="button" onMouseDown={() => startHold(-1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={() => startHold(-1)} onTouchEnd={stopHold} className="w-8 flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-600 font-black text-lg border-r border-slate-300 transition-colors select-none">-</button>
      <input type="number" value={val} onChange={(e) => handleChange(Number(e.target.value))} className="flex-1 w-full text-center focus:outline-none appearance-none hide-arrows py-1.5 font-bold text-slate-800" min={min} style={{ MozAppearance: 'textfield' }} />
      <button type="button" onMouseDown={() => startHold(1)} onMouseUp={stopHold} onMouseLeave={stopHold} onTouchStart={() => startHold(1)} onTouchEnd={stopHold} className="w-8 flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-600 font-black text-lg border-l border-slate-300 transition-colors select-none">+</button>
    </div>
  )
}

// === GANTT ÉDITABLE (calqué sur la page Étude) ===
// Les barres sont positionnées sur semaineDebut/dureeSemaines et déplaçables /
// redimensionnables à la souris ; toute modification remonte dans le formulaire.
const GanttChart = ({ phases, projectMonday, nbWeeks, onChange, formatDate, showPvri }: any) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<any>(null);

  // Semaine médiane de l'étude = point de versement PVRI intermédiaire
  const pvriMidWeek: number | null = showPvri && phases.length > 0
    ? (() => {
        const maxEnd = Math.max(...phases.map((p: any) => (p.semaineDebut || 1) + (p.dureeSemaines || 1) - 1));
        return Math.round((1 + maxEnd) / 2);
      })()
    : null;

  const weekStartDate = (semaine: number) => {
    const d = new Date(projectMonday);
    d.setDate(d.getDate() + (semaine - 1) * 7);
    return d;
  };

  const beginDrag = (e: React.MouseEvent, index: number, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const pxPerWeek = track.getBoundingClientRect().width / nbWeeks;
    dragRef.current = {
      index,
      mode,
      startX: e.clientX,
      startSemaine: phases[index].semaineDebut || 1,
      startDuree: phases[index].dureeSemaines || 1,
      pxPerWeek,
    };

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = Math.round((ev.clientX - drag.startX) / drag.pxPerWeek);
      if (drag.mode === 'move') {
        const maxStart = Math.max(1, nbWeeks - drag.startDuree + 1);
        const newSemaine = Math.max(1, Math.min(maxStart, drag.startSemaine + delta));
        onChange(drag.index, { semaineDebut: newSemaine });
      } else {
        const maxDuree = nbWeeks - drag.startSemaine + 1;
        const newDuree = Math.max(1, Math.min(maxDuree, drag.startDuree + delta));
        onChange(drag.index, { dureeSemaines: newDuree });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* En-têtes des semaines */}
        <div className="flex border-b border-slate-200 mb-2">
          <div className="w-44 shrink-0" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${nbWeeks}, minmax(0, 1fr))` }}>
            {Array.from({ length: nbWeeks }).map((_, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1 border-l border-slate-100">
                S{i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Marqueur PVRI — goutte d'eau positionnée à mi-étude */}
        {showPvri && pvriMidWeek && (
          <div className="flex items-end mb-1">
            <div className="w-44 shrink-0" />
            <div className="flex-1 relative h-11">
              <div
                className="absolute bottom-0 flex flex-col items-center z-10"
                style={{
                  left: `${((pvriMidWeek - 0.5) / nbWeeks) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
                title="Procès-verbal de règlement intermédiaire"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shadow-md border-2 border-white">
                  <span className="text-white font-bold leading-none text-center" style={{ fontSize: 7 }}>PVRI</span>
                </div>
                {/* Pointe de la goutte d'eau */}
                <div style={{
                  width: 0, height: 0, marginTop: -1,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '8px solid #059669',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Lignes de phases */}
        <div className="space-y-2">
          {phases.map((phase: any, index: number) => {
            const debut = phase.semaineDebut || 1;
            const duree = phase.dureeSemaines || 1;
            const start = weekStartDate(debut);
            const end = addWeeks(start, duree);
            return (
              <div key={phase.phaseId ?? index} className="flex items-center">
                <div className="w-44 shrink-0 pr-3">
                  <div className="text-xs font-bold text-slate-700 truncate">{index + 1}. {phase.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatDate(start)} → {formatDate(end)}</div>
                </div>
                <div ref={index === 0 ? trackRef : undefined} className="flex-1 relative h-9 bg-slate-50 rounded border border-slate-100">
                  <div
                    onMouseDown={(e) => beginDrag(e, index, 'move')}
                    className="absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing shadow-sm flex items-center px-2 group"
                    style={{
                      left: `${((debut - 1) / nbWeeks) * 100}%`,
                      width: `${(duree / nbWeeks) * 100}%`,
                      minWidth: 36,
                      backgroundColor: GANTT_COLORS[index % GANTT_COLORS.length],
                    }}
                    title={`${phase.name} — S${debut} → S${debut + duree - 1}`}
                  >
                    <span className="text-[10px] font-bold text-white truncate select-none">{duree} sem.</span>
                    {/* Poignée de redimensionnement */}
                    <div
                      onMouseDown={(e) => beginDrag(e, index, 'resize')}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-md bg-black/10 group-hover:bg-black/25"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function ProposalForm() {
  const router = useRouter();
  const [isIdEdited, setIsIdEdited] = useState(false);
  const isIdEditedRef = useRef(false);
  const [members, setMembers] = useState<{ id: string; prenom: string; nom: string; email: string }[]>([]);
  const [nbWeeks, setNbWeeks] = useState(12);
  const [isSaving, setIsSaving] = useState(false);
  const [defaultJehPrice, setDefaultJehPrice] = useState(100);
  const [marges, setMarges] = useState<MargesMap>({});
  const [phasesDB, setPhasesDB] = useState<PhaseCatalogue[]>(phasesFallback);
  const [tvaRate, setTvaRate] = useState(20); // % — piloté depuis parametres.tva_rate

  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      propaleId: '',
      cdpSelect: '',
      cdpCustom: '',
      companyName: '',
      tailleEntreprise: 'PME',
      provenance: 'Prospection',
      clientCivilite: 'M.',
      clientFirstName: '',
      clientLastName: '',
      clientEmail: '',
      clientPhone: '',
      studyTypeSelect: '',
      studyTypeCustom: '',
      contextSituation: '',
      contextIntervention: '',
      contextEnjeu: '',
      cdcObjectifs: '',
      cdcContraintes: '',
      cdcLivrables: '',
      globalFraisAnnexes: 0,
      fraisDossier: 0,
      margeJe: 0,
      paiementType: 'standard' as 'standard' | 'pvri',
      paiementVersements: [
        { label: "Acompte à la signature de la convention d'étude", pct: 60 },
        { label: "Solde au procès-verbal de recette final", pct: 40 },
      ] as { label: string; pct: number }[],
      suiviJehCount: 1,
      suiviJehPrice: 100,
      projectStartDate: getNextMonday(new Date()).toISOString().slice(0, 10),
      phases: [] as {
        phaseId: string | number,
        name: string,
        objectifs: string,
        methodologie: string,
        contraintes: string,
        dureeSemaines: number,
        semaineDebut: number,
        intervenantsCount: number,
        intervenantsNiveau: string,
        jehCount: number,
        jehPrice: number
      }[]
    }
  });

  const { fields: phaseFields, append, remove: removePhase } = useFieldArray({
    control,
    name: "phases"
  });

  const {
    fields: versementFields,
    append: appendVersement,
    remove: removeVersement,
    replace: replaceVersements,
  } = useFieldArray({ control, name: "paiementVersements" as any });

  const watchCdpSelect = watch('cdpSelect');
  const watchCdpCustom = watch('cdpCustom');
  const watchStudyType = watch('studyTypeSelect');
  const watchPhases = watch('phases');
  const watchStartDate = watch('projectStartDate');
  const watchGlobalFraisAnnexes = watch('globalFraisAnnexes');
  const watchMargeJe = watch('margeJe' as any);
  const watchFraisDossier = watch('fraisDossier' as any);
  const watchPaiementType = watch('paiementType' as any);
  const watchVersements = watch('paiementVersements' as any) as { label: string; pct: number }[];
  const watchTaille = watch('tailleEntreprise' as any);
  const tailleTouchedRef = useRef(false);

  // CHARGEMENT DES MEMBRES AJC (CDP)
  useEffect(() => {
    getProposalMembers().then(res => {
      if (res && 'data' in res && res.data) setMembers(res.data as any);
    });
  }, []);

  // PRÉ-REMPLISSAGE DEPUIS LES PARAMÈTRES DE PILOTAGE (Contrôle des données)
  // Uniquement pour une NOUVELLE propale (pas en édition d'une existante).
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id')) return;
    getParametres().then(res => {
      const p = res?.data;
      if (!p) return;
      const num = (v?: string) => (v !== undefined && v !== '' ? Number(v) : undefined);
      const jeh = num(p['prix_jeh_moyen']);
      if (jeh !== undefined) setDefaultJehPrice(jeh);
      const tva = num(p['tva_rate']);
      if (tva !== undefined) setTvaRate(tva);
      const suivi = num(p['prix_suivi_jeh_moyen']);
      const frais = num(p['frais_dossier_moyen']);
      if (suivi !== undefined) setValue('suiviJehPrice', suivi);
      if (frais !== undefined) setValue('fraisDossier', frais);
      // La marge par défaut vient de la taille (PME) via marges_recommandees ;
      // on tombe sur marge_je_moyenne_pct seulement si la table n'a rien.
      if (p['propale_context_situation_default']) setValue('contextSituation', p['propale_context_situation_default']);
      if (p['propale_context_intervention_default']) setValue('contextIntervention', p['propale_context_intervention_default']);
      if (p['propale_context_enjeu_default']) setValue('contextEnjeu', p['propale_context_enjeu_default']);
      if (p['propale_cdc_objectifs_default']) setValue('cdcObjectifs', p['propale_cdc_objectifs_default']);
      if (p['propale_cdc_contraintes_default']) setValue('cdcContraintes', p['propale_cdc_contraintes_default']);
      if (p['propale_cdc_livrables_default']) setValue('cdcLivrables', p['propale_cdc_livrables_default']);
    });
  }, [setValue]);

  // CHARGEMENT DES MARGES RECOMMANDÉES (par taille d'entreprise)
  useEffect(() => {
    getMargesRecommandees().then(res => {
      if (res?.data) setMarges(res.data);
    });
  }, []);

  // CHARGEMENT DES PHASES PAR DÉFAUT depuis la table phases_defaut (pilotables).
  // Fallback automatique sur le JSON local si la table est vide / indisponible.
  useEffect(() => {
    getPhasesDefaut().then(res => {
      if (res?.data && res.data.length > 0) {
        setPhasesDB(res.data.map((p) => ({
          id: p.id,
          name: p.nom,
          objectifs: p.objectifs ?? '',
          methodologie: p.methodologie ?? '',
          contraintes: p.contraintes ?? '',
          dureeSemaines: p.duree_semaines ?? 2,
          intervenantsCount: p.intervenants_defaut ?? 3,
          jehPrice: Number(p.jeh_defaut) ?? 100,
        })));
      }
    });
  }, []);

  // Quand l'utilisateur change la taille de structure, on pré-règle la marge JE
  // sur la marge recommandée correspondante (sans écraser une saisie manuelle au 1er rendu).
  useEffect(() => {
    if (!tailleTouchedRef.current) return;
    const m = marges[watchTaille as string];
    if (m !== undefined) setValue('margeJe' as any, m);
  }, [watchTaille, marges, setValue]);

  // Applique la marge recommandée par défaut (PME) une fois les marges chargées,
  // uniquement pour une NOUVELLE propale et tant que l'utilisateur n'a pas touché la taille.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id')) return;
    if (tailleTouchedRef.current) return;
    const m = marges[watchTaille as string];
    if (m !== undefined) setValue('margeJe' as any, m);
  }, [marges, watchTaille, setValue]);

  // CHARGEMENT D'UNE PROPALE EXISTANTE (édition)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    getProposal(id).then(res => {
      if (!res || 'error' in res || !('data' in res) || !res.data) return;
      const data: any = res.data;

      setIsIdEdited(true);
      isIdEditedRef.current = true;
      setValue('propaleId', data.id);
      setValue('companyName', data.client_company || '');
      setValue('tailleEntreprise', data.taille_entreprise || 'PME');
      setValue('provenance', data.provenance || 'Prospection');
      setValue('cdpSelect', data.cdp_id ? String(data.cdp_id) : (data.cdp_custom ? 'autre' : ''));
      setValue('cdpCustom', data.cdp_custom || '');
      setValue('clientCivilite', data.client_civilite || 'M.');
      setValue('clientFirstName', data.client_first_name || '');
      setValue('clientLastName', data.client_last_name || '');
      setValue('clientEmail', data.client_email || '');
      setValue('clientPhone', data.client_phone || '');
      setValue('studyTypeSelect', studyTypes.includes(data.study_type) ? data.study_type : 'autre');
      if (!studyTypes.includes(data.study_type)) setValue('studyTypeCustom', data.study_type || '');
      setValue('contextSituation', data.context_situation || '');
      setValue('contextIntervention', data.context_intervention || '');
      setValue('contextEnjeu', data.context_enjeu || '');
      setValue('cdcObjectifs', data.cdc_objectifs || '');
      setValue('cdcContraintes', data.cdc_contraintes || '');
      setValue('cdcLivrables', data.cdc_livrables || '');
      setValue('suiviJehCount', data.suivi_jeh_count ?? 1);
      setValue('suiviJehPrice', data.suivi_jeh_price ?? 100);
      setValue('globalFraisAnnexes', data.global_frais_annexes ?? 0);
      setValue('fraisDossier', (data as any).frais_dossier ?? 0);
      setValue('margeJe', (data as any).marge_je ?? 0);
      if (data.start_date) setValue('projectStartDate', getNextMonday(data.start_date).toISOString().slice(0, 10));

      // Modalités de règlement (si déjà enregistrées sur la propale)
      const modalites = (data as any).paiement_modalites;
      if (modalites && Array.isArray(modalites.versements) && modalites.versements.length > 0) {
        setValue('paiementType' as any, modalites.type === 'pvri' ? 'pvri' : 'standard');
        replaceVersements(
          modalites.versements.map((v: any) => ({ label: v.label || 'Versement', pct: Number(v.pct || 0) }))
        );
      }

      const phases = (data.proposal_phases || []).slice().sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      if (phases.length > 0) {
        removePhase();
        let cursor = 1;
        phases.forEach((p: any, i: number) => {
          const duree = p.duree_semaines || 1;
          const debut = p.semaine_debut > 0 ? p.semaine_debut : cursor;
          cursor = debut + duree;
          append({
            phaseId: p.id || Date.now() + i,
            name: p.name,
            objectifs: p.objectifs || '',
            methodologie: p.methodologie || '',
            contraintes: p.contraintes || '',
            dureeSemaines: duree,
            semaineDebut: debut,
            intervenantsCount: p.intervenants_count || 1,
            intervenantsNiveau: p.intervenants_niveau || 'L3',
            jehCount: p.jeh_count || 1,
            jehPrice: p.jeh_price || 100
          });
        });
      }
    });
  }, [setValue, append, removePhase, replaceVersements]);

  // AUTO GÉNÉRATION DE L'ID À PARTIR DU MEMBRE CHOISI
  useEffect(() => {
    if (isIdEditedRef.current) return;
    let initials = 'XXX';
    if (watchCdpSelect === 'autre' && watchCdpCustom) {
      initials = watchCdpCustom.substring(0, 3).toUpperCase();
    } else if (watchCdpSelect && watchCdpSelect !== 'autre') {
      const m = members.find(c => c.id === watchCdpSelect);
      if (m) initials = ((m.prenom?.charAt(0) || '') + (m.nom?.charAt(0) || '')).toUpperCase() || 'XXX';
    }
    setValue('propaleId', generatePropaleId(initials));
  }, [watchCdpSelect, watchCdpCustom, members, setValue]);

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('propaleId', e.target.value);
    if (e.target.value === '') {
      setIsIdEdited(false);
      isIdEditedRef.current = false;
    } else {
      setIsIdEdited(true);
      isIdEditedRef.current = true;
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const nextMonday = getNextMonday(e.target.value);
    setValue('projectStartDate', nextMonday.toISOString().slice(0, 10));
  };

  // Semaine de départ par défaut = juste après la dernière phase
  const nextFreeWeek = () => {
    if (!watchPhases || watchPhases.length === 0) return 1;
    return Math.max(...watchPhases.map(p => (p.semaineDebut || 1) + (p.dureeSemaines || 1))) ;
  };

  const handleAddPhase = (phaseId: number | 'custom') => {
    const debut = nextFreeWeek();
    if (phaseId === 'custom') {
      append({
        phaseId: Date.now(),
        name: "Nouvelle phase",
        objectifs: "",
        methodologie: "",
        contraintes: "",
        dureeSemaines: 2,
        semaineDebut: debut,
        intervenantsCount: 3,
        intervenantsNiveau: 'L3',
        jehCount: 3,
        jehPrice: defaultJehPrice,
      });
    } else {
      const phaseData = phasesDB.find(p => p.id === phaseId);
      if (phaseData) {
        append({
          phaseId: phaseData.id + Date.now(),
          name: phaseData.name,
          objectifs: phaseData.objectifs,
          methodologie: phaseData.methodologie,
          contraintes: phaseData.contraintes || "",
          dureeSemaines: phaseData.dureeSemaines || 2,
          semaineDebut: debut,
          intervenantsCount: phaseData.intervenantsCount || 3,
          intervenantsNiveau: 'L3',
          jehCount: phaseData.intervenantsCount || 3,
          jehPrice: phaseData.jehPrice || defaultJehPrice,
        });
      }
    }
  };

  // Maj depuis le Gantt (déplacement / redimensionnement)
  const handleGanttChange = (index: number, patch: { semaineDebut?: number; dureeSemaines?: number }) => {
    if (patch.semaineDebut !== undefined) setValue(`phases.${index}.semaineDebut`, patch.semaineDebut);
    if (patch.dureeSemaines !== undefined) setValue(`phases.${index}.dureeSemaines`, patch.dureeSemaines);
  };

  const buildPayload = (data: any) => {
    let totalPhasesJeh = 0;
    data.phases.forEach((p: any) => { totalPhasesJeh += (Number(p.jehCount || 0) * Number(p.jehPrice || 0)); });
    const suiviTotal = Number(data.suiviJehCount || 0) * Number(data.suiviJehPrice || 0);
    // Marge JE = grossissement du SDP (mêmes règles que calculateBudget) :
    // appliquée au SDP des phases ET au suivi de projet.
    const margePct = Number((data as any).margeJe || 0);
    const margeBase = totalPhasesJeh + suiviTotal;
    const margeJe = margePct > 0
      ? Math.ceil(margeBase / (1 - margePct / 100)) - margeBase
      : 0;
    let totalHT = totalPhasesJeh;
    totalHT += suiviTotal;
    totalHT += margeJe;
    totalHT += Number((data as any).fraisDossier || 0);
    totalHT += Number(data.globalFraisAnnexes || 0);
    const totalTTC = totalHT * (1 + tvaRate / 100);

    return {
      id: data.propaleId,
      cdp_id: data.cdpSelect && data.cdpSelect !== 'autre' ? data.cdpSelect : null,
      cdp_custom: data.cdpSelect === 'autre' ? (data.cdpCustom || null) : null,
      client_company: data.companyName,
      taille_entreprise: data.tailleEntreprise,
      provenance: data.provenance,
      client_civilite: data.clientCivilite,
      client_first_name: data.clientFirstName,
      client_last_name: data.clientLastName,
      client_email: data.clientEmail,
      client_phone: data.clientPhone,
      study_type: data.studyTypeSelect !== 'autre' ? data.studyTypeSelect : data.studyTypeCustom,
      context_situation: data.contextSituation,
      context_intervention: data.contextIntervention,
      context_enjeu: data.contextEnjeu,
      cdc_objectifs: data.cdcObjectifs,
      cdc_contraintes: data.cdcContraintes,
      cdc_livrables: data.cdcLivrables,
      suivi_jeh_count: Number(data.suiviJehCount || 0),
      suivi_jeh_price: Number(data.suiviJehPrice || 0),
      global_frais_annexes: Number(data.globalFraisAnnexes || 0),
      frais_dossier: Number((data as any).fraisDossier || 0),
      marge_je: Number((data as any).margeJe || 0),
      start_date: data.projectStartDate,
      total_ht: totalHT,
      total_ttc: totalTTC,
      paiement_modalites: {
        type: (data.paiementType || 'standard') as 'standard' | 'pvri',
        versements: (data.paiementVersements || []).map((v: any) => ({
          label: v.label,
          pct: Number(v.pct || 0),
        })),
      },
      phases: data.phases.map((p: any) => ({
        name: p.name,
        objectifs: p.objectifs,
        methodologie: p.methodologie,
        contraintes: p.contraintes,
        duree_semaines: Number(p.dureeSemaines || 1),
        semaine_debut: Number(p.semaineDebut || 1),
        intervenants_count: Number(p.intervenantsCount || 1),
        intervenants_niveau: p.intervenantsNiveau,
        jeh_count: Number(p.jehCount || p.intervenantsCount || 1),
        jeh_price: Number(p.jehPrice || 100)
      }))
    };
  };

  const onSubmit = async (data: any, action: 'save' | 'generate') => {
    setIsSaving(true);
    const payload = buildPayload(data);
    const res = await saveProposal(payload as any);
    if (res && 'error' in res && res.error) {
      setIsSaving(false);
      alert("❌ Erreur d'enregistrement : " + res.error);
      return;
    }

    if (action === 'save') {
      setIsSaving(false);
      router.push('/prospection');
      return;
    }

    // Génération du PowerPoint
    try {
      const cdpInfo: any = {};
      if (data.cdpSelect === 'autre') {
        const nameParts = (data.cdpCustom || '').trim().split(/\s+/);
        cdpInfo.cdp_civilite = 'M.';
        cdpInfo.cdp_first_name = nameParts[0] || 'Chef de Projet';
        cdpInfo.cdp_last_name = nameParts.slice(1).join(' ') || '';
        cdpInfo.cdp_initials = (cdpInfo.cdp_first_name.charAt(0) + (cdpInfo.cdp_last_name.charAt(0) || '')).toUpperCase() || 'CP';
        cdpInfo.cdp_email = `${cdpInfo.cdp_first_name.toLowerCase()}.${(cdpInfo.cdp_last_name || '').toLowerCase()}@ajc-mail.com`;
        cdpInfo.cdp_phone = '';
      } else if (data.cdpSelect) {
        const m = members.find(c => c.id === data.cdpSelect);
        if (m) {
          cdpInfo.cdp_civilite = 'M.';
          cdpInfo.cdp_first_name = m.prenom;
          cdpInfo.cdp_last_name = m.nom;
          cdpInfo.cdp_initials = ((m.prenom?.charAt(0) || '') + (m.nom?.charAt(0) || '')).toUpperCase();
          cdpInfo.cdp_email = m.email;
          cdpInfo.cdp_phone = '';
        }
      }

      const payloadForPpt = {
        ...payload,
        ...cdpInfo,
        tva_rate: tvaRate,
        phases: payload.phases,
      };

      const response = await fetch('/api/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForPpt)
      });

      if (!response.ok) {
        const error = await response.json();
        setIsSaving(false);
        alert("❌ Erreur de génération : " + error.error);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposition_${data.companyName || 'AJC'}.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setIsSaving(false);
      router.push('/prospection');
    } catch (err) {
      setIsSaving(false);
      alert("❌ Erreur de réseau ou de génération.");
    }
  };

  const calculateBudget = () => {
    let totalPhasesJeh = 0;
    watchPhases.forEach(p => {
      totalPhasesJeh += (Number(p.jehCount || 0) * Number(p.jehPrice || 100));
    });
    const suiviTotal = (Number(watch('suiviJehCount') || 0) * Number(watch('suiviJehPrice') || 0));
    // Marge JE = grossissement du SDP (prix de vente), pas une simple majoration :
    //   prix_avec_marge = ROUNDUP(SDP / (1 - marge%/100))  →  margeJe = prix_avec_marge - SDP
    //   ex. SDP=100, marge=38% → ceil(100/0.62)=162 → margeJe=62
    // La marge s'applique au SDP des phases ET au suivi de projet.
    const margePct = Number(watchMargeJe || 0);
    const margeBase = totalPhasesJeh + suiviTotal;
    const margeJe = margePct > 0
      ? Math.ceil(margeBase / (1 - margePct / 100)) - margeBase
      : 0;
    const fraisDossier = Number(watchFraisDossier || 0);
    const fraisAnnexes = Number(watchGlobalFraisAnnexes || 0);
    const totalHT = totalPhasesJeh + suiviTotal + margeJe + fraisDossier + fraisAnnexes;
    const tva = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + tva;
    return { totalHT, tva, totalTTC, totalPhasesJeh, suiviTotal, margeJe, fraisDossier, fraisAnnexes };
  };
  const budget = calculateBudget();

  // Récap « façon Excel » (même calcul que la modale trésorerie et l'export .xlsx)
  const budgetBreakdown = computeBudget({
    phases: watchPhases.map((p) => ({
      name: p.name,
      jehCount: Number(p.jehCount || 0),
      jehPrice: Number(p.jehPrice || 0),
    })),
    suiviJehCount: Number(watch('suiviJehCount') || 0),
    suiviJehPrice: Number(watch('suiviJehPrice') || 0),
    margeJePct: Number(watchMargeJe || 0),
    fraisDossier: Number(watchFraisDossier || 0),
    globalFraisAnnexes: Number(watchGlobalFraisAnnexes || 0),
    tvaPct: tvaRate,
    paiementModalites: {
      type: (watchPaiementType || 'standard') as 'standard' | 'pvri',
      versements: (watchVersements || []).map((v) => ({ label: v.label, pct: Number(v.pct || 0) })),
    },
  });

  // Somme des % des versements (doit faire 100 %).
  const versementsPctSum = (watchVersements || []).reduce((s, v) => s + Number(v.pct || 0), 0);

  // Applique un préréglage de modalités (remplace la liste des versements).
  const applyModalitesPreset = (type: 'standard' | 'pvri') => {
    setValue('paiementType' as any, type);
    replaceVersements(DEFAULT_MODALITES[type].map((v) => ({ label: v.label, pct: v.pct })));
  };

  // Bornes du Gantt : on grossit automatiquement si une phase déborde
  const projectMonday = getNextMonday(watchStartDate);
  const maxWeek = watchPhases.length > 0
    ? Math.max(...watchPhases.map(p => (p.semaineDebut || 1) + (p.dureeSemaines || 1) - 1))
    : 0;
  const ganttWeeks = Math.max(nbWeeks, maxWeek);
  const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12 pb-24">
      <style dangerouslySetInnerHTML={{__html: `
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}} />

      {/* 1. INFOS GENERALES */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="text-blue-400" /> 1. Informations Générales
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col sm:flex-row sm:items-center gap-4">
            <label className="text-sm font-semibold text-blue-900 min-w-max">ID de Proposition :</label>
            <input type="text" value={watch('propaleId')} onChange={handleIdChange}
              className="w-full sm:max-w-sm rounded-md border border-blue-200 px-3 py-2 bg-white text-blue-900 font-mono focus:ring-2 focus:ring-blue-500 outline-none placeholder:italic placeholder:text-slate-400"
              placeholder="Modifiable manuellement..." />
            {isIdEdited && <span className="text-xs text-blue-700">Modifié manuellement ou chargé</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b pb-2">Client</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entreprise</label>
                <input type="text" {...register('companyName')} className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom de l'entreprise (ou de la personne)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Taille de la structure</label>
                <select
                  {...register('tailleEntreprise')}
                  onChange={(e) => { tailleTouchedRef.current = true; setValue('tailleEntreprise', e.target.value as any); }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white capitalize"
                >
                  {TAILLES_ENTREPRISE.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Ajuste automatiquement la marge JE recommandée
                  {marges[watchTaille as string] !== undefined ? ` (${marges[watchTaille as string]} %)` : ''}.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provenance de l'étude</label>
                <select
                  {...register('provenance')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Prospection">Prospection</option>
                  <option value="Appel d'offres">Appel d'offres</option>
                  <option value="Contact spontané">Contact spontané</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Principal</label>
                <div className="flex gap-2">
                  <select {...register('clientCivilite')} className="w-24 rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                  <input type="text" {...register('clientFirstName')} className="w-1/2 rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Prénom" />
                  <input type="text" {...register('clientLastName')} className="w-1/2 rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b pb-2">Équipe Projet (Audencia Junior Conseil)</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chef de Projet (CDP)</label>
                <select {...register('cdpSelect')} className="w-full rounded-md border border-slate-300 px-3 py-2 mb-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Sélectionner un membre AJC...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                  ))}
                  <option value="autre">Autre (Saisir manuellement)...</option>
                </select>
                {watchCdpSelect === 'autre' && (
                  <input type="text" {...register('cdpCustom')} placeholder="Saisir le nom du CDP..." className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type d'Étude</label>
                <select {...register('studyTypeSelect')} className="w-full rounded-md border border-slate-300 px-3 py-2 mb-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">Sélectionner un type...</option>
                  {studyTypes.map((type, idx) => (
                    <option key={idx} value={type}>{type}</option>
                  ))}
                  <option value="autre">Autre type d'étude...</option>
                </select>
                {watchStudyType === 'autre' && (
                  <input type="text" {...register('studyTypeCustom')} placeholder="Saisir le type d'étude..." className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTEXTE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSignature className="text-blue-400" /> 2. Contexte
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Votre situation</label>
            <textarea {...register('contextSituation')} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Description de la situation..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notre domaine d'intervention</label>
            <textarea {...register('contextIntervention')} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Description de l'intervention d'Audencia Junior Conseil..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">L'enjeu</label>
            <textarea {...register('contextEnjeu')} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Description de l'enjeu principal..." />
          </div>
        </div>
      </div>

      {/* 3. PHASES ET DÉTAILS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-blue-400" /> 3. Phases et Détails des Phases
          </h2>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
            <span className="text-sm font-medium text-blue-900 block mb-3">Ajouter des phases à la proposition :</span>
            <div className="flex flex-wrap gap-2">
              {phasesDB.map(phase => (
                <button type="button" key={phase.id} onClick={() => handleAddPhase(phase.id)}
                  className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-1">
                  <Plus size={14} /> {phase.name}
                </button>
              ))}
              <button type="button" onClick={() => handleAddPhase('custom')}
                className="bg-slate-800 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-black transition-colors flex items-center gap-1 ml-auto">
                <Plus size={14} /> Autre (Nouvelle phase)
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {phaseFields.map((field, index) => (
              <div key={field.id} className="bg-white border border-slate-300 rounded-xl p-6 pb-16 shadow-sm relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-slate-100 gap-4">
                  <div className="flex items-center gap-3 w-full max-w-lg">
                    <div className="flex items-center justify-center bg-blue-100 text-blue-800 rounded-full w-8 h-8 font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <input type="text" {...register(`phases.${index}.name` as const)} className="font-bold text-lg text-slate-800 w-full border-none bg-transparent focus:ring-0 p-0" placeholder="Nom de la phase" />
                  </div>

                  <button type="button" onClick={() => removePhase(index)} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-50 p-2 rounded-md hover:bg-red-50 shrink-0">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Objectifs</label><textarea {...register(`phases.${index}.objectifs` as const)} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Méthodologie</label><textarea {...register(`phases.${index}.methodologie` as const)} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  </div>
                  <div className="space-y-4">
                    <div><label className="block text-sm font-semibold text-slate-700 mb-1">Contraintes spécifiques</label><textarea {...register(`phases.${index}.contraintes` as const)} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Limite d'engagement..." /></div>
                  </div>
                </div>

                {/* WIDGET DE DURÉE EN BAS À DROITE */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm text-xs">
                  <span className="font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-blue-600"/> Durée :
                  </span>
                  <Controller
                    name={`phases.${index}.dureeSemaines` as const}
                    control={control}
                    render={({ field }) => (
                      <FastNumberInput value={field.value} onChange={field.onChange} min={1} className="w-[85px] scale-90 origin-right" />
                    )}
                  />
                  <span className="font-bold text-slate-600">sem.</span>
                </div>
              </div>
            ))}
            {phaseFields.length === 0 && (
              <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 text-slate-500">
                <p className="font-medium text-lg text-slate-600">Aucune phase sélectionnée</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. INTERVENANTS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-blue-400" /> 4. Intervenants
          </h2>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-6">Allouez les ressources pour chaque phase.</p>
          <div className="space-y-4">
            {phaseFields.map((field, index) => (
              <div key={field.id} className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="font-bold text-slate-800 w-full sm:w-1/3">
                  <span className="text-blue-600 mr-2">{index + 1}.</span>{watchPhases[index]?.name}
                </div>
                <div className="flex gap-4 w-full sm:w-2/3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Nombre</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={watchPhases[index]?.intervenantsCount || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const currentPhase = watchPhases[index];
                        if (currentPhase.jehCount === currentPhase.intervenantsCount) {
                          setValue(`phases.${index}.jehCount`, val);
                        }
                        setValue(`phases.${index}.intervenantsCount`, val);
                      }}
                      className="w-24 rounded border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Niveau</label>
                    <select {...register(`phases.${index}.intervenantsNiveau` as const)} className="w-24 rounded border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 bg-white">
                      <option value="L3">L3</option>
                      <option value="M1">M1</option>
                      <option value="M2">M2</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {phaseFields.length === 0 && <div className="text-center py-8 text-slate-500">Veuillez d'abord sélectionner des phases.</div>}
          </div>
        </div>
      </div>

      {/* 5. CAHIER DES CHARGES */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-blue-400" /> 5. Cahier des Charges
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Objectifs globaux</label>
            <textarea {...register('cdcObjectifs')} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Contraintes globales</label>
            <textarea {...register('cdcContraintes')} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Livrables attendus</label>
            <textarea {...register('cdcLivrables')} className="w-full h-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </div>

      {/* 6. ÉCHÉANCIER (GANTT) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="text-blue-400" /> 6. Échéancier (Gantt)
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-300">Durée affichée :</label>
            <select
              value={nbWeeks}
              onChange={(e) => setNbWeeks(Number(e.target.value))}
              className="rounded-md border border-slate-600 bg-slate-800 text-white px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[4, 6, 8, 10, 12, 16, 20, 24, 30, 36, 52].map(w => (
                <option key={w} value={w}>{w} semaines</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-800 mb-2">Date de début de l'étude</label>
            <input
              type="date"
              value={watchStartDate}
              onChange={handleStartDateChange}
              className="w-full max-w-xs rounded-md border border-slate-300 px-4 py-2 font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          {phaseFields.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Ajoutez des phases pour générer l'échéancier.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-4">Glissez une barre pour la déplacer, ou tirez son bord droit pour ajuster sa durée. Les dates et le budget restent connectés aux phases.</p>
              <GanttChart
                phases={watchPhases}
                projectMonday={projectMonday}
                nbWeeks={ganttWeeks}
                onChange={handleGanttChange}
                formatDate={formatDate}
                showPvri={watchPaiementType === 'pvri'}
              />
            </>
          )}
        </div>
      </div>

      {/* 7. BUDGET */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator className="text-blue-400" /> 7. Budget
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">

            {/* Ligne automatique Suivi de projet */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-blue-50 rounded border border-blue-200 text-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
              <span className="font-bold text-blue-900 w-full sm:w-1/3 truncate pl-2">Suivi de projet (CDP)</span>
              <div className="flex gap-2 w-full sm:w-2/3 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-blue-700/70 mb-0.5">Nb JEH</label>
                  <Controller
                    name="suiviJehCount"
                    control={control}
                    render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-blue-700/70 mb-0.5">Prix (€)</label>
                  <Controller
                    name="suiviJehPrice"
                    control={control}
                    render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
                  />
                </div>
                <span className="font-bold text-blue-900 ml-auto mb-1.5">
                  {(Number(watch('suiviJehCount') || 0) * Number(watch('suiviJehPrice') || 0)).toLocaleString('fr-FR')} €
                </span>
              </div>
            </div>

            {/* Lignes des phases */}
            {phaseFields.map((field, index) => {
              const phase = watchPhases[index];
              const totalPhase = (Number(phase?.jehCount || 0) * Number(phase?.jehPrice || 0));
              return (
                <div key={field.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                  <span className="font-bold text-slate-700 w-full sm:w-1/3 truncate">{index + 1}. {phase?.name}</span>
                  <div className="flex gap-2 w-full sm:w-2/3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Nb JEH</label>
                      <Controller
                        name={`phases.${index}.jehCount` as const}
                        control={control}
                        render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Prix (€)</label>
                      <Controller
                        name={`phases.${index}.jehPrice` as const}
                        control={control}
                        render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={80} className="w-[120px]" />}
                      />
                    </div>
                    <span className="font-bold text-slate-800 ml-auto mb-1.5">{totalPhase.toLocaleString('fr-FR')} €</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            {/* Marge JE */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-amber-50 rounded border border-amber-200 text-sm">
              <div className="flex-1">
                <span className="font-bold text-amber-900">Marge JE (%)</span>
                <p className="text-xs text-amber-600 mt-0.5">Grossit le SDP des phases : ⌈SDP / (1 − marge%)⌉</p>
              </div>
              <div className="flex items-center gap-3">
                <Controller
                  name={"margeJe" as any}
                  control={control}
                  render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} max={100} className="w-[100px]" />}
                />
                <span className="font-bold text-amber-900 w-[100px] text-right">
                  + {budget.margeJe.toLocaleString('fr-FR')} €
                </span>
              </div>
            </div>

            {/* Frais de dossier */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-purple-50 rounded border border-purple-200 text-sm">
              <div className="flex-1">
                <span className="font-bold text-purple-900">Frais de dossier (€)</span>
                <p className="text-xs text-purple-600 mt-0.5">Montant fixe facturé à l'ouverture</p>
              </div>
              <div className="flex items-center gap-3">
                <Controller
                  name={"fraisDossier" as any}
                  control={control}
                  render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[100px]" />}
                />
                <span className="font-bold text-purple-900 w-[100px] text-right">
                  {budget.fraisDossier.toLocaleString('fr-FR')} €
                </span>
              </div>
            </div>

            {/* Frais annexes */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200 text-sm">
              <label className="font-bold text-slate-700">Frais Annexes Globaux (€)</label>
              <Controller
                name="globalFraisAnnexes"
                control={control}
                render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
              />
            </div>
          </div>

          {/* Modalités de règlement — case PVRI */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 bg-emerald-50 border border-emerald-200 rounded-lg w-fit">
            <input
              type="checkbox"
              checked={watchPaiementType === 'pvri'}
              onChange={(e) => applyModalitesPreset(e.target.checked ? 'pvri' : 'standard')}
              className="w-4 h-4 accent-emerald-600 cursor-pointer"
            />
            <span className="text-sm font-bold text-emerald-900">PVRI</span>
            <span className="text-xs text-emerald-700/80">
              Procès-verbal de règlement intermédiaire (3 versements : début · milieu · fin)
            </span>
          </label>

          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-slate-400 text-sm">
              <span>JEH phases</span>
              <span>{budget.totalPhasesJeh.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-sm">
              <span>Suivi CDP</span>
              <span>{budget.suiviTotal.toLocaleString('fr-FR')} €</span>
            </div>
            {budget.margeJe > 0 && (
              <div className="flex justify-between items-center text-amber-400 text-sm">
                <span>Marge JE</span>
                <span>+ {budget.margeJe.toLocaleString('fr-FR')} €</span>
              </div>
            )}
            {budget.fraisDossier > 0 && (
              <div className="flex justify-between items-center text-purple-400 text-sm">
                <span>Frais de dossier</span>
                <span>{budget.fraisDossier.toLocaleString('fr-FR')} €</span>
              </div>
            )}
            {budget.fraisAnnexes > 0 && (
              <div className="flex justify-between items-center text-slate-400 text-sm">
                <span>Frais annexes</span>
                <span>{budget.fraisAnnexes.toLocaleString('fr-FR')} €</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-2 flex justify-between items-center text-slate-300 font-medium">
              <span>Total HT</span>
              <span>{budget.totalHT.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between items-center text-slate-300 font-medium">
              <span>TVA ({tvaRate}%)</span>
              <span>{budget.tva.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between items-center font-black text-xl text-green-400">
              <span>Total TTC</span>
              <span>{budget.totalTTC.toLocaleString('fr-FR')} €</span>
            </div>
          </div>

          {/* Récap façon Excel — tel qu'il apparaîtra dans la propale et la validation trésorerie */}
          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-slate-400" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Aperçu budget (propale & trésorerie)
              </h3>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 overflow-x-auto">
              <BudgetSheet breakdown={budgetBreakdown} />
            </div>
          </div>
        </div>
      </div>

      {/* BLOC D'ACTIONS DE FIN DE FORMULAIRE */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 mt-12 flex flex-col sm:flex-row justify-end items-center gap-4 shadow-sm">
        <div className="text-sm text-zinc-500 mr-auto flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Modifications prêtes à être enregistrées</span>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSubmit((data) => onSubmit(data, 'save'))()}
          className="w-full sm:w-auto bg-[#00236f] hover:bg-[#00174a] disabled:opacity-60 text-white px-8 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm hover:shadow"
        >
          <Save size={18} /> Sauvegarder & Fermer
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSubmit((data) => onSubmit(data, 'generate'))()}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-8 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm hover:shadow"
        >
          <Download size={18} /> Générer PowerPoint
        </button>
      </div>

    </div>
  );
}
