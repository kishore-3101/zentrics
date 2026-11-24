import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './styles/globals.css';

// Automatically resolve API Base URL:
// 1. Check VITE_API_BASE_URL or VITE_API_BASE_URLS (supporting both)
// 2. Strip trailing slashes to prevent double slashes (e.g. https://...//health)
// 3. If running on vercel.app and no env var is configured, default to https://mulenet-api.vercel.app
const rawEnvUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env as unknown as Record<string, string>)?.VITE_API_BASE_URLS ||
  ''
).trim();

let resolvedApiUrl = rawEnvUrl.replace(/\/+$/, '');

if (!resolvedApiUrl && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
  resolvedApiUrl = 'https://mulenet-api.vercel.app';
}

if (resolvedApiUrl && resolvedApiUrl !== 'http://localhost:8000') {
  axios.defaults.baseURL = resolvedApiUrl;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
