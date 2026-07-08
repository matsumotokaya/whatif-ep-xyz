import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateRecord } from '../types/template';
import { likeStorage } from '../utils/likeStorage';
import { templateKeys } from './useTemplates';

export const likeKeys = {
  all: ['likes'] as const,
  userLikes: () => [...likeKeys.all, 'user'] as const,
};

export function useUserLikes(userId: string | undefined) {
  return useQuery({
    queryKey: likeKeys.userLikes(),
    queryFn: () => likeStorage.getUserLikes(),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => likeStorage.toggleLike(templateId),
    onMutate: async (templateId: string) => {
      await queryClient.cancelQueries({ queryKey: likeKeys.userLikes() });
      await queryClient.cancelQueries({ queryKey: templateKeys.lists() });

      const previousLikes = queryClient.getQueryData<string[]>(likeKeys.userLikes());
      const previousTemplates = queryClient.getQueryData<TemplateRecord[]>(
        templateKeys.lists()
      );
      const isCurrentlyLiked = previousLikes?.includes(templateId) ?? false;

      queryClient.setQueryData<string[]>(likeKeys.userLikes(), (old) => {
        if (!old) return isCurrentlyLiked ? [] : [templateId];
        return isCurrentlyLiked
          ? old.filter((id) => id !== templateId)
          : [...old, templateId];
      });

      queryClient.setQueryData<TemplateRecord[]>(templateKeys.lists(), (old) => {
        if (!old) return old;
        return old.map((template) =>
          template.id === templateId
            ? {
                ...template,
                likeCount: (template.likeCount ?? 0) + (isCurrentlyLiked ? -1 : 1),
              }
            : template
        );
      });

      return { previousLikes, previousTemplates };
    },
    onError: (_error, _templateId, context) => {
      if (context?.previousLikes) {
        queryClient.setQueryData(likeKeys.userLikes(), context.previousLikes);
      }
      if (context?.previousTemplates) {
        queryClient.setQueryData(templateKeys.lists(), context.previousTemplates);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: likeKeys.userLikes() });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}
