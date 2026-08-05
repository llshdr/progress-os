// Best-effort keyword suggestion for whether an exercise is unilateral
// (done one side at a time) - same "suggest, never silently decide"
// precedent as classifyDiscipline (discipline-weakness.ts): this only
// ever pre-fills a toggle the user can see and override before saving,
// it never writes is_unilateral itself. A handful of common, high-
// confidence naming patterns, not an attempt to cover every case - no
// match just means the toggle starts unchecked, same as before this
// feature existed.
const UNILATERAL_NAME_PATTERN = /single[-\s]?arm|single[-\s]?leg|one[-\s]?arm|one[-\s]?leg|unilateral|bulgarian|step-?up|pistol|lunge/i

export function suggestIsUnilateral(name: string): boolean {
  return UNILATERAL_NAME_PATTERN.test(name)
}
