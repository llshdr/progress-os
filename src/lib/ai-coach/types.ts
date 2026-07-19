export interface SuggestionAction {
  label: string
  href: string
}

// Generic shape so future modules (nutrition, business, ...) can plug in
// their own suggestions without changing the generation pipeline or the
// dashboard card that renders them.
export interface Suggestion {
  module: string
  text: string
  action?: SuggestionAction | null
}

// A module contributes candidate suggestions with real, already-resolved
// text/links. The daily generator asks Gemini to pick and rephrase a subset
// of these — it never invents links or numbers itself.
export interface SuggestionCandidate extends Suggestion {}
