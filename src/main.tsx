import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import './index.css'
import { UIProvider } from "./components/UIProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </StrictMode>
);


