import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const mountEl = document.getElementById("landing-root");
if (mountEl) {
  createRoot(mountEl).render(<App />);
}
