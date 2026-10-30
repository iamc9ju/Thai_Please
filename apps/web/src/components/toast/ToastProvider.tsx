import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ToastItem, type ToastMessage } from './ToastItem';

export interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'> & { id?: string }) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'> & { id?: string }) => {
      const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastMessage = { ...toast, id };

      setToasts((prev) => {
        // Limit to 4 toasts stacked at once
        const updated = [newToast, ...prev.filter((t) => t.id !== id)];
        return updated.slice(0, 4);
      });

      return id;
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      toasts,
      showToast,
      dismissToast,
      clearAllToasts,
    }),
    [toasts, showToast, dismissToast, clearAllToasts],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Floating Stacked Viewport (blocks.so style) */}
      <aside
        aria-label="การแจ้งเตือนระบบ"
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex w-full max-w-sm sm:max-w-md flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

const fallbackContext: ToastContextValue = {
  toasts: [],
  showToast: () => '',
  dismissToast: () => {},
  clearAllToasts: () => {},
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? fallbackContext;
}
