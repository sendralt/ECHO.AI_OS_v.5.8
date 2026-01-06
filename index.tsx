
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

function reportError(err: any) {
  const display = document.getElementById('error-display');
  const stack = document.getElementById('error-stack');
  if (display && stack) {
    display.style.display = 'block';
    stack.textContent = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
  console.error("Uplink Failure:", err);
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("CORE_DOM_MISSING: Root element vanished into the void.");
  }

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  reportError(err);
}
