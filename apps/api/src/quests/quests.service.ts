import {
  Injectable,
  HttpException,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { parseQuestPolicy } from './domain/quest-policy.js';
import { GeminiQuestProvider } from './gemini.provider.js';
import type { Candidate } from './quest-candidates.js';
import {
  buildProposalSummary,
  proposalRules,
  validateProposals,
  type Proposal,
} from './quest-proposals.js';
import { QuestsRepository } from './quests.repository.js';

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
function providerCode(error: unknown): string {
  const payload = error instanceof HttpException ? error.getResponse() : null;
  return typeof payload === 'object' &&
    payload !== null &&
    'code' in payload &&
    typeof payload.code === 'string' &&
    SAFE_PROVIDER_CODES.has(payload.code)
    ? payload.code
    : 'QUEST_AI_UNAVAILABLE';
}

@Injectable()
export class QuestsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuestsService.name);
  private readonly policy = parseQuestPolicy(
    JSON.parse(
      readFileSync(
        new URL('./config/quest-policy.json', import.meta.url),
        'utf8',
      ),
    ) as unknown,
  );
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  private stopping = false;
  private storageUnavailableLogged = false;

  constructor(
    private readonly repository: QuestsRepository,
    private readonly provider: GeminiQuestProvider,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Logs are the durable queue; transactional claiming owns each job.
    this.timer = setInterval(
      () => this.wake(),
      this.policy.proposals.workerPollMilliseconds,
    );
    this.timer.unref();
    this.wake();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  private wake() {
    if (this.stopping || this.running) return;
    this.running = this.processNextGeneration()
      .then(() => {
        this.storageUnavailableLogged = false;
      })
      .catch(() => {
        if (!this.storageUnavailableLogged) {
          this.storageUnavailableLogged = true;
          this.logger.error({
            event: 'quest_worker_failed',
            code: 'QUEST_WORKER_STORAGE_UNAVAILABLE',
          });
        }
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  async proposals(userId: bigint) {
    return this.repository.proposalState(userId, new Date(), this.policy);
  }

  async generate(userId: bigint, actorId: bigint, key: string) {
    const asOf = new Date();
    const existing = await this.repository.replay(key, userId, actorId, asOf);
    if (existing) return this.proposals(userId);
    const state = await this.proposals(userId);
    if (state.status !== 'ELIGIBLE') return state;
    const history = await this.repository.history(userId, asOf, this.policy);
    const summary = buildProposalSummary(
      history.facts,
      history.catalog,
      history.prior,
      this.policy,
      asOf,
    );
    await this.repository.claim({
      key,
      userId,
      actorId,
      now: asOf,
      policy: this.policy,
      model: this.config.get<string>('GEMINI_MODEL') || 'UNCONFIGURED',
      summary,
    });
    return this.proposals(userId);
  }

  /** One persisted job, separately testable for recovery and provider call limits. */
  async processNextGeneration(): Promise<void> {
    const job = await this.repository.takeGenerationJob(
      new Date(),
      this.policy,
    );
    if (!job) return;
    const accepted: Candidate[] = [];
    const attempts: {
      call: number;
      acceptedCount: number;
      rejections: string[];
    }[] = [];
    let failure = 'QUEST_AI_INVALID_RESPONSE';
    try {
      const history = await this.repository.history(
        job.userId,
        job.asOf,
        this.policy,
      );
      if (
        history.facts.filter((fact) => fact.personalMinor > 0n).length <
        this.policy.candidates.minimumHistoryOrders
      ) {
        await this.repository.fail(job.key, 'INSUFFICIENT_HISTORY', new Date());
        return;
      }
      const rules = proposalRules(
        history.catalog,
        history.prior,
        this.policy,
        job.asOf,
      );
      for (
        let call = 1;
        call <= this.policy.proposals.maximumCalls;
        call += 1
      ) {
        try {
          const priorAccepted: Proposal[] = [];
          for (const p of accepted) {
            if (p.minimumSpendMinor === null) continue;
            if (p.type === 'MIN_SPEND')
              priorAccepted.push({
                type: p.type,
                targetId: null,
                minimumSpendMinor: p.minimumSpendMinor,
              });
            else if (p.targetId !== null)
              priorAccepted.push({
                type: p.type,
                targetId: p.targetId,
                minimumSpendMinor: p.minimumSpendMinor,
              });
          }
          const raw = await this.provider.propose(
            job.summary,
            rules,
            this.policy.proposals.desiredCount - accepted.length,
            priorAccepted,
            attempts.flatMap((a) => a.rejections),
          );
          const checked = validateProposals(
            raw,
            history.catalog,
            history.prior,
            this.policy,
            new Date(),
            accepted,
          );
          accepted.splice(0, accepted.length, ...checked.accepted);
          attempts.push({
            call,
            acceptedCount: accepted.length,
            rejections: checked.rejections,
          });
        } catch (error: unknown) {
          failure = providerCode(error);
          attempts.push({
            call,
            acceptedCount: accepted.length,
            rejections: [failure],
          });
          // A second call fills invalid/missing proposals, not an immediate
          // network retry. Dependency failures use the persisted cooldown.
          if (failure !== 'QUEST_AI_INVALID_RESPONSE') break;
        }
        if (accepted.length >= this.policy.proposals.desiredCount) break;
      }
      if (accepted.length > 0) {
        await this.repository.saveProposals(
          job.key,
          accepted,
          this.policy,
          new Date(),
          { attempts },
        );
      } else {
        await this.repository.fail(job.key, failure, new Date(), {
          output: { attempts },
          rejections: [],
        });
      }
      this.logger.log({
        event: 'quest_proposals_finished',
        correlationId: job.key,
        acceptedCount: accepted.length,
      });
    } catch (error: unknown) {
      await this.repository.fail(job.key, providerCode(error), new Date(), {
        output: { attempts },
        rejections: [],
      });
      this.logger.warn({
        event: 'quest_proposals_failed',
        correlationId: job.key,
        code: providerCode(error),
      });
    }
  }

  async select(
    userId: bigint,
    key: string,
    proposalId: string,
    idempotencyKey: string,
  ) {
    return this.repository.select(
      userId,
      key,
      proposalId,
      idempotencyKey,
      this.policy,
      new Date(),
    );
  }

  async list(userId: bigint, cursor?: bigint) {
    const items = await this.repository.list(userId, new Date(), cursor);
    return {
      items,
      nextCursor: items.length === 20 ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async evaluateOrder(orderId: bigint) {
    const result = await this.repository.evaluateAndCompleteOrder(
      orderId,
      this.policy,
    );
    if (result)
      this.logger.log({
        event: 'quest_completed',
        orderId: orderId.toString(),
        ...result,
      });
    return result;
  }
}
