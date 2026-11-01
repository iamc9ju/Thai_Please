import { ShieldCheck, Store, UserRound, type LucideIcon } from 'lucide-react';
import { th } from '../../../i18n/th';
import { LOGIN_ROLES, type LoginRole } from '../auth.types';

const roleIcons: Record<LoginRole, LucideIcon> = {
  consumer: UserRound,
  merchant: Store,
  administrator: ShieldCheck,
};

type RoleSelectorProps = Readonly<{
  role: LoginRole;
  onChange: (role: LoginRole) => void;
}>;

export function RoleSelector({ role, onChange }: RoleSelectorProps) {
  return (
    <div className="role-selector" aria-label={th.login.role.label}>
      {LOGIN_ROLES.map((loginRole) => {
        const RoleIcon = roleIcons[loginRole];

        return (
          <button
            aria-pressed={role === loginRole}
            className={role === loginRole ? 'is-active' : ''}
            key={loginRole}
            onClick={() => onChange(loginRole)}
            type="button"
          >
            <RoleIcon aria-hidden="true" className="role-icon" />
            {th.login.role.options[loginRole]}
          </button>
        );
      })}
    </div>
  );
}
