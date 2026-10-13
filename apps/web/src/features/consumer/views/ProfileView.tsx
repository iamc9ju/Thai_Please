import { ChevronRight, LockKeyhole, MapPin, UserRound } from 'lucide-react';
import { th } from '../../../i18n/th';
import { PortalPageHeader } from '../components/PortalPageHeader';

type ProfileViewProps = Readonly<{
  displayName: string;
  maskedCitizenId: string;
  onPrototypeAction: () => void;
}>;

export function ProfileView({
  displayName,
  maskedCitizenId,
  onPrototypeAction,
}: ProfileViewProps) {
  const copy = th.consumerPortal.profile;
  return (
    <section className="consumer-view">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
      <div className="profile-layout">
        <article className="portal-card profile-card">
          <div className="profile-hero">
            <span>
              <UserRound aria-hidden="true" />
            </span>
            <div>
              <h2>{displayName}</h2>
              <p>{copy.roleValue}</p>
            </div>
          </div>
          <h3>{copy.identity}</h3>
          <dl>
            <div>
              <dt>{copy.name}</dt>
              <dd>{displayName}</dd>
            </div>
            <div>
              <dt>{copy.citizenId}</dt>
              <dd>{maskedCitizenId}</dd>
            </div>
            <div>
              <dt>{copy.phone}</dt>
              <dd>{copy.phoneValue}</dd>
            </div>
            <div>
              <dt>{copy.role}</dt>
              <dd>{copy.roleValue}</dd>
            </div>
          </dl>
        </article>
        <div className="profile-side-column">
          <article className="portal-card address-card">
            <MapPin aria-hidden="true" />
            <div>
              <h2>{copy.address}</h2>
              <p>{copy.addressValue}</p>
            </div>
          </article>
          <article className="portal-card settings-card">
            <div className="portal-card-heading">
              <h2>{copy.security}</h2>
              <LockKeyhole aria-hidden="true" />
            </div>
            {[copy.changePassword, copy.privacy, copy.terms].map((item) => (
              <button key={item} onClick={onPrototypeAction} type="button">
                <span>{item}</span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
}
