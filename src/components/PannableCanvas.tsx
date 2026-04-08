import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// ─── Layout Constants (shared with flowchart renderers) ──────────────────────

export const W = 560;       // inner canvas width
export const CX = W / 2;   // 280 — center x
export const LX = 140;     // left branch x
export const RX = W - LX;  // right branch x
export const NR = 20;      // node radius
export const ND = NR * 2;  // 40 — node diameter

export const G = {
  LABEL_H: 60,
  B_LABEL_H: 60,
  CONN: 20,
  PRE: 24,
  DROP: 58,
  RET_DOWN: 36,
  RET_CONT: 18,
  TOP: 10,
  BOT: 32,
};

export const MAIN_LW = 312;
export const BR_LW = 228;
export const BR_FORK_LW = 140;
export const FC_RX = W - 40;

export const DU = 0.18; // base delay unit

// ─── Pannable Dot-Grid Canvas ────────────────────────────────────────────────

interface PannableCanvasProps {
  workflowId: string;
  children: React.ReactNode;
}

export const PannableCanvas: React.FC<PannableCanvasProps> = ({ workflowId, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const prevId = useRef(workflowId);
  if (prevId.current !== workflowId) {
    prevId.current = workflowId;
    hasDragged.current = false;
  }

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0 && !hasDragged.current) {
        const px = 16;
        setOffset({ x: (w / 2) - CX - px, y: 0 });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [workflowId]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    hasDragged.current = true;
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const stopDrag = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative select-none"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        className="py-6 px-4"
      >
        {children}
      </div>
    </div>
  );
};
