"use client";

import React, { useState, useEffect } from 'react';
import { mockSavedPropales, mockCDPs } from '../data/mockDB';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Edit, FileCheck, Search, Filter, Shield, List, Calendar as CalendarIcon, Clock, BarChart3, Copy, Download } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [viewAs, setViewAs] = useState<string>('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [displayMode, setDisplayMode] = useState<'liste' | 'calendrier'>('liste');
  const supabase = createClient();

  useEffect(() => {
    fetchPropales();
  }, []);

  const fetchPropales = async () => {
    try {
      const { data, error } = await supabase.from('proposals').select('*, proposal_phases(*)');
      
      if (error) {
        console.warn("Supabase introuvable ou tables non créées, utilisation des données fictives :", error.message);
        setPropales(mockSavedPropales);
      } else if (data) {
        const formatted = data.map((p: any) => ({
          id: p.id,
          cdpId: p.cdp_id,
          clientName: p.client_company,
          studyType: p.study_type,
          date: p.start_date,
          totalHT: p.total_ht,
          totalTTC: p.total_ttc,
          status: p.status,
          phases: p.proposal_phases ? p.proposal_phases.map((ph: any) => ({
             ...ph,
             name: ph.name,
             dureeSemaines: ph.duree_semaines
          })) : []
        }));
        // Si la base est vide pour l'instant, on laisse les fausses données pour tester le visuel
        setPropales(formatted.length > 0 ? formatted : mockSavedPropales);
      }
    } catch (err) {
      console.error(err);
      setPropales(mockSavedPropales);
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'envoyée': return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase">Envoyée</span>;
      case 'validée': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase">Validée</span>;
      case 'refusée': return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase">Refusée</span>;
      case 'CE éditée': return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full uppercase">CE Éditée</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full uppercase">{status}</span>;
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm(`Voulez-vous vraiment supprimer la proposition ${id} ?`)) {
      // Tente de supprimer dans Supabase
      await supabase.from('proposals').delete().eq('id', id);
      setPropales(propales.filter(p => p.id !== id));
    }
  };

  const handleEdit = (id: string) => {
    window.location.href = `/test-propositions?id=${id}`;
  };

  const handleDuplicate = (id: string) => {
    const propaleToCopy = propales.find(p => p.id === id);
    if (!propaleToCopy) return;

    const baseId = id.replace(/-copie(-\d+)?$/, '');
    let newId = `${baseId}-copie`;
    let counter = 1;
    // On vérifie uniquement dans le state local, pas dans mockSavedPropales
    while (propales.some(p => p.id === newId)) {
      counter++;
      newId = `${baseId}-copie-${counter}`;
    }

    const duplicatedPropale = JSON.parse(JSON.stringify(propaleToCopy));
    duplicatedPropale.id = newId;
    duplicatedPropale.date = new Date().toISOString().split('T')[0];
    duplicatedPropale.status = 'brouillon';

    // On ne push plus dans mockSavedPropales ici pour éviter le doublon avec le state
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
      client_civilite: propale.clientCivilite,
      client_email: propale.clientEmail,
      study_type: propale.studyType,
      context_situation: propale.contextSituation,
      context_intervention: propale.contextIntervention,
      context_enjeu: propale.contextEnjeu,
      cdc_objectifs: propale.cdcObjectifs,
      cdc_contraintes: propale.cdcContraintes,
      cdc_livrables: propale.cdcLivrables,
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
    alert(`La propale ${id} va passer en statut Validée/CE Éditée.\nOuverture du menu pour préciser les caractéristiques de la Convention d'Étude...`);
    await supabase.from('proposals').update({ status: 'CE éditée' }).eq('id', id);
    setPropales(propales.map(p => p.id === id ? { ...p, status: 'CE éditée' } : p));
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
      p.clientName.toLowerCase().includes(q) ||
      p.studyType.toLowerCase().includes(q)
    );
  }

  // Filtrage par Statut
  if (statusFilter) {
    filteredPropales = filteredPropales.filter(p => p.status === statusFilter);
  }

  // === LOGIQUE CALENDRIER ===
  const cePropales = filteredPropales.filter(p => p.status === 'CE éditée');
  
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
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      
      {/* SIMULATEUR DE VUE */}
      <div className="bg-slate-900 text-white p-3 rounded-lg flex items-center justify-between mb-8 shadow-md">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Shield size={18} className="text-emerald-400" />
          <span>Mode Test : Vous simulez la vue de :</span>
        </div>
        <select 
          value={viewAs} 
          onChange={(e) => setViewAs(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="admin">Administrateur (Toutes les propales)</option>
          {mockCDPs.map(cdp => (
            <option key={cdp.id} value={cdp.initials}>{cdp.firstName} {cdp.lastName} ({cdp.initials})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Mon Dashboard</h1>
          <p className="text-slate-500 mt-1">Gérez vos propositions commerciales et conventions d'études.</p>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="bg-slate-200 p-1 rounded-lg flex text-sm font-bold">
            <button 
              onClick={() => setDisplayMode('liste')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${displayMode === 'liste' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} /> Liste
            </button>
            <button 
              onClick={() => setDisplayMode('calendrier')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${displayMode === 'calendrier' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <CalendarIcon size={16} /> Suivi CE
            </button>
          </div>
          
          <button onClick={() => window.location.href='/test-propositions'} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm ml-2">
            + Nouvelle Proposition
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
                      <td className="px-6 py-4 font-mono font-bold text-blue-700">{p.id}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{p.clientName}</td>
                      <td className="px-6 py-4 text-slate-600">{p.studyType}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">{p.totalHT?.toLocaleString('fr-FR')} €</td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(p.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {p.status !== 'CE éditée' && (
                            <button onClick={() => handleTransformCE(p.id)} title="Transformer en CE" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent hover:border-emerald-200 text-xs font-bold">
                              <FileCheck size={16} /> <span className="hidden xl:inline">Passer en CE</span>
                            </button>
                          )}
                          <button onClick={() => handleEdit(p.id)} title="Modifier la proposition" className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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
                        Aucune proposition trouvée.
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
