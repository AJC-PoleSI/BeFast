"use client";

import React, { useState, useEffect } from 'react';
import {
  getProposals,
  updateProposalStatus,
  deleteProposal,
  signProposal,
  getProposalMembers,
} from '@/lib/actions/propositions';
import { Trash2, Edit, FileCheck, Search, Filter, Shield, List, Calendar as CalendarIcon, Clock, BarChart3, Copy, Download, Plus, FileSignature, ExternalLink, Loader2 } from 'lucide-react';

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

export default function Dashboard() {
  const [propales, setPropales] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; prenom: string; nom: string; initials: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [viewAs, setViewAs] = useState<string>('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [displayMode, setDisplayMode] = useState<'liste' | 'calendrier'>('liste');

  useEffect(() => {
    fetchPropales();
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const res = await getProposalMembers();
    if (res?.data) {
      setMembers(
        res.data.map((m: any) => ({
          id: m.id,
          prenom: m.prenom,
          nom: m.nom,
          initials: ((m.prenom?.charAt(0) || '') + (m.nom?.charAt(0) || '')).toUpperCase(),
        }))
      );
    }
  };

  const fetchPropales = async () => {
    setIsLoading(true);
    const res = await getProposals();
    if (res?.data) {
      setPropales(
        res.data.map((p: any) => ({
          id: p.id,
          cdpId: p.cdp_id,
          cdpCustom: p.cdp_custom,
          clientName: p.client_company || '',
          studyType: p.study_type || '',
          date: p.start_date,
          totalHT: p.total_ht,
          totalTTC: p.total_ttc,
          status: p.status,
          budgetStatus: p.budget_status,
          etudeId: p.etude_id,
          phases: (p.proposal_phases || [])
            .slice()
            .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((ph: any) => ({
              ...ph,
              name: ph.name,
              dureeSemaines: ph.duree_semaines,
              semaineDebut: ph.semaine_debut,
            })),
        }))
      );
    } else {
      setPropales([]);
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'envoyée': return <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full">Envoyée</span>;
      case 'validée': return <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">Validée</span>;
      case 'refusée': return <span className="px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-full">Refusée</span>;
      case 'CE éditée': return <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-full">CE Éditée</span>;
      case 'CE signée': return <span className="px-2.5 py-0.5 bg-[#00236f] text-white border border-[#00236f] text-xs font-semibold rounded-full">CE Signée</span>;
      default: return <span className="px-2.5 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-full">{status}</span>;
    }
  };

  const getBudgetBadge = (budgetStatus?: string) => {
    switch (budgetStatus) {
      case 'valide': return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold rounded-full">Budget validé</span>;
      case 'en_attente_validation': return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded-full">Budget à valider</span>;
      case 'rejete': return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold rounded-full">Budget rejeté</span>;
      default: return null;
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Voulez-vous vraiment supprimer la proposition ${id} ?`)) {
      const res = await deleteProposal(id);
      if (res?.error) {
        alert('❌ ' + res.error);
        return;
      }
      setPropales(propales.filter(p => p.id !== id));
    }
  };

  const handleEdit = (id: string) => {
    window.location.href = `/prospection/nouvelle?id=${id}`;
  };

  const handleDuplicate = (id: string) => {
    const propaleToCopy = propales.find(p => p.id === id);
    if (!propaleToCopy) return;

    const baseId = id.replace(/-copie(-\d+)?$/, '');
    let newId = `${baseId}-copie`;
    let counter = 1;
    while (propales.some(p => p.id === newId)) {
      counter++;
      newId = `${baseId}-copie-${counter}`;
    }

    const duplicatedPropale = JSON.parse(JSON.stringify(propaleToCopy));
    duplicatedPropale.id = newId;
    duplicatedPropale.date = new Date().toISOString().split('T')[0];
    duplicatedPropale.status = 'brouillon';

    const newList = [...propales, duplicatedPropale];
    setPropales(newList);
  };

  const handleGeneratePpt = async (id: string) => {
    const propale = propales.find(p => p.id === id);
    if (!propale) return;

    // On convertit le format dashboard vers le format attendu par l'API
    const payload = {
      id: propale.id,
      client_company: propale.clientName,
      taille_entreprise: propale.tailleEntreprise,
      client_civilite: propale.clientCivilite,
      client_first_name: propale.clientFirstName,
      client_last_name: propale.clientLastName,
      client_email: propale.clientEmail,
      client_phone: propale.clientPhone,
      study_type: propale.studyType,
      cdp_id: propale.cdpId,
      context_situation: propale.contextSituation,
      context_intervention: propale.contextIntervention,
      context_enjeu: propale.contextEnjeu,
      cdc_objectifs: propale.cdcObjectifs,
      cdc_contraintes: propale.cdcContraintes,
      cdc_livrables: propale.cdcLivrables,
      suivi_jeh_count: propale.suiviJehCount,
      suivi_jeh_price: propale.suiviJehPrice,
      global_frais_annexes: propale.globalFraisAnnexes,
      start_date: propale.date,
      total_ht: propale.totalHT,
      total_ttc: propale.totalTTC,
      phases: propale.phases || []
    };

    try {
      const response = await fetch('/api/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json();
        alert('❌ ' + err.error);
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Proposition_${propale.clientName || 'AJC'}.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('❌ Erreur réseau lors de la génération.');
    }
  };

  const handleTransformCE = async (id: string) => {
    const res = await updateProposalStatus(id, 'CE éditée');
    if (res?.error) {
      alert('❌ ' + res.error);
      return;
    }
    setPropales(propales.map(p => p.id === id ? { ...p, status: 'CE éditée' } : p));
  };

  // Signature de la CE -> création automatique d'une Étude réelle
  // (phases -> échéancier + missions, budget, suivi, client).
  const handleSignCE = async (id: string) => {
    if (!confirm(`Signer la CE ${id} ?\n\nUne Étude réelle sera créée automatiquement (phases, échéancier, missions, budget et client).`)) return;
    setSigningId(id);
    const res = await signProposal(id);
    setSigningId(null);
    if (res?.error) {
      alert('❌ ' + res.error);
      return;
    }
    const etudeId = res?.data?.etudeId;
    setPropales(propales.map(p => p.id === id ? { ...p, status: 'CE signée', etudeId } : p));
    if (etudeId && confirm('✅ Étude créée avec succès.\n\nVoulez-vous ouvrir la nouvelle étude maintenant ?')) {
      window.location.href = `/etudes/${etudeId}`;
    }
  };

  // Filtrage par Rôle
  let filteredPropales = viewAs === 'admin'
    ? propales
    : propales.filter(p => p.id.startsWith(viewAs));

  // Filtrage par Texte
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredPropales = filteredPropales.filter(p =>
      p.id.toLowerCase().includes(q) ||
      (p.clientName || '').toLowerCase().includes(q) ||
      (p.studyType || '').toLowerCase().includes(q)
    );
  }

  // Filtrage par Statut
  if (statusFilter) {
    filteredPropales = filteredPropales.filter(p => p.status === statusFilter);
  }

  // === LOGIQUE CALENDRIER ===
  const cePropales = filteredPropales.filter(p => p.status === 'CE éditée' || p.status === 'CE signée');

  // Extraction de toutes les phases avec leurs dates
  const allPhases: any[] = [];
  const loadMap = new Map<number, { date: Date, count: number }>();

  cePropales.forEach(ce => {
    let currentDate = getNextMonday(ce.date);
    ce.phases?.forEach((phase: any) => {
      const startDate = new Date(currentDate);
      const endDate = addWeeks(new Date(startDate), phase.dureeSemaines);

      allPhases.push({
        ceId: ce.id,
        clientName: ce.clientName,
        phaseName: phase.name,
        startDate: startDate,
        endDate: endDate,
        dureeSemaines: phase.dureeSemaines
      });

      // Calcul de la charge par semaine (chaque lundi)
      let tempDate = new Date(startDate);
      for(let i=0; i<phase.dureeSemaines; i++) {
        const timeKey = tempDate.getTime();
        if(!loadMap.has(timeKey)) {
          loadMap.set(timeKey, { date: new Date(tempDate), count: 0 });
        }
        loadMap.get(timeKey)!.count += 1;
        tempDate.setDate(tempDate.getDate() + 7); // Passer au lundi suivant
      }

      currentDate.setDate(currentDate.getDate() + phase.dureeSemaines * 7);
    });
  });

  // --- PVRF : fin de la dernière phase de chaque CE ---
  const pvrfEvents: any[] = cePropales.map(ce => {
    if (!ce.phases || ce.phases.length === 0) return null;
    let d = getNextMonday(ce.date);
    ce.phases.forEach((ph: any) => {
      d = new Date(d);
      d.setDate(d.getDate() + (ph.dureeSemaines || 1) * 7);
    });
    return {
      ceId: ce.id,
      clientName: ce.clientName,
      phaseName: 'PVRF — Fin d’étude',
      startDate: d,
      endDate: d,
      isPvrf: true
    };
  }).filter(Boolean);

  // On trie par date de début (phases + PVRF)
  const upcomingDeadlines = [...allPhases, ...pvrfEvents].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const loadData = Array.from(loadMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  const maxLoad = Math.max(...loadData.map(d => d.count), 1);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">

      {/* SIMULATEUR DE VUE */}
      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex flex-wrap items-center justify-between mb-6 gap-3 shadow-sm">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Shield size={18} className="text-amber-600 shrink-0" />
          <span>Mode simulation : vous visualisez en tant que :</span>
        </div>
        <select
          value={viewAs}
          onChange={(e) => setViewAs(e.target.value)}
          className="bg-white border border-amber-200 text-amber-900 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium shadow-sm transition-all"
        >
          <option value="admin">Administrateur (Toutes les propales)</option>
          {members.map(m => (
            <option key={m.id} value={m.initials}>{m.prenom} {m.nom} ({m.initials})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Suivi des Propositions</h1>
          <p className="text-sm text-zinc-500 mt-1">Gérez et suivez le statut de vos propositions commerciales et conventions d'études.</p>
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto shrink-0">
          <div className="bg-zinc-100 p-1 rounded-xl flex text-xs font-bold border border-zinc-200">
            <button
              onClick={() => setDisplayMode('liste')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${displayMode === 'liste' ? 'bg-white text-zinc-800 shadow-sm font-semibold' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              <List size={14} /> Liste
            </button>
            <button
              onClick={() => setDisplayMode('calendrier')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${displayMode === 'calendrier' ? 'bg-white text-zinc-800 shadow-sm font-semibold' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              <CalendarIcon size={14} /> Calendrier CE
            </button>
          </div>

          <button
            onClick={() => window.location.href='/prospection/nouvelle'}
            className="bg-[#00236f] hover:bg-[#00174a] text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow flex items-center gap-2"
          >
            <Plus size={16} /> Nouvelle Proposition
          </button>
        </div>
      </div>

      {/* VUE LISTE */}
      {displayMode === 'liste' && (
        <div className="animate-in fade-in">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un ID, un client, un type d'étude..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 font-medium"
            >
              <option value="">Tous les statuts</option>
              <option value="envoyée">Envoyée</option>
              <option value="validée">Validée</option>
              <option value="refusée">Refusée</option>
              <option value="CE éditée">CE Éditée</option>
              <option value="CE signée">CE Signée</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">ID Propale</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-right">Montant HT</th>
                    <th className="px-6 py-4 text-center">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPropales.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-mono font-bold text-[#00236f]">{p.id}</td>
                      <td className="px-6 py-4 text-slate-500">{p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{p.clientName}</td>
                      <td className="px-6 py-4 text-slate-600">{p.studyType}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">{p.totalHT?.toLocaleString('fr-FR')} €</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(p.status)}
                          {getBudgetBadge(p.budgetStatus)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {p.status !== 'CE éditée' && p.status !== 'CE signée' && (
                            <button onClick={() => handleTransformCE(p.id)} title="Transformer en CE" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent hover:border-emerald-200 text-xs font-bold">
                              <FileCheck size={16} /> <span className="hidden xl:inline">Passer en CE</span>
                            </button>
                          )}
                          {p.status === 'CE éditée' && (
                            <button onClick={() => handleSignCE(p.id)} disabled={signingId === p.id} title="Signer la CE et créer l'étude" className="p-2 text-white bg-[#00236f] hover:bg-[#00174a] rounded-lg transition-colors flex items-center gap-1 text-xs font-bold disabled:opacity-60">
                              {signingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16} />} <span className="hidden xl:inline">{signingId === p.id ? 'Signature…' : 'Signer la CE'}</span>
                            </button>
                          )}
                          {p.status === 'CE signée' && p.etudeId && (
                            <button onClick={() => window.location.href = `/etudes/${p.etudeId}`} title="Voir l'étude créée" className="p-2 text-[#00236f] hover:bg-[#d0d8ff]/30 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold">
                              <ExternalLink size={16} /> <span className="hidden xl:inline">Voir l'étude</span>
                            </button>
                          )}
                          <button onClick={() => handleEdit(p.id)} title="Modifier la proposition" className="p-2 text-slate-600 hover:text-[#00236f] hover:bg-[#d0d8ff]/30 rounded-lg transition-colors">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleGeneratePpt(p.id)} title="Générer le PowerPoint" className="p-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                            <Download size={16} />
                          </button>
                          <button onClick={() => handleDuplicate(p.id)} title="Dupliquer la proposition" className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                            <Copy size={16} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} title="Supprimer définitivement" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPropales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        {isLoading ? 'Chargement…' : 'Aucune proposition trouvée.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VUE CALENDRIER (CE Uniquement) */}
      {displayMode === 'calendrier' && (
        <div className="animate-in fade-in">

          {cePropales.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 text-slate-500">
              <CalendarIcon size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-lg font-medium">Aucune CE en cours trouvée pour cet utilisateur.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* PARTIE 1 : PROCHAINES ÉCHÉANCES */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Clock className="text-blue-600" /> Prochaines échéances (CE)
                </h2>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {upcomingDeadlines.map((p, i) => (
                    <div key={i} className={`flex justify-between items-center p-3 transition-colors border rounded-lg ${
                      p.isPvrf
                        ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}>
                      <div className="flex gap-4 items-center">
                        <div className={`font-bold px-3 py-1.5 rounded text-sm min-w-[60px] text-center ${
                          p.isPvrf
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {p.startDate.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                        </div>
                        <div>
                          <p className={`font-bold ${ p.isPvrf ? 'text-amber-800' : 'text-slate-800' }`}>{p.phaseName}</p>
                          <p className="text-xs text-slate-500">{p.clientName} <span className="font-mono">({p.ceId})</span></p>
                        </div>
                      </div>
                      <div className={`text-xs font-bold uppercase tracking-wider ${
                        p.isPvrf ? 'text-amber-500' : 'text-blue-400'
                      }`}>
                        {p.isPvrf ? 'PVRF' : 'Début'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PARTIE 2 : GRAPHIQUE DE CHARGE (COURBE) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <BarChart3 className="text-blue-600" /> Charge de production
                </h2>
                <p className="text-sm text-slate-500 mb-8">Nombre de phases de CE actives en simultané par semaine.</p>

                <div className="flex-1 w-full overflow-x-auto hide-scrollbar">
                  {loadData.length > 0 ? (() => {
                    const svgWidth = Math.max(600, loadData.length * 80);
                    const svgHeight = 280;
                    const padding = 40;

                    const points = loadData.map((d, i) => {
                      const x = loadData.length === 1 ? svgWidth / 2 : (i / (loadData.length - 1)) * svgWidth;
                      const y = svgHeight - padding - (d.count / maxLoad) * (svgHeight - padding * 2);
                      return { x, y, d };
                    });

                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
                    const polygonPoints = points.length > 0 ? `${points[0].x},${svgHeight} ${polylinePoints} ${points[points.length-1].x},${svgHeight}` : '';

                    return (
                      <svg viewBox={`-20 0 ${svgWidth + 40} ${svgHeight}`} className="w-full h-auto min-w-[500px]">
                        <defs>
                          <linearGradient id="curveGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Lignes de guide (Grille horizontale) */}
                        {[0, 0.5, 1].map(ratio => {
                          const yPos = padding + ratio * (svgHeight - padding * 2);
                          return (
                            <g key={ratio}>
                              <line x1="0" y1={yPos} x2={svgWidth} y2={yPos} stroke="#f1f5f9" strokeWidth="2" strokeDasharray="5 5" />
                              <text x="-15" y={yPos + 4} fill="#94a3b8" fontSize="11" textAnchor="end">
                                {Math.round(maxLoad - ratio * maxLoad)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Remplissage sous la courbe */}
                        {points.length > 1 && (
                          <polygon points={polygonPoints} fill="url(#curveGradient)" />
                        )}

                        {/* La courbe principale */}
                        <polyline points={polylinePoints} fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />

                        {/* Points et Interactions */}
                        {points.map((p, i) => (
                          <g key={i} className="group cursor-pointer">
                            <line x1={p.x} y1={p.y} x2={p.x} y2={svgHeight - 15} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-0 group-hover:opacity-100 transition-opacity" />

                            <circle cx={p.x} cy={p.y} r="6" fill="#ffffff" stroke="#3b82f6" strokeWidth="3" className="transition-all duration-300 group-hover:r-[8px] group-hover:stroke-[4px]" />

                            <text x={p.x} y={p.y - 15} textAnchor="middle" fill="#1e293b" fontSize="14" fontWeight="bold" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {p.d.count} {p.d.count > 1 ? 'phases' : 'phase'}
                            </text>

                            <text x={p.x} y={svgHeight - 2} textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="500">
                              {p.d.date.toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                            </text>
                          </g>
                        ))}
                      </svg>
                    );
                  })() : (
                    <div className="flex h-full items-center justify-center text-slate-400">Aucune donnée à afficher</div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
