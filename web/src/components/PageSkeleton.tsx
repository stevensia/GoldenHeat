/** PageSkeleton — 通用加载骨架屏 */
export default function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-8 w-48 rounded-lg bg-white/[0.04]" />
        <div className="h-6 w-24 rounded-md bg-white/[0.03]" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#1e1e1e] bg-[#111] p-5"
          >
            <div className="mb-3 h-4 w-24 rounded bg-white/[0.04]" />
            <div className="mb-2 h-10 w-20 rounded bg-white/[0.06]" />
            <div className="h-3 w-full rounded bg-white/[0.03]" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="mt-8 rounded-2xl border border-[#1e1e1e] bg-[#111] p-6">
        <div className="mb-4 h-5 w-32 rounded bg-white/[0.04]" />
        <div className="h-48 w-full rounded-lg bg-white/[0.03]" />
      </div>
    </div>
  )
}
