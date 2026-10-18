import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), create: vi.fn(), invalidate: vi.fn(),
  getTemplate: vi.fn(), count: vi.fn(),
}));
const client = new QueryClient();
vi.mock('react', () => ({ useCallback: (fn: unknown) => fn }));
vi.mock('@tanstack/react-query', async original => ({
  ...await original<typeof import('@tanstack/react-query')>(), useQueryClient: () => client,
}));
vi.mock('@/components/editor/lib/router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, profileLoading: false, hasPremiumAccess: true }) }));
vi.mock('../utils/bannerStorage', () => ({ bannerStorage: { createFromTemplate: mocks.create } }));
vi.mock('../utils/templateStorage', () => ({ templateStorage: { getById: mocks.getTemplate, incrementOpenCount: mocks.count } }));
vi.mock('./useBanners', () => ({
  bannerKeys: { detail: (id: string) => ['banners', 'detail', id] },
  invalidateBannerCollectionQueries: mocks.invalidate,
}));
import { useOpenTemplate } from './useOpenTemplate';

function OpenTemplateHarness() {
  return useOpenTemplate({ onUpgradeRequired: vi.fn(), onGuestConflict: vi.fn() });
}
describe('template-to-editor handoff', () => {
  it('hands off the returned document without waiting for a slow list refresh', async () => {
    const created = { id: 'created', elements: [], name: 'Test' };
    mocks.create.mockResolvedValue(created);
    let finishRefresh!: () => void;
    mocks.invalidate.mockReturnValue(new Promise<void>(resolve => { finishRefresh = resolve; }));
    const open = OpenTemplateHarness();
    const result = open({ id: 'template', name: 'Test', canvasColor: '#fff', elements: [] });
    // Flush the creation continuation; the list request remains unresolved.
    await Promise.resolve();
    expect(mocks.navigate).toHaveBeenCalledWith('/edit/created');
    expect(client.getQueryData(['banners', 'detail', 'created'])).toEqual(created);
    const refetch = vi.fn();
    await client.fetchQuery({ queryKey: ['banners', 'detail', 'created'], queryFn: refetch, staleTime: 300000 });
    expect(refetch).not.toHaveBeenCalled();
    finishRefresh();
    await result;
    client.clear();
  });
});
