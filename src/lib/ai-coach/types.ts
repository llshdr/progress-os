export interface SuggestionAction {
  label: string
  href: string
}

// A module contributes candidate suggestions with real, already-resolved
// text/links. The daily generator asks Gemini to pick and rephrase a subset
// of these — it never invents links or numbers itself. Generic shape so
// future modules can plug in without changing the generation pipeline.
export interface SuggestionCandidate {
  module: string
  text: string
  action?: SuggestionAction | null
  // Goals/milestones-only: identifies the real goal/milestone row behind
  // this candidate, so a genuine "done" action can write straight back to
  // it instead of parsing an href. Left unset by every other module.
  sourceTable?: 'goals' | 'milestones'
  sourceId?: string
}

// The shape actually rendered/persisted: a candidate plus a stable `key`
// assigned once in generateDailySuggestions.ts. Candidate `text` can be
// rephrased differently by the model on each regeneration, so `key` is the
// only identity that survives across renders within one cached generation —
// the Today page's dismiss/reorder state is keyed off it.
export interface Suggestion extends SuggestionCandidate {
  key: string
}
