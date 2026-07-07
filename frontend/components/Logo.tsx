import { cn } from '@/lib/utils'

/**
 * Vivora brand mark — an original "V" chevron with a talking-dot, in the
 * Aurora teal→emerald gradient. `showWordmark` renders the name beside it.
 */
export function Logo({
  className,
  showWordmark = true,
  markClassName,
}: {
  className?: string
  showWordmark?: boolean
  markClassName?: string
}) {
  const gid = 'vivora-mark-gradient'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 40 40"
        role="img"
        aria-label="Vivora"
        className={cn('h-8 w-8 shrink-0', markClassName)}
      >
        <defs>
          <linearGradient id={gid} x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2dd4bf" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" className="fill-surface-900" />
        <path
          d="M10 12l6.2 15.4a2.3 2.3 0 0 0 4.28 0L27 12"
          stroke={`url(#${gid})`}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="18.5" cy="11" r="2.4" fill={`url(#${gid})`} />
      </svg>
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight gradient-text">Vivora</span>
      )}
    </span>
  )
}
