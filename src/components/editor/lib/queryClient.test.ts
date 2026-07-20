import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getEditorQueryClient } from './queryClient';

describe('getEditorQueryClient', () => {
  beforeAll(() => {
    vi.stubGlobal('window', {});
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('shares cache state across editor islands for the same user', () => {
    const editorClient = getEditorQueryClient('user:cache-regression');
    editorClient.setQueryData(['production-projects', 'list', 'recent', 48], [
      { thumbnailUrl: null },
    ]);

    const factoryClient = getEditorQueryClient('user:cache-regression');
    expect(factoryClient).toBe(editorClient);
    expect(factoryClient.getQueryData(['production-projects', 'list', 'recent', 48])).toEqual([
      { thumbnailUrl: null },
    ]);
  });

  it('makes factory invalidation visible to every island in the same scope', async () => {
    const editorClient = getEditorQueryClient('user:invalidation-regression');
    const key = ['production-projects', 'list', 'recent', 48] as const;
    editorClient.setQueryData(key, [{ thumbnailUrl: null }]);

    await editorClient.invalidateQueries({ queryKey: ['production-projects', 'list'] });

    const factoryClient = getEditorQueryClient('user:invalidation-regression');
    expect(factoryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it('clears private cache state when the authenticated user changes', () => {
    const firstUserClient = getEditorQueryClient('user:first-account');
    firstUserClient.setQueryData(['banners', 'detail', 'private-banner'], {
      id: 'private-banner',
    });

    const secondUserClient = getEditorQueryClient('user:second-account');

    expect(secondUserClient).not.toBe(firstUserClient);
    expect(firstUserClient.getQueryData(['banners', 'detail', 'private-banner'])).toBeUndefined();
    expect(secondUserClient.getQueryData(['banners', 'detail', 'private-banner'])).toBeUndefined();
  });
});
