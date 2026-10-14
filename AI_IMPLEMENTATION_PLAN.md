# AI Implementation Plan — Personalized Quest Recommendation

## Execution roadmap and progress

**Current status (2026-10-15):** Steps 2–3 have been adapted to the approved Complete Journey pilot: relative targets, broad department categories, eight features and retrospective single-basket labels. The reviewed pilot contains 1,664 rows (163 matches, 1,501 nonmatches), after exclusions from 3,200 possible rows. All four types have both classes. Today explicitly stops before Step 4; no model is trained. The following synthetic-v1 history is retained as legacy evidence.

The [Thai beginner execution roadmap](docs/AI_BEGINNER_ROADMAP_TH.md) is part of this implementation plan. It expands the five implementation phases into tooling preparation and nine practical steps, without adding AI features.

Tooling preparation (roadmap Step 1) is complete: the user created `ai-service/.venv` with Python 3.14.3, installed the libraries, passed `pip check` and library import checks, and saved pinned versions in `ai-service/requirements.txt`. Evidence is recorded in the roadmap. Clean-environment reinstall has not been tested.

Roadmap Step 2 is complete for documentation: [dataset schema](docs/ai/DATASET_SCHEMA.md) and [feature definitions](docs/ai/FEATURE_DEFINITIONS.md). The user confirmed this is an academic prototype using synthetic users and history, with one raw synthetic source for offline training and later development-database demonstrations. Purchase counts use separate 7-day and 30-day features; spend and target purchase history use 30 days; quest history uses all prior assignments and only outcomes known before the feature cutoff.

Roadmap Step 3 is complete for offline synthetic preparation: [prepare_data.py](ai-service/prepare_data.py), validated raw history, point-in-time features and deterministic single-order labels. The reviewed demo contains 60 synthetic users, 2,228 paid orders, 540 assignments and 496 training rows (171 completed, 325 expired); 44 active assignments are excluded. All four quest types are represented. Tests passed: 25. Re-generation and raw JSON revalidation reproduce identical output bytes/hashes. See the [AI README](ai-service/README.md) and [manifest](ai-service/data/manifest.json).

On 2026-10-15 the user authorized adapting Steps 2–3 to Complete Journey, relative spending targets and a pilot first, explicitly stopping before Step 4. The synthetic-v1 results above remain a separate legacy fixture, not the active external training contract. See [current dataset/feature contract](docs/ai/COMPLETE_JOURNEY_PREPARATION.md) and [shared template policy](ai-service/config/quest_template_policy_v2.json). The source adapter and pilot preparation are complete for offline use. No model, prediction API, DB seeding, reward issuance or NestJS integration has been implemented.

## 1. Project Overview

Project: **Thai Chuay Thai Please (ไทยช่วยไทยพลีส)**

The project is a prototype local-commerce platform with a consumer application, merchant POS system, virtual wallet, subsidy payment simulation, quests, points, and discount coupons.

This document covers **only the AI-powered Personalized Quest Recommendation system**.

The current prototype learns the likelihood of an observed purchase matching a hypothetical candidate's conditions in one basket during its validity window. NestJS uses candidate scores and policy to select and automatically assign personalized quests. Complete Journey contains no actual quest exposure/outcomes: this score is not a proven probability of responding to an assigned quest, and does not estimate reward-induced spending uplift.

**Important: The AI does not generate new quest descriptions or evaluate quest completion.**

## 2. Technology Stack

- AI language: Python
- Machine learning model: CatBoost Classifier
- Data processing: Pandas, NumPy
- Model evaluation: Scikit-learn
- AI API: FastAPI
- Backend integration: NestJS (REST API)
- Database: PostgreSQL on Neon
- ORM: Prisma

The AI service must remain separate from the NestJS backend.

## 3. AI Responsibilities

The AI service is responsible for:

1. Receiving user behavior features and predefined candidate quests from the backend.
2. Scoring observed-purchase matching for each user–candidate pair using the versioned proxy target.
3. Returning prediction scores to the backend.
4. Supporting offline model training, evaluation, and versioning.

The AI service is **not responsible for**:

- Generating arbitrary quest text.
- Directly inserting quests into the database.
- Assigning quests to users.
- Processing payments.
- Checking whether a completed order satisfies a quest.
- Awarding points.
- Redeeming coupons.
- Automatically retraining itself after every transaction.

These operations belong to the NestJS backend.

## 4. Supported Quest Types

The backend generates candidate quests using predefined templates.

| Quest Type       | Description                                               | Example                                     |
| ---------------- | --------------------------------------------------------- | ------------------------------------------- |
| MIN_SPEND        | Spend at least a specified amount in one order            | Spend 100 THB, earn 50 points               |
| CATEGORY_SPEND   | Spend a specified amount in a particular product category | Spend 150 THB on food, earn 70 points       |
| PRODUCT_PURCHASE | Purchase a specified product                              | Buy Product A, earn 30 points               |
| MERCHANT_SPEND   | Spend a specified amount at a particular merchant         | Spend 200 THB at Merchant A, earn 80 points |

Each quest may contain:

- `quest_id`
- `quest_type`
- `min_spend`
- `target_category_id`
- `target_product_id`
- `target_merchant_id`
- `reward_point`
- `duration_days`

The backend must ensure that generated candidate quests are valid and applicable to the user. Training candidate generation and later NestJS generation must implement the same versioned template mechanics. The current policy is an offline experiment: spending targets are 1.0 or 1.5 times the prior 30-day whole-basket average, rounded upward to a minor unit; product quests are product-only. Rewards, live catalog eligibility and budget are backend policy and remain integration decisions. The model does not learn a reward effect from this source.

## 5. Data Sources

Offline preparation uses the pinned Complete Journey transactions/products files; source households/stores are not platform accounts/merchants. Raw source-sales dollars are not converted to THB and are not asserted to equal platform post-discount final amounts. Target IDs and raw amounts stay in metadata; only normalized model inputs are transferable in principle, subject to domain validation. No external-history DB import is required for training.

Relevant PostgreSQL tables for later live inference and deterministic completion:

| Table                   | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `users`                 | User identity and account information       |
| `orders`                | Purchase history, spending, timestamps      |
| `order_items`           | Purchased products, quantities, item prices |
| `products`              | Product and category associations           |
| `product_categories`    | Product category information                |
| `merchants`             | Merchant information                        |
| `quests`                | Quest definitions and conditions            |
| `user_quests`           | Quest assignments and completion outcomes   |
| `quest_generation_logs` | Recommendation history and model metadata   |

The latest planned `quest_generation_logs` fields include:

- `generation_id`
- `user_id`
- `input_summary`
- `generated_quest_id`
- `model_version`
- `prediction_score`
- `candidate_scores`
- `selection_reason`
- `generated_at`

**Do not assume the database has already been migrated. Inspect the actual Prisma schema and database before implementing any changes.**

## 6. Machine Learning Problem

This is a **binary classification problem**.

Each current training example represents one household + UTC cutoff + hypothetical candidate. Features use only information before cutoff. Candidate target selection uses a pre-cutoff catalog and a deterministic seed.

Target:

- `1`: At least one owned observed basket matches the candidate in `[cutoff, expires_at)`.
- `0`: No such basket exists and the full label window is observable.
- Incomplete/censored windows have no label and are excluded, including source gaps and rejected baskets in the window.

Use the source-sales basis only for the documented offline proxy. Production completion still requires an actual PAID order after discounts, preserving subsidy and reward rules. Never sum multiple baskets to meet a threshold.

If real assigned-quest data is used in a future dataset version, only finalized outcomes qualify; active/pending assignments are not failures. Do not mix those outcomes with proxy candidates silently.

The model should estimate:

`P(observed_single_basket_match = 1 | prior_purchase_features, candidate_conditions)`

The model output must be a probability between 0 and 1.

## 7. Feature Engineering

Current ordered feature schema: `purchase-match-features-v2`, documented in [Complete Journey preparation](docs/ai/COMPLETE_JOURNEY_PREPARATION.md).

**User behavior features**

- Number of completed purchases in the past 7 days.
- Number of completed purchases in the past 30 days.
- Number of distinct purchases in the candidate product category over 30 days.
- Historical purchases from the candidate merchant.
- Historical purchases of the candidate product.

The five legacy quest-history features are absent from this model version because source quest exposure/outcomes are absent. NestJS must still use real quest history for eligibility and duplication policy. Historical average spending is calculated to derive a threshold and ratio, but raw currency amounts are metadata, not model inputs.

**Candidate quest features**

- Quest type.
- Required spending divided by the prior 30-day whole-basket average (null for product-only).
- Quest duration.
  Target category/store/product identity and reward remain candidate metadata/backend policy, not predictors. Source catalog identifiers do not transfer to the live catalog. There are eight ordered features, not the old synthetic-v1 twenty.

All purchase features must use information available **strictly before the feature cutoff**; candidate conditions must be set before inspecting the label window.

Avoid data leakage from future purchases or quest outcomes.

Do not use citizen ID, full name, or phone number as predictive features.

## 8. Training Dataset

The active dataset contains one row per household/cutoff/candidate, with eight features, a binary proxy label and audit metadata. Preserve and isolate the old 496-row synthetic assignment dataset; never merge targets by merely renaming columns.

Example:

| household | cutoff | purchases_30d | quest_type | min_spend_ratio | duration_days | label |
| --------- | ------ | ------------: | ---------- | --------------: | ------------: | ----: |
| A         | t      |             2 | MIN_SPEND  |        1.000000 |             7 |     1 |
| A         | t      |             2 | MIN_SPEND  |        1.500000 |             7 |     0 |

These rows are illustrative, not actual project data.

The pilot selects up to 200 households × four cutoffs × four candidate types = 3,200 possible samples before conservative cleaning/censoring. Larger preparation (approximately 80,000 possible rows) is later work after reviewing pilot coverage; sample counts do not guarantee model quality.

Synthetic data must be labeled as synthetic in documentation and evaluation reports. Results from synthetic data must not be presented as real-world model performance.

## 9. Model Training

Implement an offline training pipeline that:

1. Loads and validates the dataset.
2. Handles missing values.
3. Separates categorical and numerical features.
4. Splits chronologically, keeping same-cutoff candidate groups together and purging any train label window that overlaps an evaluation cutoff. Fit preprocessing on training only. Repeated household/candidate rows are not independent.
5. Trains a CatBoost Classifier.
6. Evaluates predictive performance.
7. Saves the trained model and feature schema.
8. Records the model version.

Suggested evaluation metrics:

- ROC-AUC
- Precision
- Recall
- F1-score
- Log Loss
- Probability calibration / Brier Score

Use a simple purchase-frequency/target-history baseline for comparison. Evaluate each type and both labels; any future calibration measures purchase-match probabilities, not actual quest-completion response.

Do not claim that the model improves spending or engagement without evidence from an appropriate evaluation.

## 10. Prediction API

Implement a FastAPI endpoint:

`POST /predict-quests`

Example request:

```json
{
  "user_id": 101,
  "user_features": {
    "purchases_7d": 3,
    "purchases_30d": 12
  },
  "candidate_quests": [
    {
      "quest_id": 501,
      "quest_type": "MIN_SPEND",
      "min_spend_ratio": "1.000000",
      "reward_point": 50,
      "duration_days": 7
    },
    {
      "quest_id": 502,
      "quest_type": "MIN_SPEND",
      "min_spend_ratio": "1.500000",
      "reward_point": 60,
      "duration_days": 7
    }
  ]
}
```

Example response:

```json
{
  "model_version": "v1.0.0",
  "predictions": [
    {
      "quest_id": 501,
      "purchase_match_probability": 0.82
    },
    {
      "quest_id": 502,
      "purchase_match_probability": 0.71
    }
  ]
}
```

The example scores are hypothetical.

This is a future API design only: Step 6 has not started. The final request must produce exactly the eight ordered features for every candidate, including candidate-specific target counts (omitted in this simplified example), and include feature/policy versions. Rewards are transported for backend policy, not fed into the model.

Use Pydantic for request and response validation.

## 11. Backend Recommendation Workflow

NestJS should perform the following workflow:

1. Retrieve the user's purchase and quest history from PostgreSQL using Prisma.
2. Calculate the required user behavior features.
3. Generate valid candidate quests from predefined templates.
4. Send the candidate quests and user features to the AI service.
5. Receive versioned purchase-match scores.
6. Select a quest using a backend selection policy.
7. Create or reuse the appropriate quest definition.
8. Assign the selected quest through `user_quests`.
9. Record the recommendation in `quest_generation_logs`.

The backend selection policy should consider:

- Purchase-match score.
- Candidate difficulty relative to historical spending; this is not a causal spending-uplift estimate.
- Quest eligibility.
- Avoidance of inappropriate or duplicate assignments.
- Reasonable reward and difficulty levels.

**Do not always select the candidate with the highest predicted probability.**

The selection policy may trade off normalized difficulty, relevance and reward cost; the largest purchase-match score need not win. Ratio mechanics must match training, and the live target must refer to an eligible actual platform entity. Missing positive purchase history prevents relative spend targets; cold-start behavior needs an explicit integration decision.

The exact selection formula and thresholds must be configurable and should not be invented as fixed business requirements.

## 12. Quest Completion Rules

Quest completion is evaluated by NestJS, not the AI service.

Important rules:

- A quest must be completed within its validity period.
- A quest must be completed using **one paid order**.
- Spending cannot be accumulated across multiple orders.
- Spending thresholds use amounts **after coupon discounts**.
- Subsidy funding allocation is not a discount and does not reduce the purchase amount used for quest evaluation.
- For `CATEGORY_SPEND`, evaluate the relevant category's spending after appropriate coupon discount allocation.
- For `PRODUCT_PURCHASE`, verify that the required product is included in the paid order.
- For `MERCHANT_SPEND`, verify the merchant and required spending threshold.
- A completed quest grants its predefined points once.

After completion, the backend updates `user_quests`, `users.point_balance`, and `point_transactions` atomically.

Points can later be redeemed for single-use, expiring coupons.

## 13. Recommendation Logging and Feedback

For each selected recommendation, store:

- User identifier.
- Input feature summary.
- Selected quest identifier.
- Selected quest prediction score.
- Candidate quest scores.
- Selection reason.
- Model version.
- Generation timestamp.

Historical assigned quests and their final outcomes may later be used for offline retraining.

**Logging feedback does not mean the model automatically learns or updates itself.**

Retraining must be an explicit, separate process.

## 14. Suggested AI Service Structure

```text
ai-service/
├── data/
│   └── training_data.csv
├── models/
│   └── quest_model.cbm
├── src/
│   ├── features.py
│   ├── schemas.py
│   ├── predictor.py
│   └── model_loader.py
├── prepare_data.py
├── train.py
├── evaluate.py
├── main.py
├── requirements.txt
└── README.md
```

## 15. Implementation Phases

**Phase 1 — Data and feature design**

Define the training schema, feature definitions, and historical data extraction logic.

**Phase 2 — Model development**

Prepare training data, train CatBoost, evaluate performance, and save a versioned model.

**Phase 3 — AI API**

Build the FastAPI prediction endpoint and test scoring of multiple candidate quests.

**Phase 4 — NestJS integration**

Implement candidate generation, AI service communication, quest selection, assignment, and logging.

**Phase 5 — End-to-end testing**

Test the full process from user purchase history through recommendation, assignment, paid-order quest completion, and point rewards.

## 16. Constraints for Codex

- Inspect the existing repository before writing code.
- Follow the actual database schema and Prisma models.
- Do not silently change database structures.
- Do not implement generative AI or LLM-based quest generation.
- Do not replace CatBoost with another model without approval.
- Do not implement automatic online learning.
- Do not put quest completion logic inside the AI service.
- Do not invent additional gamification features such as badges, leaderboards, membership tiers, or daily login quests.
- Keep the AI service modular and independently testable.
- Ask for clarification when business rules or model assumptions are not specified.

## 17. Expected Deliverables

1. A documented training dataset schema.
2. Feature engineering and preprocessing code.
3. CatBoost training and evaluation scripts.
4. A versioned trained model artifact.
5. A working FastAPI prediction endpoint.
6. Automated tests for prediction input/output.
7. NestJS integration for recommendation and assignment.
8. Recommendation logs stored in PostgreSQL.
9. Documentation explaining how to train, evaluate, run, and update the model.

**Primary goal:** Deliver a functional, testable prototype of template quest recommendation using documented observed-purchase-match scores, with assignment, eligibility, actual completion and financial/reward rules controlled by NestJS. Today stops at a verified Step 3 pilot; Step 4 training is explicitly excluded.
