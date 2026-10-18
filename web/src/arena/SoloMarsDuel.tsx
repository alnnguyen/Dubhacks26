import { useEffect, useReducer } from 'react'
import { CameraDebugPage } from '../camera/CameraDebugPage'
import { flightSeconds, initialState, reduceDemo, worlds } from '../app/state'
import '../styles.css'

/**
 * Single-phone Mars duel rehearsal: /?duel=mars.
 * Reuses the team's local rehearsal reducer (simulated rival, health, block).
 * The real two-player match remains /?pvp=1 against the authoritative server.
 */
export function SoloMarsDuel() {
  const [state, dispatch] = useReducer(reduceDemo, undefined, () => ({ ...initialState(), phase: 'duel' as const, world: 'mars' as const }))
  useEffect(() => {
    if (state.phase !== 'duel') return
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 50)
    return () => clearInterval(id)
  }, [state.phase])

  if (state.phase === 'result')
    return (
      <main className="duel-page" style={{ padding: 24, color: '#f6e7da' }}>
        <h1>{state.result}</h1>
        <button className="primary" onClick={() => location.reload()}>
          Play again
        </button>
      </main>
    )

  return (
    <CameraDebugPage
      mode="duel"
      flightSeconds={flightSeconds('mars')}
      duel={{
        worldName: worlds.mars.name,
        gravity: worlds.mars.gravity,
        rivalName: 'Training rival',
        health: state.health,
        rivalHealth: state.rivalHealth,
        note: state.note,
        incoming: state.incomingAt !== null,
        onSimulateRival: () => dispatch({ type: 'rival', now: performance.now() }),
      }}
      onCommands={(commands) => commands.forEach((c) => dispatch({ type: 'command', name: c.name, id: c.commandId, now: performance.now() }))}
    />
  )
}
