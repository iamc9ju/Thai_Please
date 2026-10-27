import { useCallback, useEffect, useRef } from 'react';

/** Owns a page's read requests; superseded reads cannot publish UI state. */
export function useLatestRequest() {
  const currentController = useRef<AbortController | null>(null);

  useEffect(() => () => currentController.current?.abort(), []);

  return useCallback(() => {
    currentController.current?.abort();
    const controller = new AbortController();
    currentController.current = controller;
    return {
      signal: controller.signal,
      isCurrent: () => !controller.signal.aborted,
    };
  }, []);
}
