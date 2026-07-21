import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner } from '../types/template';
import { getSupabase } from './supabase';
import { deleteAssets, uploadAsset } from './r2Upload';
import { bannerStorage } from './bannerStorage';

vi.mock('./supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('./r2Upload', () => ({ uploadAsset: vi.fn(), deleteAssets: vi.fn() }));

const DATA_URL = 'data:image/jpeg;base64,AA==';
const BASE_ROW = {
  id: 'banner-1',
  user_id: 'user-1',
  name: 'Banner',
  template: { id: 'template-1', name: 'Template', width: 100, height: 100 },
  elements: [],
  canvas_color: '#808080',
  thumbnail_key: null,
  thumbnail_url: null,
  fullres_key: null,
  fullres_url: null,
  preview_status: 'pending',
  preview_source: 'none',
  preview_error: null,
  document_revision: 2,
  preview_revision: 0,
  preview_requested_at: '2026-07-20T00:00:00.000Z',
  preview_completed_at: null,
  created_at: '2026-07-20T00:00:00.000Z',
  updated_at: '2026-07-20T00:00:00.000Z',
};

function mockRevisionSupabase(options: {
  finalizeData?: typeof BASE_ROW | null;
} = {}) {
  const documentMaybeSingle = vi.fn().mockResolvedValue({ data: BASE_ROW, error: null });
  const finalizeMaybeSingle = vi.fn().mockResolvedValue({
    data: options.finalizeData === undefined
      ? {
          ...BASE_ROW,
          thumbnail_key: 'user-images/user-1/banners/banner-1/thumb/2-current.jpg',
          fullres_key: 'user-images/user-1/banners/banner-1/full/2-current.jpg',
          preview_status: 'ready',
          preview_source: 'generated',
          preview_revision: 2,
        }
      : options.finalizeData,
    error: null,
  });
  const failureMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      ...BASE_ROW,
      preview_status: 'failed',
      preview_error: 'fullres upload failed',
    },
    error: null,
  });
  const rpc = vi.fn((name: string) => {
    if (name === 'save_banner_document') return { maybeSingle: documentMaybeSingle };
    if (name === 'finalize_banner_preview') return { maybeSingle: finalizeMaybeSingle };
    if (name === 'fail_banner_preview') return { maybeSingle: failureMaybeSingle };
    throw new Error(`Unexpected RPC: ${name}`);
  });

  vi.mocked(getSupabase).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    rpc,
  } as never);

  return { rpc, documentMaybeSingle, finalizeMaybeSingle, failureMaybeSingle };
}

describe('bannerStorage.batchSave revisioned preview snapshot', () => {
  beforeEach(() => {
    vi.mocked(deleteAssets).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('commits the document revision, uploads concurrently, then finalizes that revision', async () => {
    const { rpc, finalizeMaybeSingle } = mockRevisionSupabase();
    const resolvers: Array<() => void> = [];
    vi.mocked(uploadAsset).mockImplementation(
      (key) => new Promise((resolve) => resolvers.push(() => resolve(key))),
    );

    const save = bannerStorage.batchSave('banner-1', {
      elements: [],
      canvasColor: '#808080',
      thumbnailDataURL: DATA_URL,
      fullresDataURL: DATA_URL,
    });

    await vi.waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(2));
    expect(finalizeMaybeSingle).not.toHaveBeenCalled();

    resolvers.forEach((resolve) => resolve());
    await expect(save).resolves.toMatchObject({
      id: 'banner-1',
      documentRevision: 2,
      previewRevision: 2,
      previewStatus: 'ready',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'save_banner_document', {
      p_banner_id: 'banner-1',
      p_elements: [],
      p_canvas_color: '#808080',
      p_template: null,
    });
    expect(uploadAsset).toHaveBeenCalledWith(
      expect.stringMatching(/\/thumb\/2-/),
      expect.any(Blob),
      'image/jpeg',
    );
    expect(rpc).toHaveBeenCalledWith('finalize_banner_preview', {
      p_banner_id: 'banner-1',
      p_document_revision: 2,
      p_thumbnail_key: expect.stringMatching(/\/thumb\/2-/),
      p_fullres_key: expect.stringMatching(/\/full\/2-/),
    });
  });

  it('records a revision failure and removes a successful sibling upload', async () => {
    const { rpc, finalizeMaybeSingle } = mockRevisionSupabase();
    vi.mocked(uploadAsset)
      .mockImplementationOnce(async (key) => key)
      .mockRejectedValueOnce(Object.assign(new Error('fullres upload failed'), { code: 'upload_failed' }));

    await expect(
      bannerStorage.batchSave('banner-1', {
        elements: [],
        canvasColor: '#808080',
        thumbnailDataURL: DATA_URL,
        fullresDataURL: DATA_URL,
      }),
    ).resolves.toMatchObject({
      previewStatus: 'failed',
      previewError: 'fullres upload failed',
      documentRevision: 2,
    });

    expect(finalizeMaybeSingle).not.toHaveBeenCalled();
    expect(deleteAssets).toHaveBeenCalledWith([
      expect.stringMatching(/\/thumb\/2-/),
    ]);
    expect(rpc).toHaveBeenCalledWith('fail_banner_preview', {
      p_banner_id: 'banner-1',
      p_document_revision: 2,
      p_error: 'fullres upload failed',
    });
  });

  it('rejects and removes a completed preview when a newer document revision wins', async () => {
    mockRevisionSupabase({ finalizeData: null });
    vi.mocked(uploadAsset).mockImplementation(async (key) => key);
    vi.spyOn(bannerStorage, 'getById').mockResolvedValue({
      id: 'banner-1',
      documentRevision: 3,
    } as Banner);

    await expect(
      bannerStorage.batchSave('banner-1', {
        elements: [],
        canvasColor: '#808080',
        thumbnailDataURL: DATA_URL,
        fullresDataURL: DATA_URL,
      }),
    ).resolves.toMatchObject({ documentRevision: 3 });

    expect(deleteAssets).toHaveBeenCalledWith([
      expect.stringMatching(/\/thumb\/2-/),
      expect.stringMatching(/\/full\/2-/),
    ]);
  });

  it('uses the narrow legacy path only when the revision RPC is not deployed', async () => {
    const missingRpcMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'function not found' },
    });
    const rpc = vi.fn().mockReturnValue({ maybeSingle: missingRpcMaybeSingle });
    const existingSingle = vi.fn().mockResolvedValue({
      data: {
        thumbnail_key: null,
        thumbnail_url: null,
        fullres_key: null,
        fullres_url: null,
      },
      error: null,
    });
    const existingEq = vi.fn();
    existingEq.mockReturnValue({ eq: existingEq, single: existingSingle });
    const selectExisting = vi.fn().mockReturnValue({ eq: existingEq });

    const savedSingle = vi.fn().mockResolvedValue({
      data: {
        ...BASE_ROW,
        document_revision: undefined,
        preview_revision: undefined,
        preview_status: undefined,
        thumbnail_key: 'user-images/user-1/banners/banner-1/thumb/legacy.jpg',
        fullres_key: 'user-images/user-1/banners/banner-1/full/legacy.jpg',
      },
      error: null,
    });
    const selectSaved = vi.fn().mockReturnValue({ single: savedSingle });
    const updateEq = vi.fn();
    updateEq.mockReturnValue({ eq: updateEq, select: selectSaved });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const from = vi.fn().mockReturnValue({ select: selectExisting, update });

    vi.mocked(getSupabase).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      rpc,
      from,
    } as never);
    vi.mocked(uploadAsset).mockImplementation(async (key) => key);

    await expect(
      bannerStorage.batchSave('banner-1', {
        elements: [],
        canvasColor: '#808080',
        thumbnailDataURL: DATA_URL,
        fullresDataURL: DATA_URL,
      }),
    ).resolves.toMatchObject({ previewStatus: 'ready' });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      elements: [],
      canvas_color: '#808080',
      thumbnail_key: expect.stringMatching(/\/thumb\//),
      fullres_key: expect.stringMatching(/\/full\//),
    });
  });
});

describe('bannerStorage.getAll preview metadata rollout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries the legacy projection when preview columns are not deployed', async () => {
    const makeBuilder = (result: unknown) => {
      const builder = {
        order: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      builder.order.mockReturnValue(builder);
      return builder;
    };
    const missingColumns = makeBuilder({
      data: null,
      error: { code: '42703', message: 'column banners.preview_status does not exist' },
    });
    const legacyRows = makeBuilder({
      data: [{
        ...BASE_ROW,
        preview_status: undefined,
        preview_source: undefined,
        preview_error: undefined,
        thumbnail_key: 'user-images/user-1/banners/banner-1/thumb/current.jpg',
      }],
      error: null,
    });
    const select = vi.fn()
      .mockReturnValueOnce(missingColumns)
      .mockReturnValueOnce(legacyRows);
    vi.mocked(getSupabase).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    await expect(bannerStorage.getAll(false)).resolves.toEqual([
      expect.objectContaining({
        id: 'banner-1',
        previewStatus: 'ready',
        previewSource: 'generated',
      }),
    ]);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('does not fall back to template thumbnails when the banner preview is missing', async () => {
    const rows = [{
      ...BASE_ROW,
      thumbnail_key: null,
      thumbnail_url: null,
      template: {
        id: 'template-1',
        name: 'Template',
        width: 100,
        height: 100,
        thumbnail: 'https://example.com/template.jpg',
      },
    }];
    const makeBuilder = (result: unknown) => {
      const builder = {
        order: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      builder.order.mockReturnValue(builder);
      return builder;
    };
    const builder = makeBuilder({ data: rows, error: null });
    const select = vi.fn().mockReturnValue(builder);
    vi.mocked(getSupabase).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    await expect(bannerStorage.getAll(false)).resolves.toEqual([
      expect.objectContaining({
        id: 'banner-1',
        thumbnailUrl: undefined,
        previewStatus: 'pending',
        previewSource: 'none',
      }),
    ]);
  });
});

describe('bannerStorage.duplicate preview cloning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('duplicates preview assets onto the new banner and removes template thumbnail fallback', async () => {
    vi.clearAllMocks();
    const originalFetch = global.fetch;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(new Blob(['thumb'], { type: 'image/jpeg' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(['full'], { type: 'image/png' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('banner-2');
    vi.spyOn(bannerStorage, 'getById').mockResolvedValue({
      id: 'banner-1',
      name: 'Banner',
      template: {
        id: 'template-1',
        name: 'Template',
        width: 100,
        height: 100,
        thumbnail: 'https://example.com/template.jpg',
      },
      elements: [],
      canvasColor: '#808080',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      fullresUrl: 'https://example.com/full.png',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    } as Banner);
    vi.mocked(uploadAsset)
      .mockImplementationOnce(async (key) => key)
      .mockImplementationOnce(async (key) => key);

    let insertedRow: Record<string, unknown> | undefined;
    const single = vi.fn().mockImplementation(async () => ({
      data: {
        ...BASE_ROW,
        id: 'banner-2',
        name: 'Banner (Copy)',
        template: insertedRow?.template,
        thumbnail_key: insertedRow?.thumbnail_key ?? null,
        fullres_key: insertedRow?.fullres_key ?? null,
        preview_status: undefined,
        preview_source: undefined,
        preview_error: undefined,
      },
      error: null,
    }));
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn((row: Record<string, unknown>) => {
      insertedRow = row;
      return { select };
    });
    const from = vi.fn().mockReturnValue({ insert });
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(getSupabase).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      rpc,
      from,
    } as never);

    await expect(bannerStorage.duplicate('banner-1')).resolves.toMatchObject({
      id: 'banner-2',
      previewStatus: 'ready',
    });

    expect(rpc).toHaveBeenCalledWith('increment_display_orders', { p_user_id: 'user-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(uploadAsset).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/user-images\/user-1\/banners\/banner-2\/thumb\//),
      expect.any(Blob),
      'image/jpeg',
    );
    expect(uploadAsset).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/user-images\/user-1\/banners\/banner-2\/full\//),
      expect.any(Blob),
      'image/png',
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'banner-2',
      thumbnail_key: expect.stringMatching(/user-images\/user-1\/banners\/banner-2\/thumb\//),
      fullres_key: expect.stringMatching(/user-images\/user-1\/banners\/banner-2\/full\//),
    }));
    expect(insertedRow?.template).toEqual({
      id: 'template-1',
      name: 'Template',
      width: 100,
      height: 100,
    });

    vi.stubGlobal('fetch', originalFetch);
  });
});
