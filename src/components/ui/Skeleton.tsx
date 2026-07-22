'use client'

interface SkeletonProps {
  count?: number
  height?: number
  className?: string
}

export function Skeleton({ count = 1, height = 42, className = '' }: SkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            marginBottom: 6,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function ChatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex" style={{ justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
          <div
            style={{
              width: `${50 + (i % 3) * 15}%`,
              height: i % 3 === 0 ? 60 : 40,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return <Skeleton count={count} height={48} />
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 120,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      ))}
    </div>
  )
}
