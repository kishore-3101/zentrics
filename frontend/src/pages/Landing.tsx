import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TraceMeshLoadingScreen } from '../features/loading/TraceMeshLoadingScreen';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'TraceMesh · Initializing Command Center';
  }, []);

  const handleComplete = () => {
    navigate('/overview', { replace: true });
  };

  return <TraceMeshLoadingScreen onComplete={handleComplete} />;
}
