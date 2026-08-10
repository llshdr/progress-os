// Grounded in real first-timer cost breakdowns and coaching advice
// (Slowtwitch, TrainingPeaks, 220 Triathlon, TriathlonUniverse, Phazon
// Triathlon), not invented generic tips - researched specifically for
// this feature. Deliberately short lists, not an exhaustive gear guide:
// the point is the handful of decisions that actually move the budget
// needle for a first-timer, not a complete checklist.

export const BUDGET_CATEGORIES = ['entry_fee', 'travel', 'gear', 'coaching', 'nutrition', 'other'] as const
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number]

export const BUDGET_CATEGORY_LABEL: Record<BudgetCategory, string> = {
  entry_fee: 'Entry fee',
  travel: 'Travel & accommodation',
  gear: 'Gear',
  coaching: 'Coaching',
  nutrition: 'Nutrition',
  other: 'Other',
}

export const IRONMAN_WORTH_IT: string[] = [
  'A well-fitted bike and a professional bike fit — any road bike with enough gears works for a first Ironman; comfort over the many hours in the saddle matters more than aero, and a poor fit can cause injury or hurt your run off the bike.',
  'A wetsuit that actually fits you — rented or used is fine, fit matters far more than brand or material for swim comfort.',
  'Race nutrition tested in training, not just bought and tried for the first time on race day.',
  'A realistic travel and accommodation budget — for a destination race this is often the single biggest line item, easy to underestimate.',
]

export const IRONMAN_SKIPPABLE: string[] = [
  'Aero wheels or a full time-trial bike setup — fitness beats aero at a first-timer level.',
  'A paid coach — a free or low-cost structured plan, or a local tri club, can substitute for a first race.',
  'Extra gadgets and data tools beyond a basic GPS watch.',
]
