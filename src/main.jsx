import React from "react";
import { createRoot } from "react-dom/client";
import PrintCraftStudio from "./PrintCraftStudio.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrintCraftStudio />
  </React.StrictMode>
);
