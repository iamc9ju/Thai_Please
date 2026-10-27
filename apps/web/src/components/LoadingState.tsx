export function LoadingState({ label }: Readonly<{ label: string }>) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-panel p-12 text-center shadow-sm"
    >
      <span
        aria-hidden="true"
        className="size-8 rounded-full border-3 border-loading border-r-transparent motion-safe:animate-spin"
      />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
