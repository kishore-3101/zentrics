import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MuleNetLoadingScreen } from '../features/loading/TraceMeshLoadingScreen';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Zentrics · Initializing Command Center';
  }, []);

  const handleComplete = () => {
    navigate('/overview', { replace: true });
  };

  return <MuleNetLoadingScreen onComplete={handleComplete} />;
}
