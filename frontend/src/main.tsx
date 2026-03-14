import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  console.error("DAOnance failed to render:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding:40px;font-family:monospace;color:#f0a030;background:#08080a;min-height:100vh">
        <h2>DAOnance — Failed to Load</h2>
        <p style="color:#999;margin-top:12px">Check the browser console for errors.</p>
        <pre style="margin-top:16px;color:#ef4444;font-size:13px">${String(err)}</pre>
      </div>
    `;
  }
}
