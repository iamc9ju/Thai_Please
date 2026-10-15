import {
  Injectable,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { parseQuestPolicy } from './domain/quest-policy.js';
import { GeminiQuestProvider } from './gemini.provider.js';
import { buildQuestInput, type Candidate } from './quest-candidates.js';
import { QuestsRepository, type GenerationRun } from './quests.repository.js';
const PROVIDER_RETRY_DELAY_MS = 250;
const SAFE_PROVIDER_CODES = new Set([
  'QUEST_AI_INPUT_INVALID',
  'QUEST_AI_CONFIGURATION_UNAVAILABLE',
  'QUEST_AI_UNAVAILABLE',
  'QUEST_AI_INVALID_RESPONSE',
  'QUEST_AI_REQUEST_REJECTED',
  'QUEST_AI_QUOTA_EXCEEDED',
  'QUEST_AI_ACCESS_DENIED',
  'QUEST_AI_MODEL_NOT_FOUND',
  'QUEST_AI_TIMEOUT',
]);

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);
  private readonly policy = parseQuestPolicy(
    JSON.parse(
      readFileSync(
        new URL('./config/quest-policy.json', import.meta.url),
        'utf8',
      ),
    ) as unknown,
  );

  constructor(
    private readonly repository: QuestsRepository,
    private readonly provider: GeminiQuestProvider,
    private readonly config: ConfigService,
  ) {}

  private result(run: GenerationRun) {
    return {
      requestKey: run.request_key,
      status: run.status,
      reason: run.reason,
      assignmentId: run.assignment_id?.toString() ?? null,
    };
  }

  async generate(userId: bigint, actorId: bigint, key: string) {
    const asOf = new Date();
    const existing = await this.repository.replay(key, userId, actorId, asOf);
    if (existing) return this.result(existing);
    const history = await this.repository.history(userId, asOf, this.policy);
    const input = buildQuestInput(
      history.facts,
      history.catalog,
      history.prior,
      this.policy,
      asOf,
    );
    const targetIds = new Set(
      input.candidates.map((c) => c.targetId).filter((id) => id !== null),
    );
    const summary = {
      ...input.summary,
      categories: input.summary.categories.filter((s) => targetIds.has(s.id)),
      merchants: input.summary.merchants.filter((s) => targetIds.has(s.id)),
      products: input.summary.products.filter((s) => targetIds.has(s.id)),
      questHistory: {
        active: history.prior.filter(
          (q) => q.status === 'ACTIVE' && q.expiresAt > asOf,
        ).length,
        completed: history.prior.filter(
          (q) => q.completedAt !== null && q.completedAt < asOf,
        ).length,
        expired: history.prior.filter(
          (q) => q.completedAt === null && q.expiresAt <= asOf,
        ).length,
      },
    };
    const claim = await this.repository.claim({
      key,
      userId,
      actorId,
      now: asOf,
      policy: this.policy,
      model: this.config.get<string>('GEMINI_MODEL') || 'UNCONFIGURED',
      summary,
      candidates: input.candidates,
    });
    if (!claim.claimed) return this.result(claim.run);
    let scores: { candidateId: string; suitabilityScore: number }[];
    try {
      // Only minimized aggregates and approved candidate facts cross the AI boundary.
      scores = await this.rankWithRetry(summary, input.candidates);
    } catch (error: unknown) {
      const payload =
        error instanceof HttpException ? error.getResponse() : null;
      const reason =
        typeof payload === 'object' &&
        payload !== null &&
        'code' in payload &&
        typeof payload.code === 'string' &&
        SAFE_PROVIDER_CODES.has(payload.code)
          ? payload.code
          : 'PROVIDER_UNAVAILABLE_OR_INVALID';
      await this.repository.fail(key, reason, new Date());
      this.logger.warn({
        event: 'quest_generation_failed',
        correlationId: key,
        code: reason,
      });
      return {
        requestKey: key,
        status: 'FAILED',
        reason,
        assignmentId: null,
      };
    }
    const scoreMap = new Map(
      scores.map((s) => [s.candidateId, s.suitabilityScore]),
    );
    const compare = (a: Candidate, b: Candidate) => {
      const score = (scoreMap.get(b.id) ?? -1) - (scoreMap.get(a.id) ?? -1);
      if (score !== 0) return score;
      const aSpend = BigInt(a.minimumSpendMinor ?? '0');
      const bSpend = BigInt(b.minimumSpendMinor ?? '0');
      if (aSpend !== bSpend) return aSpend < bSpend ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    };
    const selected = [...input.candidates].sort(compare)[0];
    if (!selected) {
      await this.repository.fail(key, 'NO_CANDIDATES', new Date());
      return {
        requestKey: key,
        status: 'FAILED',
        reason: 'NO_CANDIDATES',
        assignmentId: null,
      };
    }
    const run = await this.repository.finalize(
      key,
      selected,
      { scores, selectedCandidateId: selected.id },
      this.policy,
      new Date(),
    );
    this.logger.log({
      event: 'quest_generation_finished',
      correlationId: key,
      status: run.status,
    });
    return this.result(run);
  }

  async list(userId: bigint, cursor?: bigint) {
    const items = await this.repository.list(userId, new Date(), cursor);
    return {
      items,
      nextCursor: items.length === 20 ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private async rankWithRetry(
    summary: unknown,
    candidates: readonly Candidate[],
  ) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.provider.rank(summary, candidates);
      } catch (error: unknown) {
        const response =
          error instanceof ServiceUnavailableException
            ? error.getResponse()
            : null;
        const retryable =
          typeof response === 'object' &&
          response !== null &&
          'code' in response &&
          (response.code === 'QUEST_AI_UNAVAILABLE' ||
            response.code === 'QUEST_AI_TIMEOUT');
        if (
          !retryable ||
          attempt >= this.policy.selection.maximumAttemptsPerGeneration
        )
          throw error;
        await new Promise<void>((resolve) =>
          setTimeout(resolve, PROVIDER_RETRY_DELAY_MS * attempt),
        );
      }
    }
  }
}
