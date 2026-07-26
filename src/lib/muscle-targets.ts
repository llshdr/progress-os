// Granular muscle targets, one layer under the existing broad MUSCLE_GROUPS.
// Never a required field: the broad picker in ExerciseFormFields is
// unchanged, and these are either copied automatically from a catalog
// entry, inferred from the exercise name as a best-effort fallback, or
// left null. The optional "Refine target" disclosure is the only place a
// user ever sees this list, and only the options for the already-chosen
// broad group - never the full taxonomy.
export const MUSCLE_TARGETS_BY_GROUP: Record<string, string[]> = {
  Chest: ['Chest (Upper)', 'Chest (Mid)', 'Chest (Lower)'],
  Back: ['Back (Lats)', 'Back (Mid-Back/Rhomboids)', 'Back (Lower Back)', 'Back (Traps)'],
  Shoulders: ['Shoulders (Front Delt)', 'Shoulders (Side Delt)', 'Shoulders (Rear Delt)'],
  Arms: [
    'Biceps (Long Head)',
    'Biceps (Short Head)',
    'Brachialis',
    'Triceps (Long Head)',
    'Triceps (Lateral Head)',
    'Triceps (Medial Head)',
    'Forearms',
  ],
  Legs: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors'],
  Core: ['Core (Rectus Abdominis)', 'Core (Obliques)', 'Core (Lower Back/Erectors)'],
  // "Full Body" exercises are inherently broad - no meaningful granular
  // refine list, so the disclosure just doesn't show for this group.
}

// Best-effort keyword inference for exercises not sourced from the catalog
// (a genuinely custom name, or the in-workout quick-add flow). Deliberately
// conservative - a handful of common, high-confidence naming patterns, not
// an attempt to cover every possible name. No match just means null, which
// is fine: everything keeps working on broad muscle group alone, exactly
// like it does today.
const NAME_PATTERNS: { pattern: RegExp; targets: string[] }[] = [
  { pattern: /hammer curl/i, targets: ['Brachialis', 'Forearms'] },
  { pattern: /preacher|spider|concentration|drag curl/i, targets: ['Biceps (Short Head)'] },
  { pattern: /curl/i, targets: ['Biceps (Long Head)', 'Biceps (Short Head)'] },
  { pattern: /wrist curl|wrist roller/i, targets: ['Forearms'] },
  { pattern: /overhead.*tricep|tricep.*overhead|skull ?crusher/i, targets: ['Triceps (Long Head)'] },
  { pattern: /pushdown|tricep.*press|close-grip/i, targets: ['Triceps (Lateral Head)'] },
  { pattern: /tricep/i, targets: ['Triceps (Lateral Head)'] },
  { pattern: /incline.*(press|fly|flye)/i, targets: ['Chest (Upper)'] },
  { pattern: /decline.*(press|fly|flye|push-?up)/i, targets: ['Chest (Lower)'] },
  { pattern: /bench press|chest press|fly|flye|pec deck|push-?up|dip/i, targets: ['Chest (Mid)'] },
  { pattern: /lat pulldown|pull-?up|chin-?up|pullover/i, targets: ['Back (Lats)'] },
  { pattern: /row/i, targets: ['Back (Lats)', 'Back (Mid-Back/Rhomboids)'] },
  { pattern: /shrug/i, targets: ['Back (Traps)'] },
  { pattern: /hyperextension|good morning|superman/i, targets: ['Back (Lower Back)'] },
  { pattern: /face pull|rear delt|reverse fly/i, targets: ['Shoulders (Rear Delt)'] },
  { pattern: /lateral raise|side raise/i, targets: ['Shoulders (Side Delt)'] },
  { pattern: /front raise|overhead press|shoulder press|arnold/i, targets: ['Shoulders (Front Delt)'] },
  { pattern: /squat|leg press|lunge|step-?up/i, targets: ['Quadriceps', 'Glutes'] },
  { pattern: /leg extension/i, targets: ['Quadriceps'] },
  { pattern: /leg curl|hamstring/i, targets: ['Hamstrings'] },
  { pattern: /deadlift/i, targets: ['Hamstrings', 'Glutes', 'Back (Lower Back)'] },
  { pattern: /hip thrust|glute bridge|glute/i, targets: ['Glutes'] },
  { pattern: /calf raise/i, targets: ['Calves'] },
  { pattern: /adductor/i, targets: ['Adductors'] },
  { pattern: /abductor/i, targets: ['Abductors'] },
  { pattern: /plank|crunch|sit-?up|ab wheel|leg raise|mountain climber/i, targets: ['Core (Rectus Abdominis)'] },
  { pattern: /twist|woodchop|oblique/i, targets: ['Core (Obliques)'] },
]

export function inferMuscleTargets(name: string, muscleGroup: string): string[] | null {
  const validOptions = MUSCLE_TARGETS_BY_GROUP[muscleGroup]
  if (!validOptions) return null

  for (const { pattern, targets } of NAME_PATTERNS) {
    if (pattern.test(name)) {
      // Only keep suggestions that actually belong to the chosen broad
      // group - e.g. a "Row" matched against "Arms" shouldn't hand back
      // back-muscle targets that don't fit under that group.
      const filtered = targets.filter((t) => validOptions.includes(t))
      if (filtered.length > 0) return filtered
    }
  }

  return null
}
