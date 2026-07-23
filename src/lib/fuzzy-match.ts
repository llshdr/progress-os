// Small, dependency-free fuzzy scorer for searching the small (~100-row),
// fully-fetched exercise catalog client-side. No need for a Postgres
// extension or an LLM call for a dataset this size - substring/prefix
// matching plus a Levenshtein-based typo-tolerance fallback is good enough.

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const dist: number[][] = Array.from({ length: rows }, (_, i) => [i, ...new Array(cols - 1).fill(0)])
  for (let j = 1; j < cols; j++) dist[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost)
    }
  }

  return dist[rows - 1][cols - 1]
}

// Higher is better, 0 means no match at all.
function scoreCandidate(query: string, candidate: string): number {
  const q = query.trim().toLowerCase()
  const c = candidate.trim().toLowerCase()
  if (!q) return 0

  if (c === q) return 100
  if (c.startsWith(q)) return 90
  if (c.includes(q)) return 75

  // Typo tolerance: only worth considering when the strings are close in
  // length, otherwise near-everything scores "somewhat similar".
  if (Math.abs(c.length - q.length) > 4) return 0
  const distance = levenshtein(q, c)
  const maxLen = Math.max(q.length, c.length)
  const similarity = 1 - distance / maxLen
  return similarity >= 0.6 ? Math.round(similarity * 60) : 0
}

export interface FuzzySearchable {
  name: string
  aliases?: string[] | null
}

// Scores an item by its best-matching field (name or any alias) and returns
// matches sorted best-first, capped at `limit`.
export function fuzzySearch<T extends FuzzySearchable>(items: T[], query: string, limit = 8): T[] {
  if (!query.trim()) return []

  const scored = items
    .map((item) => {
      const candidates = [item.name, ...(item.aliases ?? [])]
      const best = Math.max(...candidates.map((c) => scoreCandidate(query, c)))
      return { item, score: best }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((s) => s.item)
}
