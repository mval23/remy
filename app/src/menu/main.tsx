import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import '../planning.css';
import './menu.css';
import { Menu } from './Menu';

createRoot(document.getElementById('menu')!).render(
  <StrictMode>
    <Menu />
  </StrictMode>,
);
