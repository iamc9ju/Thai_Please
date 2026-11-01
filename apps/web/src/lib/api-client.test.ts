import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError } from './api-client';

afterEach(() => vi.restoreAllMocks());

describe('API request cancellation (NFR-UI-02)', () => {
  it('preserves AbortError without logging a network failure', async () => {
    const error = new DOMException('Canceled request', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(apiClient.get('/test')).rejects.toBe(error);
    expect(log).not.toHaveBeenCalled();
  });

  it('preserves custom cancellation reasons from an aborted signal', async () => {
    const controller = new AbortController();
    const reason = new Error('Canceled by caller');
    controller.abort(reason);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(reason);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      apiClient.get('/test', { signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(log).not.toHaveBeenCalled();
  });

  it('still reports genuine network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Network unavailable'),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(apiClient.get('/test')).rejects.toThrow(
      'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง',
    );
    expect(log).toHaveBeenCalledOnce();
  });

  it('preserves permission failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );
    await expect(apiClient.get('/test')).rejects.toEqual(
      new ApiError(403, 'Forbidden'),
    );
  });
});
