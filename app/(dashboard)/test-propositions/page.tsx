import ProposalForm from '@/module_propositions/components/ProposalForm';
import AutoLogin from '@/components/AutoLogin';

export const metadata = {
  title: 'Générateur de Propositions Commerciales',
};

export default function TestPropositionsPage() {
  return (
    <div className="space-y-6">
      <AutoLogin />
      <div className="w-full">
        <ProposalForm />
      </div>
    </div>
  );
}
