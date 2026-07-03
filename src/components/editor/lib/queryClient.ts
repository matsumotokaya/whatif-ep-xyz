import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
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
