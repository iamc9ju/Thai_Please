type PortalPageHeaderProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function PortalPageHeader({
  eyebrow,
  title,
  description,
}: PortalPageHeaderProps) {
  return (
    <header className="space-y-1.5">
      <p className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/90 px-3 py-1 text-[11px] font-extrabold tracking-wider text-[#0056b3] uppercase">
        {eyebrow}
      </p>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h1>
      <span className="block text-xs sm:text-sm font-medium text-slate-500">
        {description}
      </span>
    </header>
  );
}
