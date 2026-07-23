'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'

const ONBOARDING_KEY = 'nero-onboarding-complete'

const STEPS = [
  {
    title: 'Welcome to Nero AI',
    subtitle: 'Your personal AI operating system',
    description: 'Nero is a multi-brain AI assistant with 7 specialized cores. It can chat, research, code, manage projects, and more.',
    icon: '🧠',
  },
  {
    title: 'Ready to Go',
    subtitle: 'No setup needed — Nero has everything',
    description: 'Nero comes with a built-in Gemini API key. Just open the chat and start talking. No accounts, no API keys, no configuration.',
    icon: '✅',
  },
  {
    title: 'Start a Conversation',
    subtitle: 'Try chatting with Nero',
    description: 'Type a message to start. Nero uses 7 brain cores — reasoning, coding, research, creative, memory, learning, and automation — to give you the best response.',
    icon: '💬',
  },
  {
    title: "You're All Set!",
    subtitle: 'Explore Nero\'s features',
    description: 'Use the sidebar to navigate between Chat, Research, Memory, Projects, and more. Press Ctrl+/ to see keyboard shortcuts.',
    icon: '🚀',
  },
]

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(ONBOARDING_KEY) === 'true'
}

export function completeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, 'true')
}

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const { toast } = useToast()

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      completeOnboarding()
      onComplete()
      toast('Welcome to Nero AI!', 'success')
    }
  }

  const handleSkip = () => {
    completeOnboarding()
    onComplete()
  }

  const current = STEPS[step]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="glass-elevated p-8 rounded-2xl max-w-lg w-full mx-4 text-center"
          style={{
            background: 'var(--glass-bg-strong)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Icon */}
          <div className="text-5xl mb-4">{current.icon}</div>

          {/* Title */}
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {current.title}
          </h2>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--accent)' }}>
            {current.subtitle}
          </p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            {current.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  background: i === step ? 'var(--accent)' : 'var(--border-default)',
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              Skip all
            </button>
            <motion.button
              onClick={handleNext}
              className="btn-primary px-6 py-2 rounded-lg text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {step === STEPS.length - 1 ? 'Get Started' : 'Next'}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
