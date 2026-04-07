import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Workflow, TimeoutValue, ScopeValue, TimeOffTypeValue, StatusConditionValue, ApproversValue } from '../types';
import { displayNodeValueLabel, displayScopeValue, displayTimeOffTypeValue, displayStatusConditionValue, formatOperandLabel } from '../lib/nodes';
import { motion } from 'motion/react';
import { User, Bell, Star, X, ThumbsUp, ThumbsDown, Clock, UserX } from 'lucide-react';

// ─── Step Types & Parser ──────────────────────────────────────────────────────

type StepKind = 'start' | 'notify' | 'fork' | 'condition_fork' | 'end';

interface TimelineStep {
  kind: StepKind;
  actor?: string;
  description?: string;
  forkTimeout?: string;
  forkEscalationActor?: string;
  conditionTriggers?: string;
  conditionBackupActor?: string;
  backup?: string;
  forkChild?: boolean;  // step sits directly below a fork's escalation branch
}

function fmt(v: TimeoutValue): string {
  const u = v.amount === 1 ? v.unit.replace(/s$/, '') : v.unit;
  return `${v.amount} ${u}`;
}

function parseWorkflowSteps(workflow: Workflow): TimelineStep[] {
  const ids = (workflow.template.match(/\{([^{}]+)\}/g) ?? []).map((p) => p.slice(1, -1).trim());
  const steps: TimelineStep[] = [];
  let hasRequester = false;
  let i = 0;

  while (i < ids.length) {
    const id = ids[i];
    const node = workflow.nodes[id];
    if (!node || node.type === 'scope' || node.type === 'time_off_type') { i++; continue; }

    if (node.type === 'approvers' && id === 'requester') {
      hasRequester = true;
      steps.push({ kind: 'start', actor: displayNodeValueLabel(node.type, node.value), description: 'initiates the request' });
      i++; continue;
    }

    if (node.type === 'approvers') {
      const nextNode = workflow.nodes[ids[i + 1]];
      const backup = (node.value as ApproversValue).backup
        ? formatOperandLabel((node.value as ApproversValue).backup!)
        : undefined;

      if (nextNode?.type === 'status_condition') {
        const bn = workflow.nodes[ids[i + 2]];
        steps.push({
          kind: 'condition_fork',
          actor: displayNodeValueLabel(node.type, node.value),
          conditionTriggers: displayStatusConditionValue(nextNode.value as StatusConditionValue),
          conditionBackupActor: bn ? displayNodeValueLabel(bn.type, bn.value) : undefined,
          backup,
        });
        // Add the backup approver as a separate notify step below the fork
        if (bn) {
          const bnBackup = (bn.value as ApproversValue)?.backup
            ? formatOperandLabel((bn.value as ApproversValue).backup!)
            : undefined;
          steps.push({ kind: 'notify', actor: displayNodeValueLabel(bn.type, bn.value), backup: bnBackup, forkChild: true });
        }
        i += 3; continue;
      }
      if (nextNode?.type === 'timeout') {
        const en = workflow.nodes[ids[i + 2]];
        steps.push({
          kind: 'fork',
          actor: displayNodeValueLabel(node.type, node.value),
          forkTimeout: fmt(nextNode.value as TimeoutValue),
          forkEscalationActor: en ? displayNodeValueLabel(en.type, en.value) : undefined,
          backup,
        });
        // Add the escalation approver as a separate notify step below the fork
        if (en) {
          const enBackup = (en.value as ApproversValue)?.backup
            ? formatOperandLabel((en.value as ApproversValue).backup!)
            : undefined;
          steps.push({ kind: 'notify', actor: displayNodeValueLabel(en.type, en.value), backup: enBackup, forkChild: true });
        }
        i += 3; continue;
      }
      steps.push({ kind: 'notify', actor: displayNodeValueLabel(node.type, node.value), backup });
      i++; continue;
    }
    i++;
  }

  if (!hasRequester) steps.unshift({ kind: 'start', description: 'Employee submits request' });
  const last = steps[steps.length - 1];
  if (last && last.kind !== 'fork' && last.kind !== 'condition_fork') steps.push({ kind: 'end', description: 'Request Approved.' });
  return steps;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const W = 560;       // inner canvas width
const CX = W / 2;   // 280 — center x
const LX = 140;     // left branch x
const RX = W - LX;  // right branch x
const NR = 20;      // node radius
const ND = NR * 2;  // 40 — node diameter

const G = {
  LABEL_H: 60,    // fallback label height (overridden by DOM measurement)
  B_LABEL_H: 60,  // branch label box height
  CONN: 20,       // connector gap from label bottom to next node
  PRE: 24,        // gap from label bottom to horizontal split
  DROP: 58,       // from split y to branch node center
  RET_DOWN: 36,   // from branch node bottom down to return turn
  RET_CONT: 18,   // from return turn down to next node top
  TOP: 10,
  BOT: 32,
};

const MAIN_LW = 312;  // main label max-width
const BR_LW = 228;    // branch label max-width (2-branch)
const BR_FORK_LW = 140; // branch label max-width (3-branch fork)
const FC_RX = W - 40;   // right branch x for fork-child steps

interface SL {
  step: TimelineStep;
  nodeY: number;
  labelY: number;
  splitY?: number;
  branchY?: number;
  branchLabelY?: number;
  retY?: number;
  endY: number;
}

function calcLayout(steps: TimelineStep[], labelHeights: number[]): { items: SL[]; totalH: number } {
  let y = G.TOP;
  const items = steps.map((step, i): SL => {
    const nodeY = y + NR;
    const labelY = nodeY + NR + 7;
    const isA = step.kind !== 'start' && step.kind !== 'end';
    const lh = labelHeights[i] ?? G.LABEL_H;

    if (isA) {
      const splitY = labelY + lh + G.PRE;
      const branchY = splitY + G.DROP;
      const branchLabelY = branchY + NR + 7;
      const retY = branchLabelY + G.B_LABEL_H + G.RET_DOWN;
      const endY = retY + G.RET_CONT;
      y = endY;
      return { step, nodeY, labelY, splitY, branchY, branchLabelY, retY, endY };
    } else {
      const endY = labelY + lh + G.CONN;
      y = endY;
      return { step, nodeY, labelY, endY };
    }
  });
  return { items, totalH: y + G.BOT };
}

// ─── Flowchart Component ──────────────────────────────────────────────────────

const DU = 0.18; // base delay unit

const Flowchart: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
  const labelElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [labelHeights, setLabelHeights] = useState<number[]>(() =>
    steps.map(() => G.LABEL_H)
  );

  useLayoutEffect(() => {
    const measured = steps.map((_, i) => labelElsRef.current[i]?.offsetHeight ?? G.LABEL_H);
    setLabelHeights(measured);
  }, [steps]);

  const { items, totalH } = calcLayout(steps, labelHeights);

  const pathEls: React.ReactElement[] = [];
  const nodeEls: React.ReactElement[] = [];
  let t = 0;
  let pk = 0;
  let nk = 0;

  const addPath = (d: string, dur: number, at?: number) => {
    const delay = at ?? t;
    pathEls.push(
      <motion.path
        key={pk++}
        d={d}
        stroke="#94a3b8"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay, duration: dur, ease: 'easeInOut' }}
      />
    );
    if (at === undefined) t += dur + DU * 0.35;
  };

  const addNode = (
    cx: number, cy: number,
    bg: string, border: string,
    Icon: React.ElementType,
    iconCls: string,
    iconProps?: Record<string, any>
  ) => {
    nodeEls.push(
      <motion.div
        key={nk++}
        style={{ position: 'absolute', left: cx - NR, top: cy - NR, width: ND, height: ND }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: t, type: 'spring', stiffness: 380, damping: 24 }}
        className={`rounded-full border-2 flex items-center justify-center ${bg} ${border}`}
      >
        <Icon size={16} className={iconCls} {...(iconProps ?? {})} />
      </motion.div>
    );
  };

  const addLabel = (
    cx: number, topY: number, maxW: number,
    main: string, sub?: string,
    chips?: string[],
    refCallback?: (el: HTMLDivElement | null) => void,
    actor?: string
  ) => {
    nodeEls.push(
      <div
        key={nk++}
        style={{ position: 'absolute', left: cx, top: topY, transform: 'translateX(-50%)' }}
      >
        <motion.div
          ref={refCallback}
          style={{ width: 'max-content', maxWidth: maxW, textAlign: 'center' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t + 0.10, duration: 0.30 }}
          className="rounded-xl border px-3 py-2.5 bg-white border-slate-200 shadow-sm"
        >
          <p className="text-[12px] font-semibold text-slate-700 leading-snug">
            {actor
              ? <><span className="text-indigo-600">{actor}</span>{' '}{main}</>
              : main}
          </p>
          {chips && chips.length > 0 && (
            <div className="flex justify-center gap-1 mt-1.5 flex-wrap">
              {chips.map((chip) => (
                <span key={chip} className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          )}
          {sub && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{sub}</p>}
        </motion.div>
      </div>
    );
  };

  items.forEach((item, i) => {
    const { step, nodeY, labelY, splitY, branchY, branchLabelY, retY } = item;
    const isA = step.kind !== 'start' && step.kind !== 'end';
    const next = items[i + 1];
    const isForkChild = !!step.forkChild;

    // Step center X: fork-child steps sit at RX (below the No Response column)
    const sX = isForkChild ? RX : CX;

    // ── Main node ──
    const isEnd = step.kind === 'end';
    const isStart = step.kind === 'start';
    const MIcon = isStart ? User : isEnd ? Star : Bell;
    const mBg = isEnd ? 'bg-amber-50' : 'bg-white';
    const mBrd = isEnd ? 'border-amber-300' : 'border-slate-300';
    const mIcn = isEnd ? 'text-amber-500' : 'text-slate-500';
    const mIconProps = isEnd ? { fill: 'currentColor', stroke: 'currentColor' } : {};

    addNode(sX, nodeY, mBg, mBrd, MIcon, mIcn, mIconProps);

    const actor = (!isEnd) ? (step.actor ?? 'Employee') : undefined;
    const mainText = isStart ? 'Submits Request'
      : isEnd ? 'Request Approved'
      : 'Receives Request';
    const subText = isEnd ? 'Email sent to employee.' : undefined;
    const chips = (!isStart && !isEnd) ? ['Inbox', 'Email'] : undefined;

    addLabel(sX, labelY, MAIN_LW, mainText, subText, chips,
      (el) => { labelElsRef.current[i] = el; }, actor);
    t += DU * 1.3;

    if (isA) {
      const R = 18; // corner radius for rounded bends
      const isFork = step.kind === 'fork' || step.kind === 'condition_fork';

      // Branch X positions: fork-child uses CX (left) / FC_RX (right)
      const sLX = isForkChild ? CX : LX;
      const sRX = isForkChild ? FC_RX : RX;

      // Line: main node bottom → split
      addPath(`M ${sX},${nodeY + NR} L ${sX},${splitY}`, 0.22);

      // Left arm: sX → sLX with rounded corner
      addPath(
        `M ${sX},${splitY} L ${sLX + R},${splitY} Q ${sLX},${splitY} ${sLX},${splitY + R} L ${sLX},${branchY! - NR}`,
        0.30
      );

      if (isFork) {
        // Center drop (Rejected): straight down from sX
        const tCDrop = t - 0.30 + 0.06;
        addPath(`M ${sX},${splitY} L ${sX},${branchY! - NR}`, 0.18, tCDrop);

        // Right arm (Escalated): sX → sRX with rounded corner
        const tRDrop = t - 0.30 + 0.10;
        addPath(
          `M ${sX},${splitY} L ${sRX - R},${splitY} Q ${sRX},${splitY} ${sRX},${splitY + R} L ${sRX},${branchY! - NR}`,
          0.28, tRDrop
        );
      } else {
        // Right arm (Rejected for notify): sX → sRX with rounded corner
        const tRDrop = t - 0.30 + 0.05;
        addPath(
          `M ${sX},${splitY} L ${sRX - R},${splitY} Q ${sRX},${splitY} ${sRX},${splitY + R} L ${sRX},${branchY! - NR}`,
          0.28, tRDrop
        );
      }

      // Left branch: Approved (all types)
      addNode(sLX, branchY!, 'bg-emerald-50', 'border-emerald-300', ThumbsUp, 'text-emerald-600');
      addLabel(sLX, branchLabelY!, isFork ? BR_FORK_LW : BR_LW, 'Approved');

      if (isFork) {
        // ── 3-branch layout ──────────────────────────────────────────

        // Center branch: Rejected (dead end — no return)
        t += DU * 0.5;
        addNode(sX, branchY!, 'bg-red-50', 'border-red-200', ThumbsDown, 'text-red-400');
        addLabel(sX, branchLabelY!, BR_FORK_LW, 'Rejected', 'Email is sent to Employee');

        // Right branch: Escalated (continues flow to next approver)
        t += DU * 0.5;
        const EscIcon = step.kind === 'condition_fork' ? UserX : Clock;
        const escLabel = step.kind === 'condition_fork' ? 'Unavailable' : 'No Response';
        const escSub = step.kind === 'fork'
          ? `After ${step.forkTimeout}`
          : `If ${step.conditionTriggers}`;
        addNode(sRX, branchY!, 'bg-amber-50', 'border-amber-200', EscIcon, 'text-amber-500');
        addLabel(sRX, branchLabelY!, BR_FORK_LW, escLabel, escSub);
        t += DU * 1.4;

        // Approved bypass: travels down the left side all the way to the end star
        const endItem = items[items.length - 1];
        const endStarY = endItem.nodeY;
        const tBypass = t;
        addPath(
          `M ${sLX},${branchY! + NR} L ${sLX},${endStarY - NR - R} Q ${sLX},${endStarY - NR} ${sLX + R},${endStarY - NR} L ${CX - R},${endStarY - NR} Q ${CX},${endStarY - NR} ${CX},${endStarY - NR + R}`,
          0.70, tBypass
        );

        // Escalated: straight down to next step (forkChild directly below at RX)
        if (next) {
          addPath(`M ${sRX},${branchY! + NR} L ${sRX},${next.nodeY - NR}`, 0.30);
        }
      } else {
        // ── 2-branch layout (notify) ─────────────────────────────────

        // Right branch: Rejected
        t += DU * 0.7;
        addNode(sRX, branchY!, 'bg-red-50', 'border-red-200', ThumbsDown, 'text-red-400');
        addLabel(sRX, branchLabelY!, BR_LW, 'Rejected', 'Email is sent to Employee');
        t += DU * 1.4;

        // Return from Approved (sLX) → to CX → down to next step
        if (isForkChild) {
          // Left branch already at CX — go straight down to star
          if (next) {
            addPath(`M ${CX},${branchY! + NR} L ${CX},${next.nodeY - NR}`, 0.30);
          }
        } else {
          // Normal: LX → retY → CX → next
          if (next) {
            addPath(
              `M ${sLX},${branchY! + NR} L ${sLX},${retY! - R} Q ${sLX},${retY} ${sLX + R},${retY} L ${CX - R},${retY} Q ${CX},${retY} ${CX},${retY! + R} L ${CX},${next.nodeY - NR}`,
              0.46
            );
          } else {
            addPath(
              `M ${sLX},${branchY! + NR} L ${sLX},${retY! - R} Q ${sLX},${retY} ${sLX + R},${retY} L ${CX},${retY}`,
              0.36
            );
          }
        }
      }
    } else {
      if (next) {
        addPath(`M ${sX},${nodeY + NR} L ${sX},${next.nodeY - NR}`, 0.26);
      }
    }
  });

  return (
    <div className="relative" style={{ width: W, height: totalH }}>
      <svg
        width={W}
        height={totalH}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        {pathEls}
      </svg>
      {nodeEls}
    </div>
  );
};

// ─── Pannable Dot-Grid Canvas ─────────────────────────────────────────────────

interface PannableCanvasProps {
  workflowId: string;
  children: React.ReactNode;
}

const PannableCanvas: React.FC<PannableCanvasProps> = ({ workflowId, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const hasDragged = useRef(false);

  // Reset pan when workflow changes
  const prevId = useRef(workflowId);
  if (prevId.current !== workflowId) {
    prevId.current = workflowId;
    hasDragged.current = false;
  }

  // Keep re-centering as the panel slides open, until the user drags
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

// ─── Sidebar Panel ────────────────────────────────────────────────────────────

interface WorkflowPreviewProps {
  workflow: Workflow;
  groupName: string;
  onClose: () => void;
}

export const WorkflowPreview: React.FC<WorkflowPreviewProps> = ({ workflow, groupName, onClose }) => {
  const steps = parseWorkflowSteps(workflow);

  const scopeLabel = workflow.nodes.scope
    ? displayScopeValue(workflow.nodes.scope.value as ScopeValue) : null;
  const timeOffLabel = workflow.nodes.time_off_type
    ? displayTimeOffTypeValue(workflow.nodes.time_off_type.value as TimeOffTypeValue) : null;
  const contextLine = [scopeLabel, timeOffLabel].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-0 shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Preview</p>
          <h2 className="text-sm font-bold text-slate-900">{groupName}</h2>
          {contextLine && (
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{contextLine}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 shrink-0 mt-1"
        >
          <X size={14} />
        </button>
      </div>

      <div className="border-b border-slate-100 mt-4 mx-5 shrink-0" />

      {/* Flowchart — pannable dot-grid canvas */}
      <PannableCanvas workflowId={workflow.id}>
        <Flowchart key={workflow.id} steps={steps} />
      </PannableCanvas>
    </div>
  );
};
