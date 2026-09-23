import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/manrope/300.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import './styles/global.css';
import { App } from './App';
import { journey, scrollToUnits, uiStore } from './journey/journeyState';

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__elan = { journey, uiStore, scrollToUnits };
}

// StrictMode is intentionally not used: its development double-mount would
// build every procedural scene twice and tear down GPU resources mid-load.
createRoot(document.getElementById('root')!).render(<App />);
