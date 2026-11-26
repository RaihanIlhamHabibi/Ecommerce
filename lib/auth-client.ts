'use client'

import { createAuthClient } from '@neon/auth'
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters'

const authBaseUrl = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin

export const authClient = createAuthClient(authBaseUrl, {
  adapter: BetterAuthReactAdapter(),
})
