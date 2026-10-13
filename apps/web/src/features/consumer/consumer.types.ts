export const CONSUMER_VIEWS = [
  'overview',
  'wallet',
  'payment',
  'orders',
  'quests',
  'rewards',
  'profile',
] as const;

export type ConsumerView = (typeof CONSUMER_VIEWS)[number];

export type PaymentStep = 'scan' | 'review' | 'success';
