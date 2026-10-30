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

      {/* Centered Modal Dialog (Thai Please Theme) */}
      {toasts.length > 0 && (
        <aside aria-label="การแจ้งเตือนระบบ">
          <ToastItem toast={toasts[0]!} onDismiss={dismissToast} />
        </aside>
      )}
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
