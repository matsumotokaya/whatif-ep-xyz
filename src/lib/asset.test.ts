import { describe, expect, it } from 'vitest';
import { resolveElementSrc } from './asset';

describe('resolveElementSrc', () => {
  it('passes inline data through untouched, even with a version and CORS mode', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const blobUrl = 'blob:http://localhost:3710/0b6f2c1e-0000-4000-8000-000000000000';
    expect(resolveElementSrc(dataUrl, '2026-10-18')).toBe(dataUrl);
    expect(resolveElementSrc(blobUrl)).toBe(blobUrl);
  });

  it('still versions stored keys for the anonymous-CORS cache partition', () => {
    expect(resolveElementSrc('user-images/u/uploads/a.png')).toMatch(/\/user-images\/u\/uploads\/a\.png\?v=cors-anon-v1$/);
  });
});
