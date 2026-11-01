type PortalPageHeaderProps = Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
}>;

const REQUIREMENT_CODE_PATTERN = /^(FR|NFR|BR)-[A-Z0-9\s·•,-]+$/i;

export function PortalPageHeader({
  eyebrow,
  title,
  description,
}: PortalPageHeaderProps) {
  const showEyebrow =
    Boolean(eyebrow?.trim()) &&
    !REQUIREMENT_CODE_PATTERN.test(eyebrow?.trim() ?? '');

  return (
    <header className="mb-5 space-y-1">
      {showEyebrow && (
        <p className="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50/90 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-[#0056b3] uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h1>
      <span className="block text-xs sm:text-sm font-medium text-slate-500">
        {description}
      </span>
    </header>
  );
}
