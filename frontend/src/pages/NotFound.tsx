import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PlaceholderPage } from '../components/ui/PlaceholderPage';

export default function NotFound() {
  return (
    <PlaceholderPage
      icon={Compass}
      title="Page not found"
      moduleLabel="404"
      description="This route does not exist in Zentrics."
      planned={['Executive Overview', 'Alert Queue', 'Ring Explorer', 'Models & Evaluation']}
    >
      <Link
        to="/overview"
        className="mt-4 inline-flex rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-light transition-colors hover:bg-gold/20"
      >
        Back to Executive Overview
      </Link>
    </PlaceholderPage>
  );
}
