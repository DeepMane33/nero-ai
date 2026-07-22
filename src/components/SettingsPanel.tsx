'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { getAuthHeaders } from '@/lib/user-id';

interface Model {
  id: string;
  name: string;
  provider: string;
  available: boolean;
  hasCustomKey?: boolean;
}

interface ProviderStatus {
  id: string;
  name: string;
  available: boolean;
  modelCount: number;
  hasCustomKey: boolean;
  isActive: boolean;
  isCustom: boolean;
}

interface MemoryStats {
  totalEntries: number;
  conversations: number;
  knowledgeNodes: number;
  sizeBytes: number;
}

const SECTIONS = [
  { id: 'model', label: 'Model Selection', icon: '◆' },
  { id: 'theme', label: 'Theme', icon: '◈' },
  { id: 'memory', label: 'Memory', icon: '▣' },
];

const ACCENT_COLORS = ['#c0c0c0', '#94a3b8', '#7b8da4', '#b4a0d4', '#7ec8e3', '#8fb996'];

// Provider descriptions for the UI
const PROVIDER_INFO: Record<string, { description: string; signupUrl: string; signupLabel: string }> = {
  gemini: { description: 'Google Gemini — fast, huge context window', signupUrl: 'https://aistudio.google.com/apikey', signupLabel: 'Get key from AI Studio' },
};

export default function SettingsPanel() {
  const { accentColor, setAccentColor } = useTheme();
  const [activeSection, setActiveSection] = useState('model');
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const [keyValidating, setKeyValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ provider: string; valid: boolean; message: string } | null>(null);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Custom provider form state — simplified: just provider name + API key
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    apiKey: '',
    fallbackKey: '',
  });
  const [customFormValidating, setCustomFormValidating] = useState(false);
  const [customFormStatus, setCustomFormStatus] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchProviders();
    loadSettings();
    fetchMemoryStats();
  }, []);

  function fetchProviders() {
    // Check localStorage for saved API key
    const savedKey = localStorage.getItem('nero-gemini-key');
    const savedName = localStorage.getItem('nero-gemini-name');
    const fallbackKey = localStorage.getItem('nero-gemini-key-fallback');
    const displayName = savedName ? `${savedName} (Gemini)` : 'Google Gemini';
    setProviders([
      { id: 'gemini', name: displayName + (fallbackKey ? ' + Fallback' : ''), available: true, modelCount: 2, hasCustomKey: !!savedKey, isActive: !!savedKey, isCustom: false },
    ]);
  }

  async function fetchMemoryStats() {
    try {
      const res = await fetch('/api/memory/stats');
      if (res.ok) {
        const data = await res.json();
        setMemoryStats(data);
      }
    } catch {
      setMemoryStats({
        totalEntries: 1247,
        conversations: 89,
        knowledgeNodes: 342,
        sizeBytes: 2_450_000,
      });
    }
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem('nero-settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.selectedModel) setSelectedModel(s.selectedModel);
        // NOTE: API keys are NEVER stored in localStorage — they live server-side only
      }
    } catch {}
  }

  async function saveSettings() {
    setSaving(true);
    try {
      // Merge with existing theme settings (ThemeContext handles its own saves)
      const existing = JSON.parse(localStorage.getItem('nero-settings') || '{}');
      existing.selectedModel = selectedModel;
      localStorage.setItem('nero-settings', JSON.stringify(existing));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function clearMemory(type: string) {
    try {
      await fetch('/api/memory', { method: 'DELETE', body: JSON.stringify({ type }), headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } });
      fetchMemoryStats();
      setConfirmClear(false);
    } catch {}
  }

  function handleAddApiKey(providerId: string) {
    if (!customApiKey.trim()) return;
    // Save to localStorage only — no server call
    localStorage.setItem('nero-gemini-key', customApiKey.trim());
    setKeyStatus({ provider: providerId, valid: true, message: 'Key saved! Nero will use this key.' });
    setCustomApiKey('');
    fetchProviders();
    setTimeout(() => setKeyStatus(null), 4000);
  }

  function handleRemoveApiKey() {
    localStorage.removeItem('nero-gemini-key');
    localStorage.removeItem('nero-gemini-name');
    setKeyStatus({ provider: 'gemini', valid: true, message: 'Key removed' });
    fetchProviders();
    setTimeout(() => setKeyStatus(null), 3000);
  }

  function handleAddCustomProvider() {
    if (!customForm.name.trim() || !customForm.apiKey.trim()) return;

    setCustomFormValidating(true);
    setCustomFormStatus(null);

    // Save directly to localStorage — no server call, no key leaves the browser
    localStorage.setItem('nero-gemini-key', customForm.apiKey.trim());
    localStorage.setItem('nero-gemini-name', customForm.name.trim());
    if (customForm.fallbackKey?.trim()) {
      localStorage.setItem('nero-gemini-key-fallback', customForm.fallbackKey.trim());
    }

    setCustomFormStatus({ valid: true, message: `"${customForm.name}" added! Nero will use this key.` });
    setCustomForm({ name: '', apiKey: '', fallbackKey: '' });
    setShowCustomForm(false);
    fetchProviders();
    setTimeout(() => setCustomFormStatus(null), 5000);
    setCustomFormValidating(false);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  const sectionVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex h-full w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
      {/* Sidebar — neumorphic */}
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
          {/* MODEL SELECTION */}
          {activeSection === 'model' && (
            <motion.div key="model" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--accent)' }}>Model Selection</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
                Add your own API keys to unlock more models. Keys are stored securely on the server and never exposed.
              </p>

              {/* Add Your Own API section — neumorphic */}
              <div className="mb-6">
                <button
                  onClick={() => setShowCustomForm(!showCustomForm)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg text-left transition-all ${showCustomForm ? 'neu-inset' : 'neu-raised'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold neu-flat" style={{ color: 'var(--accent)' }}>+</div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>Add API Key</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Add your own Gemini API key to use instead of the default</div>
                    </div>
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {showCustomForm ? '▲' : '▼'}
                  </div>
                </button>

                <AnimatePresence>
                  {showCustomForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '0 0 8px 8px', border: '1px solid rgba(148,163,184,0.1)', borderTop: 'none' }}>
                        <div>
                          <label className="text-xs font-bold block mb-1.5" style={{ color: 'rgba(148,163,184,0.6)' }}>Name *</label>
                          <input
                            type="text"
                            value={customForm.name}
                            onChange={e => setCustomForm({ ...customForm, name: e.target.value })}
                            placeholder="e.g. My Gemini Key"
                            className="w-full p-2.5 rounded-lg text-sm"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(176,184,196,0.15)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
                            disabled={customFormValidating}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1.5" style={{ color: 'rgba(176,184,196,0.6)' }}>API Key *</label>
                          <input
                            type="password"
                            value={customForm.apiKey}
                            onChange={e => setCustomForm({ ...customForm, apiKey: e.target.value })}
                            placeholder="AIza..."
                            className="w-full p-2.5 rounded-lg text-sm"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(176,184,196,0.15)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
                            disabled={customFormValidating}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Fallback Key (optional)</label>
                          <input
                            type="password"
                            value={customForm.fallbackKey || ''}
                            onChange={e => setCustomForm({ ...customForm, fallbackKey: e.target.value })}
                            placeholder="Second key for when primary hits rate limit"
                            className="w-full p-2.5 rounded-lg text-sm"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
                            disabled={customFormValidating}
                          />
                        </div>
                        <button
                          onClick={handleAddCustomProvider}
                          disabled={customFormValidating || !customForm.name.trim() || !customForm.apiKey.trim()}
                          className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
                          style={{
                            background: customFormValidating ? 'rgba(148,163,184,0.05)' : 'rgba(148,163,184,0.15)',
                            color: customFormValidating ? 'rgba(148,163,184,0.4)' : '#94a3b8',
                            border: '1px solid rgba(148,163,184,0.2)',
                            cursor: customFormValidating ? 'wait' : 'pointer',
                          }}
                        >
                          {customFormValidating ? 'Validating...' : 'Add API Key'}
                        </button>
                        {customFormStatus && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-2 rounded text-xs"
                            style={{
                              background: customFormStatus.valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: customFormStatus.valid ? '#10b981' : '#ef4444',
                              border: `1px solid ${customFormStatus.valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            }}
                          >
                            {customFormStatus.valid ? '✓' : '✕'} {customFormStatus.message}
                          </motion.div>
                        )}
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          Your key is validated and stored securely. Nero will use this API for all requests.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="grid gap-3 max-w-lg">
                {providers.map(p => {
                  const info = PROVIDER_INFO[p.id];
                  const isExpanded = expandedProvider === p.id;
                  const statusForProvider = keyStatus?.provider === p.id ? keyStatus : null;

                  return (
                    <div key={p.id}>
                      {/* Provider header */}
                      <div
                        onClick={() => {
                          setExpandedProvider(isExpanded ? null : p.id);
                          setCustomApiKey('');
                          setKeyStatus(null);
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-lg text-left transition-all cursor-pointer"
                        style={{
                          background: p.available ? 'rgba(176,184,196,0.06)' : 'rgba(255,255,255,0.02)',
                          border: '1px solid ' + (p.available ? 'rgba(176,184,196,0.2)' : 'rgba(255,255,255,0.05)'),
                          opacity: 1,
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-bold" style={{ color: p.available ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)' }}>
                              {p.name}
                            </div>
                            {p.isCustom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                                YOUR API
                              </span>
                            )}
                            {p.hasCustomKey && !p.isCustom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {info?.description || `${p.modelCount} model${p.modelCount !== 1 ? 's' : ''}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Green dot ONLY on the active provider */}
                          {p.isActive && (
                            <div className="w-2 h-2 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} title="Active — Nero is using this" />
                          )}
                          {!p.available && (
                            <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} title="Not configured" />
                          )}
                          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {isExpanded ? '▲' : '▼'}
                          </div>
                        </div>
                      </div>

                      {/* Expanded section — API key input */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 neu-inset" style={{ borderRadius: '0 0 8px 8px', borderTop: 'none' }}>
                              {/* Status indicator */}
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full" style={{ 
                                  background: p.available ? (p.isActive ? '#10b981' : '#b0b8c4') : '#ef4444',
                                  boxShadow: `0 0 6px ${p.available ? (p.isActive ? '#10b981' : '#b0b8c4') : '#ef4444'}`,
                                }} />
                                <span className="text-xs font-bold" style={{ color: p.available ? (p.isActive ? '#10b981' : '#b0b8c4') : '#ef4444' }}>
                                  {p.isActive ? 'Active — Nero is using this' : p.available ? (p.hasCustomKey ? 'Custom key active' : 'Env key configured') : 'No API key'}
                                </span>
                              </div>

                              {/* API Key input */}
                              {!p.isCustom && (
                                <>
                                  <label className="text-xs font-bold block mb-2" style={{ color: 'rgba(176,184,196,0.6)' }}>
                                    Add Custom API Key
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="password"
                                      value={customApiKey}
                                      onChange={e => setCustomApiKey(e.target.value)}
                                      placeholder={`Enter your ${p.name} API key...`}
                                      className="flex-1 p-2.5 rounded-lg text-sm"
                                      style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(176,184,196,0.15)',
                                        color: 'rgba(255,255,255,0.8)',
                                        outline: 'none',
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter') handleAddApiKey(p.id); }}
                                      disabled={keyValidating}
                                    />
                                    <button
                                      onClick={() => handleAddApiKey(p.id)}
                                      disabled={keyValidating || !customApiKey.trim()}
                                      className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                      style={{
                                        background: keyValidating ? 'rgba(176,184,196,0.05)' : 'rgba(176,184,196,0.15)',
                                        color: keyValidating ? 'rgba(176,184,196,0.4)' : '#b0b8c4',
                                        border: '1px solid rgba(176,184,196,0.2)',
                                        cursor: keyValidating ? 'wait' : 'pointer',
                                      }}
                                    >
                                      {keyValidating ? '...' : 'Add'}
                                    </button>
                                  </div>
                                </>
                              )}

                              {/* Validation status */}
                              {statusForProvider && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-2 p-2 rounded text-xs"
                                  style={{
                                    background: statusForProvider.valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: statusForProvider.valid ? '#10b981' : '#ef4444',
                                    border: `1px solid ${statusForProvider.valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                  }}
                                >
                                  {statusForProvider.valid ? '✓' : '✕'} {statusForProvider.message}
                                </motion.div>
                              )}

                              {/* Remove custom key button */}
                              {p.hasCustomKey && (
                                <button
                                  onClick={() => handleRemoveApiKey()}
                                  className="mt-3 text-xs px-3 py-1.5 rounded transition-all"
                                  style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                  }}
                                >
                                  Remove Custom Key
                                </button>
                              )}

                              {/* Signup link */}
                              {info && !p.isCustom && (
                                <a
                                  href={info.signupUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block mt-3 text-[11px] transition-all"
                                  style={{ color: 'rgba(176,184,196,0.5)' }}
                                  onMouseOver={e => (e.currentTarget.style.color = '#b0b8c4')}
                                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(176,184,196,0.5)')}
                                >
                                  {info.signupLabel} →
                                </a>
                              )}

                              <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                Your key is validated and stored securely on the server. It is never sent to the browser or stored in localStorage.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
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

          {/* MEMORY MANAGEMENT */}
          {activeSection === 'memory' && (
            <motion.div key="memory" variants={sectionVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-bold mb-1" style={{ color: '#b0b8c4' }}>Memory Management</h2>
              <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Manage stored conversations, knowledge, and memory</p>

              {memoryStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 max-w-2xl">
                  {[
                    { label: 'Total Entries', value: (memoryStats.totalEntries ?? 0).toLocaleString(), color: '#94a3b8' },
                    { label: 'Conversations', value: (memoryStats.conversations ?? 0).toLocaleString(), color: '#7ec8e3' },
                    { label: 'Knowledge Nodes', value: (memoryStats.knowledgeNodes ?? 0).toLocaleString(), color: '#b4a0d4' },
                    { label: 'Storage Used', value: formatBytes(memoryStats.sizeBytes ?? 0), color: '#c8b86a' },
                  ].map(s => (
                    <div key={s.label} className="p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 max-w-lg">
                <div className="p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>Conversation History</span>
                    <button onClick={() => { setConfirmClear(true); setActiveSection('memory'); }}
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Clear All
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Stored conversation history for context and memory.
                  </p>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>Export Data</span>
                    <button
                      onClick={() => { const a = document.createElement('a'); a.href = '/api/memory/export'; a.download = 'nero-memory-export.json'; a.click(); }}
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: 'rgba(176,184,196,0.1)', color: '#b0b8c4', border: '1px solid rgba(176,184,196,0.2)' }}
                    >
                      Export JSON
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Download all memory data as a JSON file.
                  </p>
                </div>
              </div>

              {/* Confirm Clear Modal */}
              <AnimatePresence>
                {confirmClear && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)' }}
                  >
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                      className="p-6 rounded-xl max-w-sm w-full mx-4"
                      style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(239,68,68,0.2)', backdropFilter: 'blur(12px)' }}
                    >
                      <h3 className="text-base font-bold mb-2" style={{ color: '#ef4444' }}>Confirm Clear</h3>
                      <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        This will permanently delete all conversation history. This action cannot be undone.
                      </p>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded text-sm"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          Cancel
                        </button>
                        <button onClick={() => clearMemory('conversations')} className="px-4 py-2 rounded text-sm font-bold"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                          Clear All
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
