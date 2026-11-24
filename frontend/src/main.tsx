import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './styles/globals.css';

// Configure production backend API base URL when set in Vercel environment variables
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl && apiBaseUrl !== 'http://localhost:8000') {
  axios.defaults.baseURL = apiBaseUrl;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
