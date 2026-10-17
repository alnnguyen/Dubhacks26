import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { SpaceshipHome } from "./ui/screens/SpaceshipHome"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root")

/** Temporary C harness: open /?debug=camera for MediaPipe rock framing tests. */
const debugCamera = new URLSearchParams(window.location.search).get("debug") === "camera"

async function mount(container: HTMLElement) {
  if (debugCamera) {
    const [{ CameraDebugPage }] = await Promise.all([
      import("./camera/CameraDebugPage"),
      import("./styles.css"),
    ])
    createRoot(container).render(
      <StrictMode>
        <CameraDebugPage />
      </StrictMode>,
    )
    return
  }

  createRoot(container).render(
    <StrictMode>
      <SpaceshipHome />
    </StrictMode>,
  )
}

void mount(root)
