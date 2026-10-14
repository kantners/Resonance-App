import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installHaptics } from "./lib/haptics";

installHaptics();

createRoot(document.getElementById("root")!).render(<App />);
