import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLatestRequest } from './use-latest-request';

afterEach(cleanup);

describe('read lifecycle (NFR-UI-01)', () => {
  it('invalidates previous reads and keeps the newest read current', () => {
    const { result, unmount } = renderHook(useLatestRequest);
    const first = result.current();
    const second = result.current();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
    unmount();
    expect(second.signal.aborted).toBe(true);
    expect(second.isCurrent()).toBe(false);
  });

  it('keeps the start function stable under StrictMode rerenders', () => {
    const { result, rerender } = renderHook(useLatestRequest, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });
    const start = result.current;
    act(() => rerender());
    expect(result.current).toBe(start);
    expect(result.current().isCurrent()).toBe(true);
  });
});
