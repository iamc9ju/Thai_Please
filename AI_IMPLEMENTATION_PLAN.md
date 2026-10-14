# AI Implementation Plan — Personalized Quest Recommendation

## Execution roadmap and progress

The [Thai beginner execution roadmap](docs/AI_BEGINNER_ROADMAP_TH.md) is part of this implementation plan. It expands the five implementation phases into tooling preparation and nine practical steps, without adding AI features.

Tooling preparation (roadmap Step 1) is complete: the user created `ai-service/.venv` with Python 3.14.3, installed the libraries, passed `pip check` and library import checks, and saved pinned versions in `ai-service/requirements.txt`. Evidence is recorded in the roadmap. Clean-environment reinstall has not been tested.

Next: roadmap Step 2, data and feature design (Phase 1 below). Model training, prediction API, NestJS integration, completion/rewards, and end-to-end testing remain pending. Unresolved business policies still require decisions before dependent implementation.

## 1. Project Overview

Project: **Thai Chuay Thai Please (ไทยช่วยไทยพลีส)**

The project is a prototype local-commerce platform with a consumer application, merchant POS system, virtual wallet, subsidy payment simulation, quests, points, and discount coupons.

This document covers **only the AI-powered Personalized Quest Recommendation system**.

The purpose of AI is to predict the probability that a specific user will successfully complete a candidate quest. The backend uses these predictions to automatically select and assign personalized quests that encourage user engagement and potentially increase spending.

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
2. Predicting the probability of successful completion for each user–quest pair.
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

The backend must ensure that generated candidate quests are valid and applicable to the user.

## 5. Data Sources

Relevant PostgreSQL tables:

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

Each training example represents one user–quest assignment.

Target:

- `1`: The assigned quest was successfully completed.
- `0`: The assigned quest expired without completion.

Only use assignments with known, finalized outcomes for supervised training.

Do not label active or pending quests as failures.

The model should estimate:

`P(quest_completed = 1 | user_features, quest_features, historical_behavior)`

The model output must be a probability between 0 and 1.

## 7. Feature Engineering

Suggested initial features:

**User behavior features**

- Number of completed purchases in the past 7 days.
- Number of completed purchases in the past 30 days.
- Average order value over the past 30 days.
- Total spending over the past 30 days.
- Number of purchases in each relevant product category.
- Historical purchases from the candidate merchant.
- Historical purchases of the candidate product.

**Quest history features**

- Number of previously assigned quests.
- Number of successfully completed quests.
- Number of expired quests.
- Historical quest completion rate.
- Completion rate for similar quest types.

**Candidate quest features**

- Quest type.
- Required spending threshold.
- Reward points.
- Quest duration.
- Target category.
- Target merchant.
- Target product.
- Difference between required spending and the user's historical average order value.

All features must be calculated using information available **at the time of quest assignment**.

Avoid data leakage from future purchases or quest outcomes.

Do not use citizen ID, full name, or phone number as predictive features.

## 8. Training Dataset

The dataset should contain one row per historical user–quest assignment.

Example:

| user_id | avg_order_value | purchases_30d | quest_type     | min_spend | reward_point | duration_days | completed |
| ------- | --------------: | ------------: | -------------- | --------: | -----------: | ------------: | --------: |
| 101     |              85 |            12 | MIN_SPEND      |       100 |           50 |             7 |         1 |
| 102     |              60 |             5 | CATEGORY_SPEND |       200 |           80 |             7 |         0 |
| 103     |             140 |            15 | MERCHANT_SPEND |       150 |           60 |             5 |         1 |

These rows are illustrative, not actual project data.

If insufficient historical data exists, use clearly documented **synthetic training data** for the prototype.

Synthetic data must be labeled as synthetic in documentation and evaluation reports. Results from synthetic data must not be presented as real-world model performance.

## 9. Model Training

Implement an offline training pipeline that:

1. Loads and validates the dataset.
2. Handles missing values.
3. Separates categorical and numerical features.
4. Splits training and evaluation data, preferably chronologically.
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

Use a simple baseline for comparison.

Do not claim that the model improves spending or engagement without evidence from an appropriate evaluation.

## 10. Prediction API

Implement a FastAPI endpoint:

`POST /predict-quests`

Example request:

```json
{
  "user_id": 101,
  "user_features": {
    "avg_order_value_30d": 85,
    "purchases_30d": 12,
    "quest_completion_rate": 0.6
  },
  "candidate_quests": [
    {
      "quest_id": 501,
      "quest_type": "MIN_SPEND",
      "min_spend": 100,
      "reward_point": 50,
      "duration_days": 7
    },
    {
      "quest_id": 502,
      "quest_type": "MIN_SPEND",
      "min_spend": 120,
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
      "completion_probability": 0.82
    },
    {
      "quest_id": 502,
      "completion_probability": 0.71
    }
  ]
}
```

The example scores are hypothetical.

The final request schema must include all features required by the trained model, even if omitted from this simplified example.

Use Pydantic for request and response validation.

## 11. Backend Recommendation Workflow

NestJS should perform the following workflow:

1. Retrieve the user's purchase and quest history from PostgreSQL using Prisma.
2. Calculate the required user behavior features.
3. Generate valid candidate quests from predefined templates.
4. Send the candidate quests and user features to the AI service.
5. Receive predicted completion probabilities.
6. Select a quest using a backend selection policy.
7. Create or reuse the appropriate quest definition.
8. Assign the selected quest through `user_quests`.
9. Record the recommendation in `quest_generation_logs`.

The backend selection policy should consider:

- Predicted completion probability.
- Potential spending uplift compared with the user's historical behavior.
- Quest eligibility.
- Avoidance of inappropriate or duplicate assignments.
- Reasonable reward and difficulty levels.

**Do not always select the candidate with the highest predicted probability.**

For example, a quest requiring 120 THB may be preferable to one requiring 100 THB if the user normally spends 85 THB and the higher target still has a reasonable probability of completion.

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

**Primary goal:** Deliver a functional, testable prototype of personalized quest recommendation based on predicted completion probability, with quest selection and business rules controlled by the NestJS backend.
