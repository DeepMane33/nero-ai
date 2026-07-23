'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const ACCENT_COLORS = ['#c0c0c0', '#94a3b8', '#7b8da4', '#b4a0d4', '#7ec8e3', '#8fb996'];

const SECTIONS = [
  { id: 'model', label: 'Model', icon: '◆' },
  { id: 'theme', label: 'Theme', icon: '◈' },
];

export default function SettingsPanel() {
  const { accentColor, setAccentColor } = useTheme();
  const [activeSection, setActiveSection] = useState('model');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function saveSettings() {
    setSaving(true);
    try {
      const existing = JSON.parse(localStorage.getItem('nero-settings') || '{}');
      localStorage.setItem('nero-settings', JSON.stringify(existing));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const sectionVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex h-full w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
      {/* Sidebar */}
      <div className="w-56 shrink-0 flex flex-col py-4 neu-raised" style={{ borderRadius: 0 }}>
        <div className="px-5 pb-4 border-b mb-2" style={{ borderColor: 'rgba(176,184,196,0.1)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>SETTINGS</span>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-all ${activeSection === s.id ? 'neu-flat' : ''}`}
              style={{
                background: activeSection === s.id ? undefined : 'transparent',
                color: activeSection === s.id ? 'var(--accent)' : 'var(--text-tertiary)',
                borderLeft: activeSection === s.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto px-4 pt-4 border-t" style={{ borderColor: 'rgba(176,184,196,0.1)' }}>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-2 rounded text-sm font-bold transition-all neu-btn"
            style={{
              color: saved ? 'var(--color-success)' : 'var(--accent)',
            }}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {/* MODEL SECTION */}
          {activeSection === 'model' && (
            <motion.div key="model" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--accent)' }}>Model</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
                Nero uses a built-in Gemini API key. No setup required.
              </p>

              {/* Active provider card */}
              <div className="max-w-lg">
                <div
                  className="w-full flex items-center justify-between p-4 rounded-lg"
                  style={{
                    background: 'rgba(176,184,196,0.06)',
                    border: '1px solid rgba(176,184,196,0.2)',
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        Google Gemini
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                        ACTIVE
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Built-in API key — Gemini 2.5 Flash + 2.0 Flash
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} title="Active" />
                  </div>
                </div>

                <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  API key is configured server-side. Your conversations are private and isolated per user.
                </p>
              </div>
            </motion.div>
          )}

          {/* THEME */}
          {activeSection === 'theme' && (
            <motion.div key="theme" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-bold mb-1" style={{ color: '#b0b8c4' }}>Theme Settings</h2>
              <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Customize the visual appearance</p>

              <div className="space-y-6 max-w-lg">
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: 'rgba(176,184,196,0.6)' }}>Accent Color</label>
                  <div className="flex gap-2">
                    {ACCENT_COLORS.map(c => (
                      <button key={c} onClick={() => setAccentColor(c)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: c,
                          border: '2px solid ' + (accentColor === c ? 'white' : 'transparent'),
                          cursor: 'pointer',
                          boxShadow: accentColor === c ? '0 0 12px ' + c : 'none',
                          transition: 'all 0.2s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
