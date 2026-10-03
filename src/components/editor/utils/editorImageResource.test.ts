import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEditorImageState, retryEditorImage, subscribeEditorImage } from './editorImageResource';

class FakeImage {
  static instances: FakeImage[] = [];
  src = '';
  onload: (() => Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn().mockResolvedValue(undefined);
  removeAttribute = vi.fn();
  constructor() { FakeImage.instances.push(this); }
}
const cleanups: (() => void)[] = [];
function subscribe(src: string) {
  const notify = vi.fn();
  const unsubscribe = subscribeEditorImage(src, notify);
  cleanups.push(unsubscribe);
  return { notify, unsubscribe };
}
afterEach(async () => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  await Promise.resolve();
  FakeImage.instances = [];
  vi.unstubAllGlobals();
});

describe('editor original-image lifecycle', () => {
  it('shares one request and waits for decoding before reporting ready', async () => {
    vi.stubGlobal('Image', FakeImage);
    const a = subscribe('original.png');
    const b = subscribe('original.png');
    expect(FakeImage.instances).toHaveLength(1);
    const image = FakeImage.instances[0];
    let decoded!: () => void;
    image.decode.mockImplementation(() => new Promise<void>(resolve => { decoded = resolve; }));
    const loaded = image.onload!();
    expect(getEditorImageState('original.png').status).toBe('loading');
    decoded(); await loaded;
    expect(getEditorImageState('original.png').image).toBe(image);
    expect(a.notify).toHaveBeenCalledOnce();
    expect(b.notify).toHaveBeenCalledOnce();
  });

  it('broadcasts failure and retry to both the renderer and feedback UI', async () => {
    vi.stubGlobal('Image', FakeImage);
    subscribe('retry.png'); subscribe('retry.png');
    FakeImage.instances[0].onerror!();
    expect(getEditorImageState('retry.png').status).toBe('error');
    retryEditorImage('retry.png');
    expect(getEditorImageState('retry.png').status).toBe('loading');
    expect(FakeImage.instances).toHaveLength(2);
    await FakeImage.instances[1].onload!();
    expect(getEditorImageState('retry.png').status).toBe('loaded');
  });

  it('reports decode failure rather than claiming pixels are ready', async () => {
    vi.stubGlobal('Image', FakeImage);
    subscribe('corrupt.png');
    FakeImage.instances[0].decode.mockRejectedValue(new Error('Invalid image'));
    await FakeImage.instances[0].onload!();
    expect(getEditorImageState('corrupt.png').status).toBe('error');
  });

  it('releases unused images and ignores late decoding after unmount', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { unsubscribe, notify } = subscribe('old.png');
    const image = FakeImage.instances[0];
    let decoded!: () => void;
    image.decode.mockImplementation(() => new Promise<void>(resolve => { decoded = resolve; }));
    const load = image.onload!();
    unsubscribe(); await Promise.resolve();
    decoded(); await load;
    expect(notify).not.toHaveBeenCalled();
    expect(image.removeAttribute).toHaveBeenCalledWith('src');
    subscribe('old.png');
    expect(FakeImage.instances).toHaveLength(2);
  });

  it('does not restart requests during strict-mode resubscription', () => {
    vi.stubGlobal('Image', FakeImage);
    subscribe('strict.png').unsubscribe();
    subscribe('strict.png');
    expect(FakeImage.instances).toHaveLength(1);
  });
});
