export const TIME_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export type TimePeriod = (typeof TIME_PERIODS)[number];
