import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { installTableLabels } from './ui.jsx';
createRoot(document.getElementById('root')).render(<App />);
installTableLabels();
