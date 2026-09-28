import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenForInstallPrompt, requestPersistentStorage } from './pwa';
import './styles.css';
import './planning.css';
import './learning.css';
import './ai.css';

listenForInstallPrompt();
requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
