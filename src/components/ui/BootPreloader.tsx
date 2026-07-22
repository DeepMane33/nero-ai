'use client'

import { useState, useEffect } from 'react'

const CIRCUMFERENCE = 226.2

export default function BootPreloader() {
  const [progress, setProgress] = useState(0)
  const [showName, setShowName] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let p = 0
    let timeout: ReturnType<typeof setTimeout>

    function tick() {
      if (p >= 100) {
        setShowName(true)
        setTimeout(() => setShowSub(true), 300)
        setTimeout(() => setDone(true), 1400)
        return
      }
      p += Math.random() * 3 + 0.5
      if (p > 100) p = 100
      setProgress(p)
      timeout = setTimeout(tick, 50 + Math.random() * 30)
    }

    tick()
    return () => clearTimeout(timeout)
  }, [])

  if (done) return null

  return (
    <div className="boot">
      <div style={{ textAlign: 'center' }}>
        <div className="boot-ring">
          <svg viewBox="0 0 80 80">
            <circle className="ring-bg" cx="40" cy="40" r="36" />
            <circle
              className="ring-fill"
              cx="40"
              cy="40"
              r="36"
              style={{
                strokeDashoffset: CIRCUMFERENCE * (1 - progress / 100),
              }}
            />
          </svg>
          <div className="boot-percent">{Math.floor(progress)}</div>
        </div>
        <div className={`boot-name ${showName ? 'show' : ''}`}>Nero</div>
        <div className={`boot-sub ${showSub ? 'show' : ''}`}>Personal AI Operating System</div>
      </div>
    </div>
  )
}
