// Replaces mesocycle.ts's whole fixed-length-block derivation - see
// migration 083 for the schema and full reasoning. "Is a deload active
// today" is now just user_settings.active_deload_started_at IS NOT NULL,
// derived by the caller directly from that one field - there's no
// week-position/block-length math left to do, so unlike mesocycle.ts
// this file holds no derivation function, just the AI Coach prompt text.

// Spliced into the AI Coach recommend route's prompt when a deload is
// active - the one piece of the old mesocycleContext that survives
// verbatim, since it never actually depended on knowing a block's total
// length or a scheduled future deload week, only "is a deload active
// right now." A concrete ~50% weight cut is standard deload guidance (a
// 40-50% intensity reduction targets CNS recovery specifically, which is
// driven by load, not volume) worth stating as a number rather than
// leaving "reduce load" to the model's own judgment of how much - reps/
// sets are left to the model's normal reasoning since volume isn't what
// a deload is protecting.
export const DELOAD_CONTEXT = `This lifter is currently in a deload period. This overrides the "be ambitious" framing above for weight specifically: cut the recommended WEIGHT to roughly 50% of what you'd otherwise target this session (a standard 40-50% intensity reduction - deloads are for CNS recovery, which load drives, not volume). Keep reps and set count at their normal, non-deload targets - reason about those exactly as you would in any other week, don't reduce them just because it's a deload.`
