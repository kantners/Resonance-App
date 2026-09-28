import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Always open on the Brief — ignore any previously retained hash
window.location.hash = "#/";

createRoot(document.getElementById("root")!).render(<App />);
