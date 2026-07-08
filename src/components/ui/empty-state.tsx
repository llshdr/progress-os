export function EmptyState({
  message,
  children,
}: {
  message: string
  children?: React.ReactNode
}) {
  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
      <p className="text-white/40 mb-4">{message}</p>
      {children}
    </div>
  )
}
