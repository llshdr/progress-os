// Generic pulsing placeholder shown while a page's data is loading -
// reused across every list/detail page that previously just showed a
// plain "Loading..." string, matching the same pulse pattern the
// Dashboard and Settings pages already established rather than
// inventing a new one. Approximates "a title plus a few list cards,"
// which is close enough to be a genuine placeholder (not misleading)
// for the vast majority of pages using it, without needing a bespoke
// skeleton shape per page.
export function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-lapis-surface-2 rounded w-1/3 mb-3" />
      <div className="h-4 bg-lapis-surface-1 rounded w-1/4 mb-8" />
      <div className="space-y-3">
        <div className="h-20 bg-lapis-surface-1 rounded-lapis-lg" />
        <div className="h-20 bg-lapis-surface-1 rounded-lapis-lg" />
        <div className="h-20 bg-lapis-surface-1 rounded-lapis-lg" />
      </div>
    </div>
  )
}
