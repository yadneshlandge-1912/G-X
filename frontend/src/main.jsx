import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Leaflet CSS — must be imported before any Leaflet/react-leaflet component renders.
// Without this the map tiles stack on top of each other and zoom controls are hidden.
import 'leaflet/dist/leaflet.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
