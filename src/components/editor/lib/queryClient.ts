import { QueryClient } from '@tanstack/react-query';

export const createEditorQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for this duration
      gcTime: 10 * 60 * 1000, // 10 minutes - cache time (formerly cacheTime)
      retry: 3, // Retry failed requests 3 times
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
    },
  },
});

let activeScope: string | null = null;
let activeClient: QueryClient | null = null;

// All editor-related client islands share one cache while the same user is
// active. A scope change clears and replaces that client so private design data
// cannot survive an account switch in memory.
export function getEditorQueryClient(scope: string): QueryClient {
  // Client Components are also prerendered on the server. Never share mutable
  // query state between requests there; the scoped singleton is browser-only.
  if (typeof window === 'undefined') {
    return createEditorQueryClient();
  }

  if (!activeClient || activeScope !== scope) {
    activeClient?.clear();
    activeClient = createEditorQueryClient();
    activeScope = scope;
  }

  return activeClient;
}
