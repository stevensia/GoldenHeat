/* 投资哲学 Banner — 顶部醒目但紧凑的声明条
 *
 * 深色背景 + amber 强调色，高度不超过 100px
 */

export default function PhilosophyBanner() {
  return (
    <div
      className="rounded-2xl px-6 py-4 mb-6"
      style={{
        background: 'linear-gradient(135deg, #0f0f1a 0%, #151528 100%)',
        border: '1px solid rgba(234,179,8,0.15)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight" style={{ color: '#eab308' }}>
            月线趋势 × 美林时钟 × 估值百分位
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#777' }}>
            不做日线赌博，只做有据可循的中长周期判断
          </p>
        </div>
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium shrink-0"
          style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] animate-pulse" />
          月线级别
        </div>
      </div>
    </div>
  )
}
