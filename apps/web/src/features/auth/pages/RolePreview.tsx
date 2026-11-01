import { ShieldCheck, Store } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { LoginRole } from '../auth.types';

type RolePreviewProps = Readonly<{
  role: Exclude<LoginRole, 'consumer'>;
  onBack: () => void;
}>;

export function RolePreview({ role, onBack }: RolePreviewProps) {
  const isMerchant = role === 'merchant';
  const Icon = isMerchant ? Store : ShieldCheck;

  return (
    <main className="role-preview">
      <section>
        <span aria-hidden="true">
          <Icon />
        </span>
        <h1>
          {isMerchant
            ? th.rolePreview.merchantTitle
            : th.rolePreview.administratorTitle}
        </h1>
        <p>{th.rolePreview.description}</p>
        <button onClick={onBack} type="button">
          {th.rolePreview.back}
        </button>
      </section>
    </main>
  );
}
