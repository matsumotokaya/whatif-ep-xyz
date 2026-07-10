import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { bannerStorage } from '../utils/bannerStorage';
import { getSupabase } from '../utils/supabase';
import type { Banner, BannerListItem, CanvasElement, Template } from '../types/template';
import { invalidateProductionProjectQueries } from './useProductionProjects';

// Query keys
export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => [...bannerKeys.all, 'list'] as const,
  list: (userId: string) => [...bannerKeys.lists(), userId] as const,
  factoryIds: () => [...bannerKeys.all, 'factory-ids'] as const,
  details: () => [...bannerKeys.all, 'detail'] as const,
  detail: (id: string) => [...bannerKeys.details(), id] as const,
};

export async function invalidateBannerCollectionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bannerKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: bannerKeys.factoryIds() }),
  ]);
}

async function invalidateBannerRelatedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateBannerCollectionQueries(queryClient),
    invalidateProductionProjectQueries(queryClient),
  ]);
}

function syncBannerIntoListCaches(queryClient: QueryClient, banner: Banner): void {
  queryClient.setQueriesData<BannerListItem[]>(
    { queryKey: bannerKeys.lists() },
    (previous) => {
      if (!previous) return previous;
      return previous.map((item) =>
        item.id === banner.id
          ? {
              ...item,
              name: banner.name,
              updatedAt: banner.updatedAt,
              thumbnailUrl: banner.thumbnailUrl,
              fullresUrl: banner.fullresUrl,
            }
          : item
      );
    },
  );
}

// Get all banners for the authenticated user. The query is keyed by user id so
// auth resolution cannot cache an anonymous [] result into a signed-in session.
export function useBanners(userId?: string | null, enabled = true) {
  return useQuery({
    queryKey: bannerKeys.list(userId || 'guest'),
    queryFn: async () => {
      if (!userId) {
        return [];
      }
      console.log('[useBanners] 🔍 Fetching banners from database...');
      const banners = await bannerStorage.getAll(false); // Disable old cache, use React Query cache
      console.log('[useBanners] ✅ Fetched', banners.length, 'banners');
      return banners;
    },
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}

export function useFactoryBannerIds(enabled = true) {
  return useQuery({
    queryKey: bannerKeys.factoryIds(),
    queryFn: async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('production_project_banners')
        .select('banner_id')
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      return Array.from(new Set((data ?? []).map((row) => row.banner_id)));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// Get single banner by ID
export function useBanner(id: string | undefined) {
  return useQuery({
    queryKey: bannerKeys.detail(id || ''),
    queryFn: async () => {
      console.log('[useBanner] Fetching banner from DB:', id);
      if (!id) return null;
      const banner = await bannerStorage.getById(id, false); // Disable old cache
      console.log('[useBanner] Fetched banner with', banner?.elements.length, 'elements');
      return banner;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Create new banner
export function useCreateBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name: string; template: Template }) => {
      const banner = await bannerStorage.create(params.name, params.template);
      return banner;
    },
    onSuccess: () => {
      // Invalidate banner list to refetch
      void invalidateBannerRelatedQueries(queryClient);
    },
  });
}

// Update banner
export function useUpdateBanner(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Banner>) => {
      await bannerStorage.update(id, updates);
      return updates;
    },
    // Optimistic update
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: bannerKeys.detail(id) });

      // Snapshot previous value
      const previousBanner = queryClient.getQueryData<Banner>(bannerKeys.detail(id));

      // Optimistically update to the new value
      if (previousBanner) {
        queryClient.setQueryData<Banner>(bannerKeys.detail(id), {
          ...previousBanner,
          ...updates,
        });
      }

      return { previousBanner };
    },
    // On error, rollback to previous value
    onError: (_err, _variables, context) => {
      if (context?.previousBanner) {
        queryClient.setQueryData(bannerKeys.detail(id), context.previousBanner);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.detail(id) });
      void invalidateBannerRelatedQueries(queryClient);
    },
  });
}

// Batch save (elements, canvas color, thumbnail)
// Optimistic update DISABLED to prevent local state from being overwritten
// Cache invalidation DISABLED to maintain local state as source of truth
export function useBatchSaveBanner(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: {
      elements?: CanvasElement[];
      canvasColor?: string;
      thumbnailDataURL?: string;
      fullresDataURL?: string;
    }) => {
      console.log('[useBatchSaveBanner] Saving to DB...', updates);
      const savedBanner = await bannerStorage.batchSave(id, updates);
      console.log('[useBatchSaveBanner] Save complete');
      return savedBanner;
    },
    onSuccess: async (savedBanner) => {
      console.log('[useBatchSaveBanner] 💾 Save successful.');
      if (savedBanner) {
        queryClient.setQueryData<Banner>(bannerKeys.detail(id), savedBanner);
        syncBannerIntoListCaches(queryClient, savedBanner);
      }

      // Refresh both standard banner lists and the Factory project list.
      console.log('[useBatchSaveBanner] 🔄 Invalidating banner and factory caches...');
      await invalidateBannerRelatedQueries(queryClient);
    },
  });
}

// Delete banner
export function useDeleteBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await bannerStorage.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: bannerKeys.detail(deletedId) });
      // Invalidate list
      void invalidateBannerRelatedQueries(queryClient);
    },
  });
}

// Duplicate banner
export function useDuplicateBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const duplicated = await bannerStorage.duplicate(id);
      return duplicated;
    },
    onSuccess: () => {
      void invalidateBannerRelatedQueries(queryClient);
    },
  });
}

// Update banner name
export function useUpdateBannerName(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newName: string) => {
      await bannerStorage.updateName(id, newName);
      return newName;
    },
    onMutate: async (newName) => {
      await queryClient.cancelQueries({ queryKey: bannerKeys.detail(id) });
      const previousBanner = queryClient.getQueryData<Banner>(bannerKeys.detail(id));

      if (previousBanner) {
        queryClient.setQueryData<Banner>(bannerKeys.detail(id), {
          ...previousBanner,
          name: newName,
        });
      }

      return { previousBanner };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousBanner) {
        queryClient.setQueryData(bannerKeys.detail(id), context.previousBanner);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.detail(id) });
      void invalidateBannerRelatedQueries(queryClient);
    },
  });
}


// Update public status
