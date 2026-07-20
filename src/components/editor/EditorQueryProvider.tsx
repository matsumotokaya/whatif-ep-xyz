'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getEditorQueryClient } from './lib/queryClient';

export function EditorQueryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const scope = loading ? 'auth:loading' : user ? `user:${user.id}` : 'guest';
  const client = getEditorQueryClient(scope);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
