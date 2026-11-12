import { BrainCircuit } from 'lucide-react';
import { PlaceholderPage } from '../components/ui/PlaceholderPage';

export default function Metrics() {
  return (
    <PlaceholderPage
      icon={BrainCircuit}
      title="Models & Evaluation"
      moduleLabel="Module 16 · /metrics"
      description="Model benchmark dashboard comparing TraceMesh against baselines."
      planned={[
        'Precision, recall, F1 and PR-AUC cards',
        'Four-way model comparison chart',
        'Precision-recall and ROC curves',
        'Typology, difficulty and fairness breakdowns',
      ]}
    />
  );
}
