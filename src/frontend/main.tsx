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
