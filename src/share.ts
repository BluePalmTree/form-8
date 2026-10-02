const TOKEN_BYTES = 18

/** Unguessable share token (144 bits, base64url). */
export function makeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Link that opens the read-only view of a shared choreography. */
export function shareUrl(token: string, base = location.origin + location.pathname): string {
  return `${base}?v=${encodeURIComponent(token)}`
}

export function tokenFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('v') || null
}
