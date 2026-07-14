import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
<<<<<<< HEAD
=======
import * as serviceWorkerRegistration from './serviceWorkerRegistration'; // ✅ added
>>>>>>> eecf6611ba0f362931e516c3f4743e21ade3df8b

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
<<<<<<< HEAD
=======

// ✅ register the service worker for offline caching
serviceWorkerRegistration.register();
>>>>>>> eecf6611ba0f362931e516c3f4743e21ade3df8b
