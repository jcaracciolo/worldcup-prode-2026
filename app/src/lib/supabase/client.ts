import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Only create client in browser environment with valid env vars
  if (typeof window === 'undefined') {
    // During SSR/build, return a dummy that will be replaced client-side
    return null as unknown as ReturnType<typeof createBrowserClient>
  }
  
  if (client) return client
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    console.warn('Supabase env vars not available')
    return null as unknown as ReturnType<typeof createBrowserClient>
  }
  
  client = createBrowserClient(url, key)
  return client
}
