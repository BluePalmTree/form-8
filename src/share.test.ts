import { describe, expect, it } from 'vitest'
import { makeToken, shareUrl, tokenFromSearch } from './share'

describe('share links', () => {
  it('makes long, url-safe, distinct tokens', () => {
    const a = makeToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(makeToken()).not.toBe(a)
  })

  it('round-trips a token through the url', () => {
    const token = makeToken()
    const url = shareUrl(token, 'https://x.github.io/form-8/')
    expect(url.startsWith('https://x.github.io/form-8/?v=')).toBe(true)
    expect(tokenFromSearch(new URL(url).search)).toBe(token)
  })

  it('has no token without the v parameter', () => {
    expect(tokenFromSearch('')).toBeNull()
    expect(tokenFromSearch('?v=')).toBeNull()
    expect(tokenFromSearch('?other=1')).toBeNull()
  })
})
