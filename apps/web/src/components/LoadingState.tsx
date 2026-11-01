export type LoadingStateVariant =
  'compact' | 'dashboard' | 'cards' | 'table' | 'profile';

interface LoadingStateProps {
  label: string;
  variant?: LoadingStateVariant;
}

const skeletonBlock =
  'motion-safe:animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-700/60';

function CompactSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className={`${skeletonBlock} mx-auto mb-4 size-14 rounded-full`} />
      <div className={`${skeletonBlock} mx-auto mb-3 h-5 w-2/5`} />
      <div className={`${skeletonBlock} mx-auto h-3 w-3/5`} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className={`${skeletonBlock} mb-4 size-10`} />
            <div className={`${skeletonBlock} mb-2 h-3 w-2/3`} />
            <div className={`${skeletonBlock} h-7 w-1/2`} />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <div className={`${skeletonBlock} mb-5 h-5 w-2/5`} />
            <div className={`${skeletonBlock} mb-3 h-28 w-full`} />
            <div className={`${skeletonBlock} h-3 w-3/4`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-hidden">
        <div className={`${skeletonBlock} h-9 w-24 shrink-0`} />
        <div className={`${skeletonBlock} h-9 w-32 shrink-0`} />
        <div className={`${skeletonBlock} h-9 w-28 shrink-0`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className={`${skeletonBlock} mb-4 h-36 w-full`} />
            <div className={`${skeletonBlock} mb-2 h-4 w-3/4`} />
            <div className={`${skeletonBlock} mb-4 h-3 w-1/2`} />
            <div className={`${skeletonBlock} h-9 w-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
        <div className={`${skeletonBlock} h-9 w-44`} />
        <div className={`${skeletonBlock} h-9 w-28`} />
      </div>
      <div className="divide-y divide-slate-100 px-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-4">
            <div className={`${skeletonBlock} size-10 shrink-0 rounded-full`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`${skeletonBlock} h-4 w-2/3`} />
              <div className={`${skeletonBlock} h-3 w-2/5`} />
            </div>
            <div className={`${skeletonBlock} h-6 w-20 shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className={`${skeletonBlock} mx-auto mb-4 size-24 rounded-full`} />
        <div className={`${skeletonBlock} mx-auto mb-2 h-5 w-2/3`} />
        <div className={`${skeletonBlock} mx-auto h-3 w-1/2`} />
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
        <div className={`${skeletonBlock} h-5 w-1/3`} />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className={`${skeletonBlock} h-3 w-1/4`} />
            <div className={`${skeletonBlock} h-10 w-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}

const skeletonByVariant = {
  compact: CompactSkeleton,
  dashboard: DashboardSkeleton,
  cards: CardsSkeleton,
  table: TableSkeleton,
  profile: ProfileSkeleton,
};

export function LoadingState({
  label,
  variant = 'compact',
}: Readonly<LoadingStateProps>) {
  const Skeleton = skeletonByVariant[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading-variant={variant}
      className="w-full space-y-3"
    >
      <p className="text-center text-sm font-medium text-muted">{label}</p>
      <div aria-hidden="true">
        <Skeleton />
      </div>
    </div>
  );
}
