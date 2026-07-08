import { useQuery } from '@tanstack/react-query';
import { templateStorage } from '../utils/templateStorage';

export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
};

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.lists(),
    queryFn: () => templateStorage.getPublicTemplates(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
