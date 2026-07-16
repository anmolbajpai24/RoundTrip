import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DialogHost from "./components/dialogs.jsx";
import { initTheme } from "./theme.js";

initTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <DialogHost />
  </StrictMode>
);
