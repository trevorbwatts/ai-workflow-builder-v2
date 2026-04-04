import React from 'react';
import { Workflow, TimeoutValue, ScopeValue, TimeOffTypeValue, StatusConditionValue, ApproversValue } from '../types';
import { displayNodeValue, displayScopeValue, displayTimeOffTypeValue, displayStatusConditionValue, formatOperand } from '../lib/nodes';
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
      steps.push({ kind: 'start', actor: displayNodeValue(node.type, node.value), description: 'initiates the request' });
      i++; continue;
    }

    if (node.type === 'approvers') {
      const nextNode = workflow.nodes[ids[i + 1]];
      const backup = (node.value as ApproversValue).backup
        ? formatOperand((node.value as ApproversValue).backup!)
        : undefined;

      if (nextNode?.type === 'status_condition') {
        const bn = workflow.nodes[ids[i + 2]];
        steps.push({
          kind: 'condition_fork',
          actor: displayNodeValue(node.type, node.value),
          conditionTriggers: displayStatusConditionValue(nextNode.value as StatusConditionValue),
          conditionBackupActor: bn ? displayNodeValue(bn.type, bn.value) : undefined,
          backup,
        });
        i += 3; continue;
      }
      if (nextNode?.type === 'timeout') {
        const en = workflow.nodes[ids[i + 2]];
        steps.push({
          kind: 'fork',
          actor: displayNodeValue(node.type, node.value),
          forkTimeout: fmt(nextNode.value as TimeoutValue),
          forkEscalationActor: en ? displayNodeValue(en.type, en.value) : undefined,
          backup,
        });
        i += 3; continue;
      }
      steps.push({ kind: 'notify', actor: displayNodeValue(node.type, node.value), backup });
      i++; continue;
    }
    i++;
  }

  if (!hasRequester) steps.unshift({ kind: 'start', description: 'Employee submits request' });
  const last = steps[steps.length - 1];
  if (last && last.kind !== 'fork') steps.push({ kind: 'end', description: 'Request Approved.' });
  return steps;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const W = 560;       // inner canvas width
const CX = W / 2;   // 280 — center x
const LX = 108;     // left branch x
const RX = W - LX;  // 452 — right branch x
const NR = 20;      // node radius
const ND = NR * 2;  // 40 — node diameter

const G = {
  LABEL_H: 52,    // main label box height
  B_LABEL_H: 60,  // branch label box height
  CONN: 30,       // connector between non-fork steps
  PRE: 14,        // gap from main label to horizontal split
  DROP: 70,       // from split y to branch node center
  RET_DOWN: 44,   // from branch node bottom down to return turn
  RET_CONT: 26,   // from return turn down to next node top
  TOP: 28,
  BOT: 44,
};

const MAIN_LW = 208;  // main label width
const BR_LW = 152;    // branch label width

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

function calcLayout(steps: TimelineStep[]): { items: SL[]; totalH: number } {
  let y = G.TOP;
  const items = steps.map((step): SL => {
    const nodeY = y + NR;
    const labelY = nodeY + NR + 7;
    const isA = step.kind !== 'start' && step.kind !== 'end';

    if (isA) {
      const splitY = labelY + G.LABEL_H + G.PRE;
      const branchY = splitY + G.DROP;
      const branchLabelY = branchY + NR + 7;
      const retY = branchLabelY + G.B_LABEL_H + G.RET_DOWN;
      const endY = retY + G.RET_CONT;
      y = endY;
      return { step, nodeY, labelY, splitY, branchY, branchLabelY, retY, endY };
    } else {
      const endY = labelY + G.LABEL_H + G.CONN;
      y = endY;
      return { step, nodeY, labelY, endY };
    }
  });
  return { items, totalH: y + G.BOT };
}

// ─── Flowchart Component ──────────────────────────────────────────────────────

const DU = 0.12; // base delay unit

const Flowchart: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
  const { items, totalH } = calcLayout(steps);

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
    cx: number, topY: number, w: number,
    main: string, sub?: string,
    extraCls = ''
  ) => {
    nodeEls.push(
      <motion.div
        key={nk++}
        style={{ position: 'absolute', left: cx - w / 2, top: topY, width: w, textAlign: 'center' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t + 0.08, duration: 0.22 }}
        className={`rounded-xl border px-3 py-2 bg-white border-slate-200 shadow-sm ${extraCls}`}
      >
        <p className="text-[12px] font-semibold text-slate-700 leading-snug">{main}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{sub}</p>}
      </motion.div>
    );
  };

  items.forEach((item, i) => {
    const { step, nodeY, labelY, splitY, branchY, branchLabelY, retY } = item;
    const isA = step.kind !== 'start' && step.kind !== 'end';
    const next = items[i + 1];

    // ── Main node ──
    const isEnd = step.kind === 'end';
    const isStart = step.kind === 'start';
    const MIcon = isStart ? User : isEnd ? Star : Bell;
    const mBg = isEnd ? 'bg-amber-50' : 'bg-white';
    const mBrd = isEnd ? 'border-amber-300' : 'border-slate-300';
    const mIcn = isEnd ? 'text-amber-500' : 'text-slate-500';
    const mIconProps = isEnd ? { fill: 'currentColor', stroke: 'currentColor' } : {};

    addNode(CX, nodeY, mBg, mBrd, MIcon, mIcn, mIconProps);

    const mainText = isStart ? (step.actor ?? 'Employee')
      : isEnd ? (step.description ?? 'Request Approved.')
      : (step.actor ?? '');
    const subText = isStart ? (step.description ?? 'Submits request')
      : isEnd ? 'Email sent to employee.'
      : 'Receives request in Inbox and Email';

    addLabel(CX, labelY, MAIN_LW, mainText, subText);
    t += DU * 1.3;

    if (isA) {
      // Line: main label bottom → split
      addPath(`M ${CX},${nodeY + NR} L ${CX},${splitY}`, 0.17);

      // Horizontal split line
      addPath(`M ${LX},${splitY} L ${RX},${splitY}`, 0.22);

      // Left + right drops (staggered slightly)
      const tDrops = t;
      addPath(`M ${LX},${splitY} L ${LX},${branchY! - NR}`, 0.22);
      addPath(`M ${RX},${splitY} L ${RX},${branchY! - NR}`, 0.20, tDrops + 0.05);

      // Left branch: approval
      addNode(LX, branchY!, 'bg-emerald-50', 'border-emerald-300', ThumbsUp, 'text-emerald-600');
      addLabel(LX, branchLabelY!, BR_LW, `${step.actor} Approves it.`);

      // Right branch: rejection or escalation
      t += DU * 0.7;
      addNode(RX, branchY!, 'bg-red-50', 'border-red-200', ThumbsDown, 'text-red-400');

      let rj: string, rjSub: string | undefined;
      if (step.kind === 'fork') {
        rj = `${step.actor} Rejects it.`;
        rjSub = `After ${step.forkTimeout} → ${step.forkEscalationActor}`;
      } else if (step.kind === 'condition_fork') {
        rj = `${step.actor} Rejects it.`;
        rjSub = `If ${step.conditionTriggers} → ${step.conditionBackupActor}`;
      } else {
        rj = `${step.actor} Rejects it.`;
        rjSub = 'Email is sent to Employee.';
      }
      addLabel(RX, branchLabelY!, BR_LW, rj, rjSub);
      t += DU * 1.4;

      // Return: approval node bottom → turn → center
      addPath(`M ${LX},${branchY! + NR} L ${LX},${retY} L ${CX},${retY}`, 0.30);

      // Continue center line to next step
      if (next) {
        addPath(`M ${CX},${retY} L ${CX},${next.nodeY - NR}`, 0.18);
      }
    } else {
      if (next) {
        addPath(`M ${CX},${nodeY + NR} L ${CX},${next.nodeY - NR}`, 0.22);
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

      {/* Flowchart — key on workflow ID so animation replays when switching workflows */}
      <div className="overflow-y-auto flex-1">
        <div className="flex justify-center py-6 px-4">
          <Flowchart key={workflow.id} steps={steps} />
        </div>
      </div>
    </div>
  );
};
