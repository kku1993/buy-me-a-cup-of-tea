import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

import "@kku1993/buy-me-a-cup-of-tea/styles.css";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
