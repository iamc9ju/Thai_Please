"""Demo fixture generation; parameters never become production policy defaults."""

from datetime import timedelta
from random import Random

from .data_contract import (
    Assignment, DATA_ORIGIN, DATASET_VERSION, FEATURE_VERSION, GeneratorConfig,
    History, Item, Order, OrderStatus, Outcome, Quest, QuestType, RULE_VERSION, User,
)
from .quest_rules import derive_outcome


def generate_history(config: GeneratorConfig) -> History:
    random = Random(config.seed)
    users = tuple(User(user_key=f"demo-user-{index + 1:04d}", created_at=config.start_at) for index in range(config.users))
    orders: list[Order] = []
    assignments: list[Assignment] = []
    as_of = config.start_at + timedelta(days=config.history_days)
    types = tuple(QuestType)
    for user_index, user in enumerate(users):
        chance = config.purchase_chance_percent[user_index % len(config.purchase_chance_percent)]
        # A fixed subset remains cold-start; all probabilities are fixture config.
        preferred = config.catalog.merchants[user_index % len(config.catalog.merchants)].merchant_key
        for day in range(config.history_days):
            if random.randrange(100) >= chance:
                continue
            merchant = preferred if random.randrange(2) == 0 else random.choice(config.catalog.merchants).merchant_key
            available = [product for product in config.catalog.products if product.merchant_key == merchant]
            chosen = random.sample(available, k=random.randint(1, len(available)))
            order_key = f"order-{user_index:04d}-{day:04d}"
            items = tuple(Item(
                item_key=f"{order_key}-line-{index}", product_key=product.product_key,
                category_key=product.category_key, product_name_snapshot=product.product_key,
                unit_price_minor=product.unit_price_minor, quantity=(quantity := random.choice(config.quantities)),
                line_total_minor=product.unit_price_minor * quantity, discount_eligible=True,
            ) for index, product in enumerate(chosen))
            subtotal = sum(item.line_total_minor for item in items)
            discount = subtotal * random.choice(config.discount_percent) // 100
            final = subtotal - discount
            subsidy = final * random.choice(config.subsidy_percent) // 100
            paid_at = config.start_at + timedelta(days=day, hours=random.randrange(1, 23), minutes=random.randrange(60))
            orders.append(Order(
                order_key=order_key, user_key=user.user_key, merchant_key=merchant,
                status=OrderStatus.PAID, created_at=paid_at - timedelta(minutes=1), paid_at=paid_at,
                items=items, subtotal_minor=subtotal, discount_minor=discount, final_minor=final,
                subsidy_minor=subsidy, personal_minor=final - subsidy,
            ))
        for index in range(config.assignments_per_user):
            quest_type = types[(index + user_index) % len(types)]
            assigned = config.start_at + timedelta(days=config.first_assignment_day + index * config.assignment_interval_days)
            quest = Quest(
                quest_key=f"quest-{user_index:04d}-{index:03d}", quest_type=quest_type,
                min_spend_minor=None if quest_type == QuestType.PRODUCT_PURCHASE else random.choice(config.min_spend_minor),
                reward_point=random.choice(config.reward_points), duration_days=config.duration_days,
                target_category_id=random.choice(config.catalog.categories).category_key if quest_type == QuestType.CATEGORY_SPEND else None,
                target_merchant_id=random.choice(config.catalog.merchants).merchant_key if quest_type == QuestType.MERCHANT_SPEND else None,
                target_product_id=random.choice(config.catalog.products).product_key if quest_type == QuestType.PRODUCT_PURCHASE else None,
            )
            assignments.append(Assignment(
                assignment_key=f"assignment-{user_index:04d}-{index:03d}", user_key=user.user_key,
                quest=quest, assigned_at=assigned, feature_as_of=assigned,
                expires_at=assigned + timedelta(days=config.duration_days), status=Outcome.ACTIVE,
                outcome_known_at=None, completed_order_key=None,
            ))
    order_records = tuple(sorted(orders, key=lambda order: (order.paid_at, order.order_key)))
    outcomes = tuple(derive_outcome(assignment, order_records, as_of, config.outcome_delay_seconds) for assignment in assignments)
    return History(
        data_origin=DATA_ORIGIN, dataset_version=DATASET_VERSION, feature_schema_version=FEATURE_VERSION,
        rule_version=RULE_VERSION, config=config, dataset_as_of=as_of, users=users, orders=order_records,
        assignments=tuple(sorted(outcomes, key=lambda assignment: (assignment.assigned_at, assignment.assignment_key))),
    )
