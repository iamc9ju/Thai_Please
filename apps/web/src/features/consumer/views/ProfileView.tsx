import { useCallback, useEffect, useState } from 'react';
import type { ConsumerProfileResponse } from '@thai-please/contracts';
import { ApiError } from '../../../lib/api-client';
import { useLatestRequest } from '../../../lib/use-latest-request';
import { LoadingState } from '../../../components/LoadingState';
import { getConsumerProfile } from '../api/profile.api';
import { ChevronRight, LockKeyhole, MapPin, UserRound } from 'lucide-react';
import { th } from '../../../i18n/th';
import { PortalPageHeader } from '../components/PortalPageHeader';

type ProfileState =
  | { status: 'loading' | 'error' | 'permission-denied' }
  | { status: 'success'; data: ConsumerProfileResponse };

export function ProfileView() {
  const copy = th.consumerPortal.profile;
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const beginRequest = useLatestRequest();
  const load = useCallback(async () => {
    const request = beginRequest();
    try {
      const data = await getConsumerProfile(request.signal);
      if (request.isCurrent()) setState({ status: 'success', data });
    } catch (error) {
      if (request.isCurrent())
        setState({
          status:
            error instanceof ApiError &&
            (error.status === 401 || error.status === 403)
              ? 'permission-denied'
              : 'error',
        });
    }
  }, [beginRequest]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="consumer-view">
      <PortalPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
      {state.status === 'loading' && <LoadingState label={copy.loading} />}
      {(state.status === 'error' || state.status === 'permission-denied') && (
        <div className="portal-card" role="alert">
          <p>
            {state.status === 'permission-denied'
              ? copy.permissionDenied
              : copy.loadError}
          </p>
          {state.status === 'error' && (
            <button
              type="button"
              onClick={() => {
                setState({ status: 'loading' });
                void load();
              }}
            >
              {copy.retry}
            </button>
          )}
        </div>
      )}
      {state.status === 'success' && (
        <div className="profile-layout">
          <article className="portal-card profile-card">
            <div className="profile-hero">
              <span>
                <UserRound aria-hidden="true" />
              </span>
              <div>
                <h2>{state.data.fullName}</h2>
                <p>{copy.roleValue}</p>
              </div>
            </div>
            <h3>{copy.identity}</h3>
            <dl>
              <div>
                <dt>{copy.name}</dt>
                <dd>{state.data.fullName}</dd>
              </div>
              <div>
                <dt>{copy.citizenId}</dt>
                <dd>{state.data.maskedCitizenId}</dd>
              </div>
              <div>
                <dt>{copy.phone}</dt>
                <dd>{state.data.phone || copy.notProvided}</dd>
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
                <p>{state.data.address || copy.notProvided}</p>
              </div>
            </article>
            <article className="portal-card settings-card">
              <div className="portal-card-heading">
                <h2>{copy.security}</h2>
                <LockKeyhole aria-hidden="true" />
              </div>
              <p>{copy.settingsUnavailable}</p>
              {[copy.changePassword, copy.privacy, copy.terms].map((item) => (
                <button key={item} disabled type="button">
                  <span>{item}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
