import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { CameraDebugPage } from "./camera/CameraDebugPage"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root")

createRoot(root).render(
  <StrictMode>
    <CameraDebugPage />
  </StrictMode>,
)
