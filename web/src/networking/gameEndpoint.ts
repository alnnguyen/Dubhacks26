/** Public connection settings only; permanent provider keys never belong here. */
export function gameServerUrl(): string | undefined {
  return import.meta.env.VITE_GAME_SERVER_URL?.trim() || undefined
}

/** A paired phone can open the shared HTTPS frontend even when the laptop runs locally. */
export function saberControllerUrl(code: string, frontendOrigin: string = location.origin): string {
  const base = import.meta.env.VITE_SABER_CONTROLLER_URL?.trim() || frontendOrigin
  const url = new URL('/', base)
  url.searchParams.set('saber', code)
  return url.toString()
}
