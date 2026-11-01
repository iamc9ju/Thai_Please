import type { QuestGenerationLogItem } from '../admin.types';
import { adminManagementCopy as copy } from '../admin-management.copy';

export function QuestGenerationDetails({
  log,
}: {
  log: QuestGenerationLogItem;
}) {
  const proposal = log.proposal;
  const hasAssignmentEvidence =
    log.validationResult?.status === 'ACCEPTED' &&
    log.validationResult.evidence === 'ASSIGNED_QUEST_RULE';
  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer text-xs font-semibold text-brand-strong">
        {copy.logDetails}
      </summary>
      <div className="mt-3 space-y-4 text-xs">
        <section aria-label={copy.proposal}>
          <h4 className="font-bold">{copy.proposal}</h4>
          {proposal ? (
            <div className="mt-2 rounded-xl bg-panel p-3">
              <p className="font-semibold">{proposal.questName}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-muted">{copy.ruleType}</dt>
                  <dd>{proposal.questType}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.minimumSpend}</dt>
                  <dd>{proposal.minSpend.toLocaleString('th-TH')}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.rewardPoints}</dt>
                  <dd>{proposal.rewardPoint.toLocaleString('th-TH')}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.durationDays}</dt>
                  <dd>{proposal.durationDays}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-1 text-muted">{copy.noProposal}</p>
          )}
        </section>
        <section aria-label={copy.validation}>
          <h4 className="font-bold">{copy.validation}</h4>
          <p className="mt-1 text-muted">
            {hasAssignmentEvidence
              ? copy.assignmentEvidence
              : copy.noValidation}
          </p>
          <p className="mt-1 leading-relaxed text-muted">
            {copy.validationHint}
          </p>
        </section>
        {log.candidates && log.candidates.length > 0 && (
          <section aria-label={copy.candidates}>
            <h4 className="font-bold">{copy.candidates}</h4>
            <ul className="mt-2 space-y-2">
              {log.candidates.map((candidate, index) => (
                <li
                  key={`${index}-${candidate.questName}`}
                  className="rounded-xl bg-panel p-3"
                >
                  <p>{candidate.questName}</p>
                  <p className="mt-1 text-muted">
                    {copy.ruleType}: {candidate.questType} · {copy.minimumSpend}
                    : {candidate.minSpend.toLocaleString('th-TH')} ·{' '}
                    {copy.rewardPoints}:{' '}
                    {candidate.rewardPoint.toLocaleString('th-TH')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
