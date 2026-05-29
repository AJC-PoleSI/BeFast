import ProposalForm from '@/module_propositions/components/ProposalForm';
import AutoLogin from '@/components/AutoLogin';

export const metadata = {
  title: 'Générateur de Propositions Commerciales',
};

export default function TestPropositionsPage() {
  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <AutoLogin />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl sm:tracking-tight lg:text-6xl mb-4">
            Générateur de Propositions
          </h1>
          <p className="max-w-xl mx-auto text-xl text-slate-500">
            Interface de test pour la création des propositions commerciales dynamiques.
          </p>
        </div>
        
        <ProposalForm />
      </div>
    </div>
  );
}
