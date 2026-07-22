'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Skill {
  name: string;
  description: string;
}

interface SkillCategory {
  category: string;
  icon: string;
  label: string;
  brain: string;
  skills: Skill[];
  count: number;
}

interface SkillsData {
  total: number;
  categories: SkillCategory[];
  brainMap: Record<string, SkillCategory[]>;
}

const BRAIN_COLORS: Record<string, string> = {
  coding: '#94a3b8',
  creative: '#b4a0d4',
  automation: '#8fb996',
  memory: '#c8b86a',
  reasoning: '#7ec8e3',
  research: '#7b8da4',
  learning: '#d4736e',
};

const BRAIN_ICONS: Record<string, string> = {
  coding: '⚡',
  creative: '🎨',
  automation: '⚙️',
  memory: '🧠',
  reasoning: '💡',
  research: '🔬',
  learning: '📚',
};

export default function SkillsPanel() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [activeBrain, setActiveBrain] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSkills();
  }, []);

  async function fetchSkills() {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = data?.categories.filter((cat) => {
    if (activeBrain && cat.brain !== activeBrain) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        cat.label.toLowerCase().includes(q) ||
        cat.skills.some((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      );
    }
    return true;
  }) || [];

  const brains = data
    ? Object.entries(data.brainMap).map(([brain, cats]) => ({
        brain,
        count: cats.reduce((sum, c) => sum + c.count, 0),
      }))
    : [];

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading skills...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(0,191,255,0.15), rgba(167,139,250,0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              ⚡
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Agent Skills
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {data?.total || 0} skills loaded across {data?.categories.length || 0} categories
              </p>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input"
              style={{ width: 200, paddingLeft: 32, fontSize: 12 }}
            />
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              🔍
            </span>
          </div>
        </div>

        {/* Brain Filter Chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveBrain(null)}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${!activeBrain ? 'var(--accent)' : 'var(--border-default)'}`,
              background: !activeBrain ? 'var(--accent-dim)' : 'transparent',
              color: !activeBrain ? 'var(--accent)' : 'var(--text-tertiary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-sans)',
            }}
          >
            All ({data?.total || 0})
          </button>
          {brains.map(({ brain, count }) => (
            <button
              key={brain}
              onClick={() => setActiveBrain(activeBrain === brain ? null : brain)}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: `1px solid ${activeBrain === brain ? BRAIN_COLORS[brain] : 'var(--border-default)'}`,
                background: activeBrain === brain ? `${BRAIN_COLORS[brain]}15` : 'transparent',
                color: activeBrain === brain ? BRAIN_COLORS[brain] : 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{BRAIN_ICONS[brain]}</span>
              {brain} ({count})
            </button>
          ))}
        </div>
      </motion.div>

      {/* Skill Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
          {filteredCategories.map((cat, idx) => (
            <motion.div
              key={cat.category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card"
              style={{ overflow: 'hidden' }}
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18 }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cat.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: `${BRAIN_COLORS[cat.brain]}15`,
                        color: BRAIN_COLORS[cat.brain],
                        border: `1px solid ${BRAIN_COLORS[cat.brain]}30`,
                      }}
                    >
                      {cat.brain} brain
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {cat.count} skill{cat.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <motion.span
                  animate={{ rotate: expandedCategory === cat.category ? 180 : 0 }}
                  style={{ fontSize: 12, color: 'var(--text-muted)' }}
                >
                  ▼
                </motion.span>
              </button>

              {/* Expanded Skills List */}
              <AnimatePresence>
                {expandedCategory === cat.category && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        padding: '8px 12px',
                      }}
                    >
                      {cat.skills.map((skill, sIdx) => (
                        <motion.div
                          key={skill.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: sIdx * 0.03 }}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '8px 8px',
                            borderRadius: 8,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg-subtle)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: BRAIN_COLORS[cat.brain],
                              marginTop: 5,
                              flexShrink: 0,
                              boxShadow: `0 0 6px ${BRAIN_COLORS[cat.brain]}60`,
                            }}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {skill.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                              {skill.description}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredCategories.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card"
          style={{ padding: 40, textAlign: 'center' }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            No skills match your search
          </div>
        </motion.div>
      )}
    </div>
  );
}
