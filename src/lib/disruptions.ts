// Static, reason-keyed guidance for a declared training_disruptions row
// (see migration 057, 'injury' added in migration 072) - deliberately no
// equivalent-training-load calculation ("skiing = Xkm of cardio"). Real
// activity during a disruption has real value, but converting it to a
// fabricated distance-equivalent would be exactly the kind of invented
// precision this feature avoids everywhere else. Lives here (not under
// race-plan/) because training_disruptions is user-level, not
// race-specific - Races and Calendar both consume this.
//
// illness/injury carry real go/no-go content, not just "rest up" - the
// first time this feature touches actual health decisions rather than
// pace/nutrition, so both end with a brief, honest disclaimer rather
// than reading as personalized medical advice.
export const DISRUPTION_GUIDANCE: Record<'travel' | 'illness' | 'injury' | 'other', string> = {
  travel:
    "Real activity while traveling (hiking, skiing, walking) has real value even though it's not directly comparable to structured training - don't try to convert it to a distance-equivalent. Enjoy it, and resume the plan normally when you're back.",
  illness:
    "A commonly-cited rule of thumb: symptoms above the neck only (runny nose, mild sore throat) - generally fine to train through at an easy effort if you feel up to it. Symptoms below the neck or systemic (chest congestion, fever, body aches, GI issues) - don't train, rest and recover fully. When you resume, ease back in rather than picking up where you left off: a common approach is your first session or two at roughly half your normal volume/intensity, rebuilding over a similar span to how long you were out, and backing off further if symptoms return. This is general guidance, not a diagnosis - see a professional for anything beyond mild or short-lived. The plan already accounts for gaps like this: regenerating afterward steps your starting point back to match reality rather than pretending nothing happened.",
  injury:
    "Don't run through pain - mild discomfort that doesn't change your gait or form and settles down during a warmup is generally OK to continue cautiously; sharp, localized, worsening, or form-altering pain means stop and rest the affected area. For the first day or two, a commonly-cited approach is Protection, Optimal Loading, Ice, Compression, Elevation (POLICE - the modern update to RICE). This is general guidance, not a diagnosis - see a professional for anything that doesn't clearly improve within a few days, or anything severe. The plan already accounts for gaps like this: regenerating afterward steps your starting point back to match reality rather than pretending nothing happened.",
  other:
    "Take the time you need. When you're ready, resume the plan as normal, or Regenerate if your real training has shifted meaningfully from where the plan assumed you'd be.",
}
