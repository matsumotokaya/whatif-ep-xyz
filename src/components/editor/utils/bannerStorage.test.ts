import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner } from '../types/template';
import { getSupabase } from './supabase';
import { deleteAssets, uploadAsset } from './r2Upload';
import { bannerStorage } from './bannerStorage';

vi.mock('./supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('./r2Upload', () => ({ uploadAsset: vi.fn(), deleteAssets: vi.fn() }));

const DATA_URL = 'data:image/jpeg;base64,AA==';
const SAVED_BANNER = { id: 'banner-1' } as Banner;

function mockSupabase() {
  const single = vi.fn().mockResolvedValue({
    data: {
      thumbnail_key: null,
      thumbnail_url: null,
      fullres_key: null,
      fullres_url: null,
    },
    error: null,
  });
  const eq = vi.fn();
  eq.mockReturnValue({ eq, single });
  const select = vi.fn().mockReturnValue({ eq });

  vi.mocked(getSupabase).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn().mockReturnValue({ select }),
  } as never);
}

describe('bannerStorage.batchSave preview snapshot', () => {
  beforeEach(() => {
    mockSupabase();
    vi.mocked(deleteAssets).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads thumbnail and fullres concurrently, then commits both keys once', async () => {
    const resolvers: Array<() => void> = [];
    vi.mocked(uploadAsset).mockImplementation(
      (key) => new Promise((resolve) => resolvers.push(() => resolve(key))),
    );
    const update = vi.spyOn(bannerStorage, 'update').mockResolvedValue(SAVED_BANNER);

    const save = bannerStorage.batchSave('banner-1', {
      elements: [],
      canvasColor: '#808080',
      thumbnailDataURL: DATA_URL,
      fullresDataURL: DATA_URL,
    });

    await vi.waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(2));
    expect(update).not.toHaveBeenCalled();

    resolvers.forEach((resolve) => resolve());
    await expect(save).resolves.toBe(SAVED_BANNER);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('banner-1', {
      elements: [],
      canvasColor: '#808080',
      thumbnailKey: expect.stringMatching(/^user-images\/user-1\/banners\/banner-1\/thumb\//),
      fullresKey: expect.stringMatching(/^user-images\/user-1\/banners\/banner-1\/full\//),
    });
  });

  it('removes a successful sibling upload and skips the DB commit when either upload fails', async () => {
    vi.mocked(uploadAsset)
      .mockImplementationOnce(async (key) => key)
      .mockRejectedValueOnce(new Error('fullres upload failed'));
    const update = vi.spyOn(bannerStorage, 'update').mockResolvedValue(SAVED_BANNER);

    await expect(
      bannerStorage.batchSave('banner-1', {
        elements: [],
        canvasColor: '#808080',
        thumbnailDataURL: DATA_URL,
        fullresDataURL: DATA_URL,
      }),
    ).rejects.toThrow('fullres upload failed');

    expect(update).not.toHaveBeenCalled();
    expect(deleteAssets).toHaveBeenCalledTimes(1);
    expect(deleteAssets).toHaveBeenCalledWith([
      expect.stringMatching(/^user-images\/user-1\/banners\/banner-1\/thumb\//),
    ]);
  });
});
