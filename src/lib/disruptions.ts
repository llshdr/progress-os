// Static, reason-keyed guidance for a declared training_disruptions row
// (see migration 057) - deliberately no equivalent-training-load
// calculation ("skiing = Xkm of cardio"). Real activity during a
// disruption has real value, but converting it to a fabricated
// distance-equivalent would be exactly the kind of invented precision
// this feature avoids everywhere else. Lives here (not under
// race-plan/) because training_disruptions is user-level, not
// race-specific - Races and Calendar both consume this.
export const DISRUPTION_GUIDANCE: Record<'travel' | 'illness' | 'other', string> = {
  travel:
    "Real activity while traveling (hiking, skiing, walking) has real value even though it's not directly comparable to structured training - don't try to convert it to a distance-equivalent. Enjoy it, and resume the plan normally when you're back.",
  illness:
    "Rest and recover fully - training through illness isn't worth it. The plan already accounts for gaps like this: regenerating afterward steps your starting point back to match reality rather than pretending nothing happened.",
  other:
    "Take the time you need. When you're ready, resume the plan as normal, or Regenerate if your real training has shifted meaningfully from where the plan assumed you'd be.",
}
