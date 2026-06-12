import ProposalForm from '@/module_propositions/components/ProposalForm';

export const metadata = {
  title: 'Générateur de Propositions Commerciales',
};

export default function NouvelleProspectionPage() {
  return (
    <div className="space-y-6">
      <div className="w-full">
        <ProposalForm />
      </div>
    </div>
  );
}
