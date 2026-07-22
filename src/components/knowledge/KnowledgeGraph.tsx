'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthHeaders } from '@/lib/user-id';

interface KGNode {
  id: string;
  label: string;
  type: 'concept' | 'project' | 'goal' | 'memory' | 'person' | 'note';
  description?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface KGEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const NODE_COLORS: Record<string, string> = {
  concept: '#b0b8c4',
  project: '#6b8ca8',
  goal: '#8898b8',
  memory: '#7b8da4',
  person: '#a0b8d0',
  note: '#5a6270',
};

const NODE_TYPES = Object.keys(NODE_COLORS);

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: KGNode | null;
}

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<KGNode[]>([]);
  const [edges, setEdges] = useState<KGEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, node: null });
  const [showAddForm, setShowAddForm] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [newNode, setNewNode] = useState({ label: '', type: 'concept', description: '' });
  const [newEdgeLabel, setNewEdgeLabel] = useState('');

  // Pan and zoom state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const animFrame = useRef<number>(0);
  const nodesRef = useRef<KGNode[]>([]);
  const edgesRef = useRef<KGEdge[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/knowledge', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const n: KGNode[] = (data.nodes || []).map((nd: KGNode, i: number) => ({
          ...nd,
          x: nd.x ?? (Math.random() - 0.5) * 600,
          y: nd.y ?? (Math.random() - 0.5) * 400,
          vx: 0,
          vy: 0,
        }));
        setNodes(n);
        setEdges(data.edges || []);
      } catch {
        showToast('Failed to load knowledge graph', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  // Keep refs in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Force-directed layout simulation
  useEffect(() => {
    const runSim = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (ns.length === 0) { animFrame.current = requestAnimationFrame(runSim); return; }

      const repulsion = 5000;
      const attraction = 0.005;
      const damping = 0.85;
      const centerPull = 0.001;

      for (let i = 0; i < ns.length; i++) {
        if (ns[i].id === dragNode) continue;
        let fx = 0, fy = 0;

        // Repulsion from other nodes
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue;
          const dx = (ns[i].x || 0) - (ns[j].x || 0);
          const dy = (ns[i].y || 0) - (ns[j].y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) + 1;
          const force = repulsion / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        // Attraction from edges
        for (const edge of es) {
          let other: KGNode | undefined;
          if (edge.source === ns[i].id) other = ns.find(n => n.id === edge.target);
          else if (edge.target === ns[i].id) other = ns.find(n => n.id === edge.source);
          if (!other) continue;
          const dx = (other.x || 0) - (ns[i].x || 0);
          const dy = (other.y || 0) - (ns[i].y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          fx += dx * attraction;
          fy += dy * attraction;
        }

        // Center pull
        fx -= (ns[i].x || 0) * centerPull;
        fy -= (ns[i].y || 0) * centerPull;

        ns[i].vx = ((ns[i].vx || 0) + fx) * damping;
        ns[i].vy = ((ns[i].vy || 0) + fy) * damping;
        ns[i].x = (ns[i].x || 0) + (ns[i].vx || 0);
        ns[i].y = (ns[i].y || 0) + (ns[i].vy || 0);
      }

      nodesRef.current = [...ns];
      animFrame.current = requestAnimationFrame(runSim);
    };
    animFrame.current = requestAnimationFrame(runSim);
    return () => cancelAnimationFrame(animFrame.current);
  }, [dragNode]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let drawFrame: number;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { drawFrame = requestAnimationFrame(draw); return; }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      const ns = nodesRef.current;
      const es = edgesRef.current;
      const nodeMap = new Map(ns.map(n => [n.id, n]));

      // Draw edges
      for (const edge of es) {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.moveTo(src.x || 0, src.y || 0);
        ctx.lineTo(tgt.x || 0, tgt.y || 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (edge.label) {
          const mx = ((src.x || 0) + (tgt.x || 0)) / 2;
          const my = ((src.y || 0) + (tgt.y || 0)) / 2;
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, mx, my - 6);
        }
      }

      // Connect mode line
      if (connectMode && connectSource) {
        const src = nodeMap.get(connectSource);
        if (src) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#b0b8c4';
          ctx.lineWidth = 1.5;
          ctx.moveTo(src.x || 0, src.y || 0);
          // Draw to last known mouse position (approximate center)
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw nodes
      for (const node of ns) {
        const color = NODE_COLORS[node.type] || '#b0b8c4';
        const isSelected = selectedNode?.id === node.id;
        const isConnectSource = connectSource === node.id;
        const radius = isSelected || isConnectSource ? 18 : 14;

        // Glow
        if (isSelected || isConnectSource) {
          ctx.beginPath();
          const grd = ctx.createRadialGradient(node.x || 0, node.y || 0, radius, node.x || 0, node.y || 0, radius + 20);
          grd.addColorStop(0, `${color}33`);
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.arc(node.x || 0, node.y || 0, radius + 20, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = `${color}22`;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();

        // Label
        ctx.font = isSelected ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, (node.x || 0), (node.y || 0) + radius + 14);

        // Type dot
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.restore();
      drawFrame = requestAnimationFrame(draw);
    };
    drawFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(drawFrame);
  }, [camera, selectedNode, connectMode, connectSource]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Helper: screen to world coords
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const w = canvas.width;
    const h = canvas.height;
    return {
      x: (sx - w / 2 - camera.x) / camera.zoom,
      y: (sy - h / 2 - camera.y) / camera.zoom,
    };
  }, [camera]);

  // Helper: find node at position
  const findNodeAt = useCallback((wx: number, wy: number) => {
    for (const node of nodesRef.current) {
      const dx = (node.x || 0) - wx;
      const dy = (node.y || 0) - wy;
      if (Math.sqrt(dx * dx + dy * dy) < 20) return node;
    }
    return null;
  }, []);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    const node = findNodeAt(world.x, world.y);

    if (connectMode && node) {
      if (!connectSource) {
        setConnectSource(node.id);
      } else if (connectSource !== node.id) {
        // Create edge
        const newEdge: KGEdge = {
          id: `${connectSource}-${node.id}`,
          source: connectSource,
          target: node.id,
          label: newEdgeLabel || undefined,
        };
        setEdges(prev => [...prev, newEdge]);
        setConnectSource(null);
        setConnectMode(false);
        setNewEdgeLabel('');
        showToast('Connection created');
      }
      return;
    }

    if (node) {
      setDragNode(node.id);
      setIsDragging(true);
    } else {
      setPanStart({ x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y });
      setIsDragging(true);
    }
  }, [connectMode, connectSource, newEdgeLabel, camera, screenToWorld, findNodeAt, showToast]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);

    if (isDragging && dragNode) {
      setNodes(prev => prev.map(n =>
        n.id === dragNode ? { ...n, x: world.x, y: world.y, vx: 0, vy: 0 } : n
      ));
      nodesRef.current = nodesRef.current.map(n =>
        n.id === dragNode ? { ...n, x: world.x, y: world.y, vx: 0, vy: 0 } : n
      );
      return;
    }

    if (isDragging && panStart) {
      setCamera(prev => ({
        ...prev,
        x: panStart.camX + (e.clientX - panStart.x),
        y: panStart.camY + (e.clientY - panStart.y),
      }));
      return;
    }

    // Hover tooltip
    const node = findNodeAt(world.x, world.y);
    if (node && node.description) {
      setTooltip({ visible: true, x: e.clientX + 12, y: e.clientY + 12, node });
    } else {
      setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev);
    }
  }, [isDragging, dragNode, panStart, screenToWorld, findNodeAt]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && !dragNode && panStart) {
      // If barely moved, treat as click
      const dist = Math.abs(e.clientX - panStart.x) + Math.abs(e.clientY - panStart.y);
      if (dist < 5) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          const node = findNodeAt(world.x, world.y);
          setSelectedNode(node || null);
        }
      }
    }
    setIsDragging(false);
    setDragNode(null);
    setPanStart(null);
  }, [isDragging, dragNode, panStart, screenToWorld, findNodeAt]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.2, Math.min(5, prev.zoom * factor)),
    }));
  }, []);

  const handleAddNode = async () => {
    if (!newNode.label.trim()) { showToast('Label is required', 'error'); return; }
    const node: KGNode = {
      id: `node-${Date.now()}`,
      label: newNode.label,
      type: newNode.type as KGNode['type'],
      description: newNode.description,
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    };
    setNodes(prev => [...prev, node]);
    setShowAddForm(false);
    setNewNode({ label: '', type: 'concept', description: '' });
    showToast('Node added');

    // Optionally persist
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(node),
      });
    } catch { /* silent */ }
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#0a0b0f',
    overflow: 'hidden',
  };

  const canvasStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    cursor: connectMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
    display: 'block',
  };

  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    left: 16,
    display: 'flex',
    gap: 8,
    zIndex: 10,
  };

  const btnStyle: React.CSSProperties = {
    background: '#16171d',
    borderRadius: 8,
    boxShadow: '3px 3px 6px rgba(0, 0, 0, 0.4), -3px -3px 6px rgba(40, 44, 52, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    padding: '8px 14px',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  };

  const activeBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: '#0e0f13',
    boxShadow: 'inset 3px 3px 6px rgba(0, 0, 0, 0.5), inset -3px -3px 6px rgba(40, 44, 52, 0.06)',
    border: '1px solid rgba(176, 184, 196, 0.15)',
    color: '#b0b8c4',
  };

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 280,
    height: '100%',
    background: '#0e0f13',
    boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.4)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
    padding: 20,
    overflowY: 'auto',
    zIndex: 10,
  };

  const formContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 280,
    background: 'rgba(10, 11, 15, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    zIndex: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0e0f13',
    boxShadow: 'inset 3px 3px 6px rgba(0, 0, 0, 0.5), inset -3px -3px 6px rgba(40, 44, 52, 0.06)',
    border: '1px solid rgba(0, 0, 0, 0.15)',
    borderRadius: 6,
    padding: '8px 10px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 8,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
  };

  return (
    <motion.div
      ref={containerRef}
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <canvas
        ref={canvasRef}
        style={canvasStyle}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setDragNode(null); setPanStart(null); }}
        onWheel={handleWheel}
      />

      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button style={btnStyle} onClick={() => setShowAddForm(!showAddForm)}>
          + Add Node
        </button>
        <button
          style={connectMode ? activeBtnStyle : btnStyle}
          onClick={() => { setConnectMode(!connectMode); setConnectSource(null); }}
        >
          {connectMode ? '🔗 Connecting...' : '🔗 Connect'}
        </button>
        <button style={btnStyle} onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}>
          ⊙ Reset View
        </button>
        <span style={{ ...btnStyle, cursor: 'default', color: 'rgba(255,255,255,0.4)' }}>
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      {/* Connect mode edge label */}
      {connectMode && connectSource && (
        <motion.div
          style={{ ...formContainerStyle, top: 60, width: 220 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label style={labelStyle}>Edge Label (optional)</label>
          <input
            style={inputStyle}
            placeholder="e.g. related_to"
            value={newEdgeLabel}
            onChange={e => setNewEdgeLabel(e.target.value)}
          />
          <div style={{ fontSize: 11, color: '#b0b8c4' }}>Click a target node to connect</div>
        </motion.div>
      )}

      {/* Add Node Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            style={formContainerStyle}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 12 }}>
              Add Knowledge Node
            </div>
            <label style={labelStyle}>Label *</label>
            <input
              style={inputStyle}
              placeholder="Node label..."
              value={newNode.label}
              onChange={e => setNewNode(prev => ({ ...prev, label: e.target.value }))}
              autoFocus
            />
            <label style={labelStyle}>Type</label>
            <select
              style={selectStyle}
              value={newNode.type}
              onChange={e => setNewNode(prev => ({ ...prev, type: e.target.value }))}
            >
              {NODE_TYPES.map(t => (
                <option key={t} value={t} style={{ background: '#0d1117' }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const, fontFamily: 'inherit' }}
              placeholder="Optional description..."
              value={newNode.description}
              onChange={e => setNewNode(prev => ({ ...prev, description: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                style={{ ...btnStyle, flex: 1, justifyContent: 'center', background: 'rgba(176, 184, 196, 0.15)', borderColor: 'rgba(176, 184, 196, 0.3)', color: '#b0b8c4' }}
                onClick={handleAddNode}
              >
                Add Node
              </button>
              <button style={{ ...btnStyle, flex: 1, justifyContent: 'center' }} onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected node details panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            style={panelStyle}
            initial={{ x: 280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Node Details</span>
              <button
                style={{ ...btnStyle, padding: '4px 8px', fontSize: 11 }}
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Label</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{selectedNode.label}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Type</span>
              <div style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: `${NODE_COLORS[selectedNode.type]}22`,
                color: NODE_COLORS[selectedNode.type],
                border: `1px solid ${NODE_COLORS[selectedNode.type]}44`,
              }}>
                {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
              </div>
            </div>
            {selectedNode.description && (
              <div style={{ marginBottom: 12 }}>
                <span style={labelStyle}>Description</span>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                  {selectedNode.description}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Connections</span>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} edges
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Position</span>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                x: {(selectedNode.x || 0).toFixed(1)}, y: {(selectedNode.y || 0).toFixed(1)}
              </div>
            </div>
            <button
              style={{ ...btnStyle, width: '100%', justifyContent: 'center', marginTop: 8, color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.2)' }}
              onClick={() => {
                setNodes(prev => prev.filter(n => n.id !== selectedNode.id));
                setEdges(prev => prev.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNode(null);
                showToast('Node deleted');
              }}
            >
              🗑️ Delete Node
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(10, 11, 15, 0.8)',
              zIndex: 30,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#b0b8c4',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.node && (
          <motion.div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: 'rgba(10, 11, 15, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              maxWidth: 240,
              zIndex: 100,
              pointerEvents: 'none',
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: NODE_COLORS[tooltip.node.type] || '#b0b8c4', marginBottom: 4 }}>
              {tooltip.node.label}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              {tooltip.node.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              zIndex: 200,
              background: toast.type === 'error' ? 'rgba(248, 113, 113, 0.9)' : 'rgba(52, 211, 153, 0.9)',
              color: toast.type === 'error' ? '#fff' : '#0a0b0f',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </motion.div>
  );
}
