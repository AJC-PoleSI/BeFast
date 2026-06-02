"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Calendar, User, Briefcase, Plus, Trash2, FileText, Settings, Download, ArrowLeft, ArrowRight, Eye, Users, Calculator, FileSignature, Save } from 'lucide-react';
import { studyTypes } from '../data/mockDB';
import { createClient } from '@/lib/supabase/client';
import { loadCdps, loadCatalogPhases, loadClients, savePropale, loadPropale, type Cdp, type PhaseType, type Client } from '../data/propaleRepo';

// Initiales d'un CDP (personne) pour la génération de l'ID de proposition
function cdpInitials(c: { prenom?: string; nom?: string }) {
  return ((c.prenom?.charAt(0) || '') + (c.nom?.charAt(0) || '')).toUpperCase();
}

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
  d.setDate(d.getDate() + weeks * 7 - 3);
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

export default function ProposalForm() {
  const router = useRouter();
  const [isIdEdited, setIsIdEdited] = useState(false);
  const isIdEditedRef = useRef(false);
  
  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      propaleId: '',
      cdpSelect: '',
      cdpCustom: '',
      clientId: '',
      companyName: '',
      isAutoentrepreneur: false,
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
        startAfterPhaseId: string | number,
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

  const watchCdpSelect = watch('cdpSelect');
  const watchCdpCustom = watch('cdpCustom');
  const watchStudyType = watch('studyTypeSelect');
  const watchPhases = watch('phases');
  const watchStartDate = watch('projectStartDate');
  const watchGlobalFraisAnnexes = watch('globalFraisAnnexes');

  const supabase = createClient();

  // RÉFÉRENTIELS chargés depuis Supabase (remplacent les anciens JSON locaux)
  const [cdps, setCdps] = useState<Cdp[]>([]);
  const [phaseCatalog, setPhaseCatalog] = useState<PhaseType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    Promise.all([loadCdps(supabase), loadCatalogPhases(supabase), loadClients(supabase)]).then(([cdpData, phaseData, clientData]) => {
      setCdps(cdpData);
      setPhaseCatalog(phaseData);
      setClients(clientData);
    });
  }, []);

  // Rattachement client : si le nom saisi correspond à un client connu, on le lie et pré-remplit le contact.
  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nom = e.target.value;
    setValue('companyName', nom);
    const match = clients.find(c => c.nom.toLowerCase() === nom.trim().toLowerCase());
    setValue('clientId', match ? match.id : '');
    if (match) {
      setValue('isAutoentrepreneur', !!match.is_autoentrepreneur);
      if (match.contact_civilite) setValue('clientCivilite', match.contact_civilite);
      if (match.contact_prenom) setValue('clientFirstName', match.contact_prenom);
      if (match.contact_nom) setValue('clientLastName', match.contact_nom);
      if (match.contact_email) setValue('clientEmail', match.contact_email);
      if (match.contact_phone) setValue('clientPhone', match.contact_phone);
    }
  };

  // LOAD FROM URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    const fetchPropale = async () => {
      const propale = await loadPropale(supabase, id);
      if (!propale) return;

      setIsIdEdited(true);
      isIdEditedRef.current = true;
      setValue('propaleId', propale.id);
      setValue('clientId', propale.clientId || '');
      setValue('companyName', propale.clientName || '');
      setValue('isAutoentrepreneur', !!propale.isAutoentrepreneur);
      setValue('cdpSelect', propale.cdpId ? String(propale.cdpId) : '');
      setValue('clientCivilite', propale.clientCivilite || 'M.');
      setValue('clientFirstName', propale.clientFirstName || '');
      setValue('clientLastName', propale.clientLastName || '');
      setValue('clientEmail', propale.clientEmail || '');
      setValue('clientPhone', propale.clientPhone || '');
      setValue('studyTypeSelect', studyTypes.includes(propale.studyType) ? propale.studyType : 'autre');
      if (!studyTypes.includes(propale.studyType)) {
        setValue('studyTypeCustom', propale.studyType);
      }
      setValue('contextSituation', propale.contextSituation || '');
      setValue('contextIntervention', propale.contextIntervention || '');
      setValue('contextEnjeu', propale.contextEnjeu || '');
      setValue('cdcObjectifs', propale.cdcObjectifs || '');
      setValue('cdcContraintes', propale.cdcContraintes || '');
      setValue('cdcLivrables', propale.cdcLivrables || '');
      setValue('suiviJehCount', propale.suiviJehCount !== undefined ? propale.suiviJehCount : 1);
      setValue('suiviJehPrice', propale.suiviJehPrice !== undefined ? propale.suiviJehPrice : 200);
      setValue('globalFraisAnnexes', propale.globalFraisAnnexes !== undefined ? propale.globalFraisAnnexes : 0);
      if (propale.date) setValue('projectStartDate', propale.date);

      if (propale.phases && propale.phases.length > 0) {
        removePhase();
        propale.phases.forEach((p: any, i: number) => {
          append({
            phaseId: p.phaseId || Date.now() + i,
            name: p.name,
            objectifs: p.objectifs || '',
            methodologie: p.methodologie || '',
            contraintes: p.contraintes || '',
            dureeSemaines: p.dureeSemaines || 1,
            startAfterPhaseId: p.startAfterPhaseId || 'project_start',
            intervenantsCount: p.intervenantsCount || 1,
            intervenantsNiveau: p.intervenantsNiveau || 'L3',
            jehCount: p.intervenantsCount || p.jehCount || 1,
            jehPrice: p.jehPrice || 100
          });
        });
      }
    };

    fetchPropale();
  }, [setValue, append, removePhase]);


  // AUTO GENERATE ID
  useEffect(() => {
    if (isIdEditedRef.current) return;
    let initials = 'XXX';
    if (watchCdpSelect === 'autre' && watchCdpCustom) {
      initials = watchCdpCustom.substring(0, 3).toUpperCase();
    } else if (watchCdpSelect && watchCdpSelect !== 'autre') {
      const selectedCdp = cdps.find(c => c.id === watchCdpSelect);
      if (selectedCdp) {
        initials = cdpInitials(selectedCdp) || 'XXX';
      }
    }
    setValue('propaleId', generatePropaleId(initials));
  }, [watchCdpSelect, watchCdpCustom, isIdEdited, setValue, cdps]);

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

  const handleAddPhase = (phaseId: number | 'custom') => {
    const defaultIntervenants = 3;
    const baseFields = {
      intervenantsCount: defaultIntervenants,
      intervenantsNiveau: 'L3',
      jehCount: defaultIntervenants, // Automatiquement égal au nb intervenants
      jehPrice: 100,
      startAfterPhaseId: 'project_start' as const
    };

    // Par défaut, on fait suivre la phase précédente
    if (watchPhases.length > 0) {
      baseFields.startAfterPhaseId = watchPhases[watchPhases.length - 1].phaseId as any;
    }

    if (phaseId === 'custom') {
      append({
        phaseId: Date.now(),
        name: "Nouvelle phase",
        objectifs: "",
        methodologie: "",
        contraintes: "",
        dureeSemaines: 2,
        ...baseFields
      });
    } else {
      const phaseData = phaseCatalog.find(p => p.id === phaseId);
      if (phaseData) {
        append({
          phaseId: phaseData.id + Date.now(),
          name: phaseData.name,
          objectifs: phaseData.objectifs || "",
          methodologie: phaseData.methodologie || "",
          contraintes: phaseData.contraintes || "",
          dureeSemaines: phaseData.duree_semaines || 2,
          intervenantsCount: phaseData.intervenants_count || 3,
          intervenantsNiveau: 'L3',
          jehCount: phaseData.intervenants_count || 3,
          jehPrice: phaseData.jeh_price || 100,
          startAfterPhaseId: baseFields.startAfterPhaseId
        });
      }
    }
  };

  const onSubmit = async (data: any, action: 'save' | 'generate') => {
    // 1. Sauvegarde unifiée : etude (statut prospect) + etude_propale + echeancier_blocs
    const etudeId = await savePropale(supabase, data);
    if (!etudeId) {
      alert("❌ La sauvegarde a échoué. Vérifiez votre connexion à la base.");
      return;
    }

    // 2. Construction du payload pour la génération PowerPoint
    let totalHT = 0;
    data.phases.forEach((p: any) => { totalHT += (Number(p.jehCount || 0) * Number(p.jehPrice || 0)); });
    totalHT += (Number(data.suiviJehCount || 0) * Number(data.suiviJehPrice || 0));
    totalHT += Number(data.globalFraisAnnexes || 0);
    const totalTTC = totalHT * 1.20;

    const propaleToSave = {
      id: data.propaleId,
      cdp_id: data.cdpSelect && data.cdpSelect !== 'autre' ? data.cdpSelect : null,
      client_company: data.companyName,
      is_autoentrepreneur: data.isAutoentrepreneur,
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
      start_date: data.projectStartDate,
      total_ht: totalHT,
      total_ttc: totalTTC,
    };

    if (action === 'save') {
      alert("L'étude a bien été sauvegardée sur le Dashboard !");
      router.push('/test-dashboard-propositions');
    } else {
      try {
        // Résoudre les informations du CDP pour la génération du PPT
        const cdpInfo: any = {};
        if (data.cdpSelect === 'autre') {
          const nameParts = (data.cdpCustom || '').trim().split(/\s+/);
          cdpInfo.cdp_civilite = 'M.'; // Par défaut pour la saisie manuelle
          cdpInfo.cdp_first_name = nameParts[0] || 'Chef de Projet';
          cdpInfo.cdp_last_name = nameParts.slice(1).join(' ') || '';
          cdpInfo.cdp_initials = (cdpInfo.cdp_first_name.charAt(0) + (cdpInfo.cdp_last_name.charAt(0) || '')).toUpperCase() || 'CP';
          cdpInfo.cdp_email = `${cdpInfo.cdp_first_name.toLowerCase()}.${cdpInfo.cdp_last_name.toLowerCase()}@ajc-mail.com`;
          cdpInfo.cdp_phone = '+33 6 00 00 00 00';
        } else if (data.cdpSelect) {
          const selectedCdp = cdps.find(c => c.id === data.cdpSelect);
          if (selectedCdp) {
            cdpInfo.cdp_civilite = 'M.'; // personnes ne stocke pas la civilité
            cdpInfo.cdp_first_name = selectedCdp.prenom;
            cdpInfo.cdp_last_name = selectedCdp.nom;
            cdpInfo.cdp_initials = cdpInitials(selectedCdp);
            cdpInfo.cdp_email = selectedCdp.email;
            cdpInfo.cdp_phone = selectedCdp.portable || '+33 6 12 34 56 78';
          }
        }

        const payloadForPpt = {
          ...propaleToSave,
          ...cdpInfo,
          phases: data.phases // S'assurer que les phases sont bien transmises !
        };

        const response = await fetch('/api/generate-ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadForPpt)
        });
        
        if (!response.ok) {
           const error = await response.json();
           alert("❌ Erreur de génération : " + error.error);
           return;
        }
        
        // Téléchargement du fichier PPTX généré
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Proposition_${data.companyName || 'AJC'}.pptx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        alert("✅ L'étude a été sauvegardée et le PowerPoint a été téléchargé avec succès !");
        router.push('/test-dashboard-propositions');
      } catch (err) {
        alert("❌ Erreur de réseau ou de génération.");
      }
    }
  };

  const calculateBudget = () => {
    let totalHT = 0;
    watchPhases.forEach(p => {
      // Calcul du budget basé sur le nombre de JEH de chaque phase
      totalHT += (Number(p.jehCount || 0) * Number(p.jehPrice || 100));
    });
    // Add Suivi de projet
    totalHT += (Number(watch('suiviJehCount') || 0) * Number(watch('suiviJehPrice') || 0));
    // Add Frais Annexes
    totalHT += Number(watchGlobalFraisAnnexes || 0);
    const tva = totalHT * 0.20;
    const totalTTC = totalHT + tva;
    return { totalHT, tva, totalTTC };
  };
  const budget = calculateBudget();

  // CALCUL ECHEANCIER AVEC DEPENDANCES
  const calculatePhasesDates = () => {
    const dates = [];
    const dateMap = new Map(); // map stringified phaseId to Date

    for (let i = 0; i < watchPhases.length; i++) {
      const phase = watchPhases[i];
      let startDate;
      
      if (phase.startAfterPhaseId === 'project_start' || i === 0) {
        startDate = new Date(getNextMonday(watchStartDate));
      } else {
        const refEndDate = dateMap.get(String(phase.startAfterPhaseId));
        if (refEndDate) {
          startDate = new Date(refEndDate);
        } else {
          // Fallback au cas où la phase ciblée n'existe pas
          startDate = new Date(getNextMonday(watchStartDate));
        }
      }
      
      const endDate = addWeeks(startDate, phase.dureeSemaines || 1);
      
      dates.push({ startDate, endDate });
      dateMap.set(String(phase.phaseId), new Date(endDate));
    }
    return dates;
  };
  const phasesDates = calculatePhasesDates();
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
            {isIdEdited && <span className="text-xs text-blue-700">✍️ Modifié manuellement ou chargé</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b pb-2">Client</h3>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Entreprise</label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer hover:text-blue-600 transition-colors bg-slate-100 px-2 py-1 rounded">
                    <input type="checkbox" {...register('isAutoentrepreneur')} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    Auto-entrepreneur
                  </label>
                </div>
                <input type="text" list="clients-list" value={watch('companyName')} onChange={handleCompanyChange} className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom de l'entreprise (ou de la personne)" />
                <datalist id="clients-list">
                  {clients.map(c => <option key={c.id} value={c.nom} />)}
                </datalist>
                {watch('clientId')
                  ? <span className="mt-1 inline-block text-xs text-emerald-700">✓ Client existant rattaché</span>
                  : (watch('companyName')?.trim()
                      ? <span className="mt-1 inline-block text-xs text-amber-600">Nouveau client — sera créé en prospection</span>
                      : null)}
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
                  <option value="">Sélectionner un CDP...</option>
                  {cdps.map(cdp => (
                    <option key={cdp.id} value={cdp.id}>{cdp.prenom} {cdp.nom}</option>
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
              {phaseCatalog.map(phase => (
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
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Débute après :</span>
                      <select {...register(`phases.${index}.startAfterPhaseId` as const)} className="text-sm bg-transparent font-medium text-slate-700 outline-none max-w-[200px] truncate">
                        <option value="project_start">Le lancement du projet</option>
                        {watchPhases.slice(0, index).map((p, i) => (
                          <option key={p.phaseId} value={p.phaseId}>La phase {i + 1}. {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" onClick={() => removePhase(index)} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-50 p-2 rounded-md hover:bg-red-50">
                      <Trash2 size={18} />
                    </button>
                  </div>
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
                
                {/* WIDGET DE DURÉE MINIATURISÉ EN BAS À DROITE */}
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
                        // Si le nombre de JEH est égal au nombre d'intervenants actuel, on synchronise
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

      {/* 6. ÉCHÉANCIER & BUDGET */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="text-blue-400" /> 6. Échéancier
            </h2>
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
            <div className="space-y-3">
              {phaseFields.map((field, index) => {
                const dates = phasesDates[index];
                if (!dates) return null;
                return (
                  <div key={field.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-200 relative overflow-hidden group">
                    <span className="font-bold text-slate-700 text-sm">
                      {index + 1}. {watchPhases[index]?.name}
                    </span>
                    <span className="text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                      {formatDate(dates.startDate)} → {formatDate(dates.endDate)}
                    </span>
                  </div>
                );
              })}
              {phaseFields.length === 0 && <p className="text-slate-500 text-sm italic">Ajoutez des phases pour générer l'échéancier.</p>}
            </div>
          </div>
        </div>

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
                <div className="flex gap-2 w-full sm:w-2/3 items-center">
                  <Controller
                    name="suiviJehCount"
                    control={control}
                    render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
                  />
                  <Controller
                    name="suiviJehPrice"
                    control={control}
                    render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
                  />
                  <span className="font-bold text-blue-900 ml-auto my-auto">
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
                    <div className="flex gap-2 w-full sm:w-2/3">
                      <Controller
                        name={`phases.${index}.jehCount` as const}
                        control={control}
                        render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
                      />
                      <Controller
                        name={`phases.${index}.jehPrice` as const}
                        control={control}
                        render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={80} className="w-[120px]" />}
                      />
                      <span className="font-bold text-slate-800 ml-auto my-auto">{totalPhase.toLocaleString('fr-FR')} €</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <label className="font-bold text-slate-700 text-sm">Frais Annexes Globaux (€)</label>
              <Controller
                name="globalFraisAnnexes"
                control={control}
                render={({ field }) => <FastNumberInput value={field.value} onChange={field.onChange} min={0} className="w-[120px]" />}
              />
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span>Total HT</span>
                <span>{budget.totalHT.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span>TVA (20%)</span>
                <span>{budget.tva.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex justify-between items-center font-black text-xl text-green-400">
                <span>Total TTC</span>
                <span>{budget.totalTTC.toLocaleString('fr-FR')} €</span>
              </div>
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
          onClick={() => handleSubmit((data) => onSubmit(data, 'save'))()} 
          className="w-full sm:w-auto bg-[#00236f] hover:bg-[#00174a] text-white px-8 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm hover:shadow"
        >
          <Save size={18} /> Sauvegarder & Fermer
        </button>
        <button 
          type="button" 
          onClick={() => handleSubmit((data) => onSubmit(data, 'generate'))()} 
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm hover:shadow"
        >
          <Download size={18} /> Générer PowerPoint
        </button>
      </div>

    </div>
  );
}
