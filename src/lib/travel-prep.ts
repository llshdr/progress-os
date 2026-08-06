// Static, honest "away from your usual setup" content shown from a
// multi-day Calendar entry (see calendar_entries, migration 061). Same
// discipline as PACKING_LISTS/DISRUPTION_GUIDANCE elsewhere in this app:
// no fabricated precision about a destination's climate, gym access, or
// an "equivalent training load" for whatever gets done instead - just
// generic, training-only gear reminders and honest framing. Scoped to
// training gear specifically, not general trip packing (passport,
// chargers, etc.) - that's outside what this app is for.

export type TravelDiscipline = 'running' | 'strength' | 'swim' | 'bike'

export const TRAVEL_DISCIPLINE_LABELS: Record<TravelDiscipline, string> = {
  running: 'Running',
  strength: 'Strength',
  swim: 'Swim',
  bike: 'Bike',
}

export const TRAVEL_CHECKLIST_ITEMS: Record<TravelDiscipline, string[]> = {
  running: ['Running shoes', 'Moisture-wicking socks', 'GPS watch + charger'],
  strength: ['Resistance bands', 'Jump rope', 'Comfortable workout clothes'],
  swim: ['Swimsuit', 'Goggles', 'Swim cap'],
  bike: ['Cycling shoes (if using clipless pedals)', 'Padded shorts', 'Bike computer + charger'],
}

export const TRAVEL_NO_GYM_GUIDE =
  "Away from your usual setup, bodyweight strength (push-ups, squats, lunges, planks), a resistance band, and just staying active - walking, hiking, exploring on foot - all count for something. Don't try to replicate your normal training exactly; the goal is staying in the habit, not hitting the same numbers. Resume your normal plan when you're back."

export const TRAVEL_TIMEZONE_NOTE =
  "Long-haul trip? Your wake/sleep times in Settings won't auto-adjust for a new time zone - update them manually if you want Calendar's day view scrolled to the right spot while you're away."
