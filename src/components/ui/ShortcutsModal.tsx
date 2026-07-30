'use client'

import { motion, AnimatePresence } from 'framer-motion'

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Toggle conversation sidebar' },
  { keys: ['Ctrl', 'Shift', 'K'], desc: 'New chat' },
  { keys: ['Ctrl', 'J'], desc: 'Toggle tools panel' },
  { keys: ['Ctrl', '/'], desc: 'Show keyboard shortcuts' },
  { keys: ['Ctrl', 'L'], desc: 'Toggle theme (dark/light)' },
  { keys: ['Ctrl', 'E'], desc: 'Export current conversation' },
  { keys: ['Enter'], desc: 'Send message' },
  { keys: ['Shift', 'Enter'], desc: 'New line in message' },
  { keys: ['Escape'], desc: 'Close panel / Cancel' },
  { keys: ['/'], desc: 'Show slash commands (in chat)' },
]

export default function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-elevated p-6 rounded-xl max-w-md w-full mx-4"
            style={{
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border)',

            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                Keyboard Shortcuts
              </h2>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-md"
                style={{ color: 'var(--text-tertiary)', cursor: 'pointer', background: 'transparent', border: 'none' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-1">
              {SHORTCUTS.map(s => (
                <div key={s.desc} className="flex items-center justify-between py-2 px-2 rounded-lg" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.desc}</span>
                  <div className="flex gap-1">
                    {s.keys.map(k => (
                      <kbd
                        key={k}
                        className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
