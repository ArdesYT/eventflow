/**
 * EventFlow frontend belépési pont.
 * A React alkalmazást a #root DOM elembe mountolja StrictMode alatt.
 * Az I18nProvider biztosítja a többnyelvűséget; a Root kezeli az auth és routing logikát.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './Root';
import { I18nProvider } from './i18n/I18nProvider';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>
);
