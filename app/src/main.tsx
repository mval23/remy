import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenForInstallPrompt, requestPersistentStorage } from './pwa';
import './styles.css';
import './planning.css';
import './learning.css';
import './ai.css';
import './prep.css';
import './carte.css';
import './tablet.css';

listenForInstallPrompt();
requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
