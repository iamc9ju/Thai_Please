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
    <header className="portal-page-header">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}
