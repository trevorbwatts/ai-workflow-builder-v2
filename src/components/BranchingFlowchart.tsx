import React, { useLayoutEffect, useRef, useState } from 'react';
import { WorkflowRule, ValidationIssue } from '../types';
import { parseWorkflowSteps, TimelineStep } from '../lib/flowchart';
import { displayFilterSummary, displayTimeOffTypeValue } from '../lib/nodes';
import { TimeOffTypeValue } from '../types';
import { motion } from 'motion/react';
import { User, Bell, Star, ThumbsUp, ThumbsDown, Clock, UserX, Mail, Flag } from 'lucide-react';

// ─── Layout Constants ────────────────────────────────────────────────────────

const NR = 20;
const ND = NR * 2;
const BRANCH_W = 560;
const BRANCH_CX = BRANCH_W / 2;
const LX_OFF = 140;
const RX_OFF = BRANCH_W - LX_OFF;
const FC_RX_OFF = BRANCH_W - 40;

const G = {
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

const MAIN_LW = 312;
const BR_LW = 228;
const BR_FORK_LW = 140;
const DU = 0.09;

// ─── Step Layout ─────────────────────────────────────────────────────────────

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

    if (step.kind === 'notify_split') {
      // Layout so next step's nodeY = branchY (same level as notify node)
      const splitY = y + NR + 10;
      const branchY = splitY + G.DROP;
      const branchLabelY = branchY + NR + 7;
      const endY = branchY - NR; // next step's nodeY will equal branchY
      y = endY;
      return { step, nodeY: splitY, labelY: splitY, splitY, branchY, branchLabelY, endY };
    } else if (isA) {
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

// ─── Single Rule Flowchart (proper React component) ──────────────────────────

interface SingleFlowchartProps {
  steps: TimelineStep[];
  offsetX: number;
  ruleId: string;
  startDelay?: number;
  onNodeClick?: (ruleId: string, nodeId: string, rect: DOMRect) => void;
  onSuggest?: (prompt: string) => void;
  onOpenAssistant?: () => void;
  validationNodeIds: Set<string>;
}

const SingleFlowchart: React.FC<SingleFlowchartProps> = ({
  steps, offsetX, ruleId, startDelay = 0, onNodeClick, onSuggest, onOpenAssistant, validationNodeIds,
}) => {
  const labelElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [labelHeights, setLabelHeights] = useState<number[]>(() =>
    steps.map(() => G.LABEL_H)
  );

  useLayoutEffect(() => {
    const measured = steps.map((_, i) => labelElsRef.current[i]?.offsetHeight ?? G.LABEL_H);
    setLabelHeights(measured);
  }, [steps]);

  const { items, totalH } = calcLayout(steps, labelHeights);

  // Detect if any non-fork approval step will render a ghost suggestion
  const hasGhost = !!onOpenAssistant && steps.some(s =>
    s.kind === 'notify' && s.actor && !s.backup && !steps.some(s2 => s2.kind === 'fork' || s2.kind === 'condition_fork')
  );
  const GHOST_LW = 160;
  const TOTAL_W = hasGhost ? BRANCH_W + 200 : BRANCH_W;

  const pathEls: React.ReactElement[] = [];
  const nodeEls: React.ReactElement[] = [];
  let t = startDelay;
  let pk = 0;
  let nk = 0;
  const skippedItemIndices = new Set<number>();

  const CX = BRANCH_CX + offsetX;
  const sLXBase = LX_OFF + offsetX;
  const sRXBase = RX_OFF + offsetX;
  const fcRXBase = FC_RX_OFF + offsetX;

  const addPath = (d: string, dur: number, at?: number, dashed?: boolean) => {
    const delay = at ?? t;
    pathEls.push(
      <motion.path
        key={`p-${ruleId}-${pk++}`}
        d={d}
        stroke={dashed ? '#cbd5e1' : '#94a3b8'}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '5 4' : undefined}
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
    iconProps?: Record<string, any>,
    nodeId?: string,
  ) => {
    const hasValidationIssue = nodeId ? validationNodeIds.has(nodeId) : false;
    const ringClass = hasValidationIssue ? 'ring-2 ring-red-400 ring-offset-1' : '';

    nodeEls.push(
      <motion.div
        key={`n-${ruleId}-${nk++}`}
        style={{ position: 'absolute', left: cx - NR, top: cy - NR, width: ND, height: ND }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: t, type: 'spring', stiffness: 380, damping: 24 }}
        className={`rounded-full border-2 flex items-center justify-center ${bg} ${border} ${ringClass}`}
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
    actor?: string,
    clickNodeId?: string,
    suggestion?: string,       // e.g. "+Add Backup Approvers" — clicks open NodeEditor for clickNodeId
  ) => {
    const clickable = clickNodeId && onNodeClick;
    nodeEls.push(
      <div
        key={`l-${ruleId}-${nk++}`}
        style={{ position: 'absolute', left: cx, top: topY, transform: 'translateX(-50%)' }}
      >
        <motion.div
          ref={refCallback}
          style={{ width: 'max-content', maxWidth: maxW, textAlign: 'center' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: t + 0.05, duration: 0.15 }}
          className={`rounded-xl border px-3 py-2.5 bg-white border-slate-200 shadow-sm ${
            clickable ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-shadow' : ''
          }`}
          onClick={clickable ? (e: React.MouseEvent) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onNodeClick!(ruleId, clickNodeId!, rect);
          } : undefined}
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
          {suggestion && (
            <button
              onClick={clickNodeId && onNodeClick ? (e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onNodeClick(ruleId, clickNodeId, rect);
              } : undefined}
              className="mt-2 text-[10px] font-medium text-slate-400 border border-dashed border-slate-300 rounded-lg px-2 py-1 hover:border-indigo-300 hover:text-indigo-500 transition-colors w-full"
            >
              {suggestion}
            </button>
          )}
        </motion.div>
      </div>
    );
  };

  items.forEach((item, i) => {
    if (skippedItemIndices.has(i)) return;
    const { step, nodeY, labelY, splitY, branchY, branchLabelY, retY } = item;
    const isA = step.kind !== 'start' && step.kind !== 'end';

    // ── Notify split: left = notify (dead end), right = continues to next step ──
    // Both the notify node and next step's node render at the SAME Y level.
    if (step.kind === 'notify_split') {
      const next = items[i + 1];
      const R = 18;
      const notifyX = 70 + offsetX; // further left to avoid label collision with main flow

      // One continuous vertical line from prev connector end through to next step
      if (next) {
        addPath(`M ${CX},${nodeY - NR} L ${CX},${next.nodeY - NR}`, 0.30);
      }

      // Left arm branches off the vertical line at splitY
      addPath(
        `M ${CX},${splitY} L ${notifyX + R},${splitY} Q ${notifyX},${splitY} ${notifyX},${splitY! + R} L ${notifyX},${branchY! - NR}`,
        0.30
      );

      // Notify node (Mail icon) — at same Y as next step's main node
      addNode(notifyX, branchY!, 'bg-sky-50', 'border-sky-300', Mail, 'text-sky-500', undefined, step.nodeId);
      const ntChips = step.notifyChannels ?? ['Inbox', 'Email'];
      addLabel(notifyX, branchLabelY!, BR_LW, 'Notified', undefined, ntChips, undefined, step.notifyActor);

      t += DU * 1.5;
      return;
    }
    const next = items[i + 1];
    const isForkChild = !!step.forkChild;

    const sX = isForkChild ? sRXBase : CX;

    const isEnd = step.kind === 'end';
    const isStart = step.kind === 'start';
    const MIcon = isStart ? User : isEnd ? Star : Bell;
    const mBg = isEnd ? 'bg-amber-50' : 'bg-white';
    const mBrd = isEnd ? 'border-amber-300' : 'border-slate-300';
    const mIcn = isEnd ? 'text-amber-500' : 'text-slate-500';
    const mIconProps = isEnd ? { fill: 'currentColor', stroke: 'currentColor' } : {};

    addNode(sX, nodeY, mBg, mBrd, MIcon, mIcn, mIconProps, step.nodeId);

    const actor = (!isEnd) ? (step.actor ?? 'Employee') : undefined;
    const mainText = isStart ? 'Submits Request'
      : isEnd ? 'Request Approved'
      : 'Receives Request';
    const subText = isEnd ? 'Email sent to employee.' : undefined;
    const chips = (!isStart && !isEnd) ? ['Inbox', 'Email'] : undefined;

    // Show "+Add Backup Approvers" suggestion on approval step labels
    const showBackupSuggestion = !isStart && !isEnd && step.actor && !step.backup;
    addLabel(sX, labelY, MAIN_LW, mainText, subText, chips,
      (el) => { labelElsRef.current[i] = el; }, actor,
      (!isStart && !isEnd && step.nodeId) ? step.nodeId : undefined,
      showBackupSuggestion ? '+Add Backup Approvers' : undefined);
    t += DU * 1.3;

    if (isA) {
      const R = 18;
      const isFork = step.kind === 'fork' || step.kind === 'condition_fork';

      const sLX = isForkChild ? CX : sLXBase;
      const sRX = isForkChild ? fcRXBase : sRXBase;

      addPath(`M ${sX},${nodeY + NR} L ${sX},${splitY}`, 0.22);
      addPath(
        `M ${sX},${splitY} L ${sLX + R},${splitY} Q ${sLX},${splitY} ${sLX},${splitY + R} L ${sLX},${branchY! - NR}`,
        0.30
      );

      if (isFork) {
        const tCDrop = t - 0.30 + 0.06;
        addPath(`M ${sX},${splitY} L ${sX},${branchY! - NR}`, 0.18, tCDrop);
        const tRDrop = t - 0.30 + 0.10;
        addPath(
          `M ${sX},${splitY} L ${sRX - R},${splitY} Q ${sRX},${splitY} ${sRX},${splitY + R} L ${sRX},${branchY! - NR}`,
          0.28, tRDrop
        );
      } else {
        const tRDrop = t - 0.30 + 0.05;
        addPath(
          `M ${sX},${splitY} L ${sRX - R},${splitY} Q ${sRX},${splitY} ${sRX},${splitY + R} L ${sRX},${branchY! - NR}`,
          0.28, tRDrop
        );
      }

      addNode(sLX, branchY!, 'bg-emerald-50', 'border-emerald-300', ThumbsUp, 'text-emerald-600');

      if (isFork && step.notifyActor) {
        // For fork steps, show notify info on the Approved label card (not a separate sub-branch)
        const ntChips = step.notifyChannels ?? ['Inbox', 'Email'];
        addLabel(sLX, branchLabelY!, BR_FORK_LW, 'Approved', `Notify ${step.notifyActor}`, ntChips);
      } else if (step.notifyActor) {
        // For non-fork steps, render the notify as a sub-branch off Approved
        addLabel(sLX, branchLabelY!, BR_LW, 'Approved');

        const NTX = sLX - 90;
        const ntRX = sLX + 90;
        const ntSplitY = branchLabelY! + G.B_LABEL_H + 14;
        const ntNodeY = ntSplitY + G.DROP;
        const ntLabelY = ntNodeY + NR + 7;

        addPath(`M ${sLX},${branchY! + NR} L ${sLX},${ntSplitY}`, 0.18);
        addPath(
          `M ${sLX},${ntSplitY} L ${NTX + R},${ntSplitY} Q ${NTX},${ntSplitY} ${NTX},${ntSplitY + R} L ${NTX},${ntNodeY - NR}`,
          0.28
        );
        addPath(
          `M ${sLX},${ntSplitY} L ${ntRX - R},${ntSplitY} Q ${ntRX},${ntSplitY} ${ntRX},${ntSplitY + R} L ${ntRX},${ntNodeY - NR}`,
          0.28
        );

        addNode(NTX, ntNodeY, 'bg-sky-50', 'border-sky-300', Mail, 'text-sky-500');
        const ntChips = step.notifyChannels ?? ['Inbox', 'Email'];
        addLabel(NTX, ntLabelY, BR_FORK_LW, 'Notified', undefined, ntChips, undefined, step.notifyActor);

        if (next?.step.kind === 'end') {
          addNode(ntRX, ntNodeY, 'bg-amber-50', 'border-amber-300', Star, 'text-amber-500', { fill: 'currentColor', stroke: 'currentColor' });
          addLabel(ntRX, ntLabelY, BR_FORK_LW, 'Request Approved', 'Email sent to employee.');
          skippedItemIndices.add(i + 1);
        }
      } else {
        addLabel(sLX, branchLabelY!, isFork ? BR_FORK_LW : BR_LW, 'Approved');
      }

      if (isFork) {
        t += DU * 0.5;
        addNode(sX, branchY!, 'bg-red-50', 'border-red-200', ThumbsDown, 'text-red-400');
        addLabel(sX, branchLabelY!, BR_FORK_LW, 'Rejected', 'Email is sent to Employee');

        t += DU * 0.5;
        const EscIcon = step.kind === 'condition_fork' ? UserX : Clock;
        const escLabel = step.kind === 'condition_fork' ? 'Unavailable' : 'No Response';
        const escSub = step.kind === 'fork'
          ? `After ${step.forkTimeout}`
          : `If ${step.conditionTriggers}`;
        addNode(sRX, branchY!, 'bg-amber-50', 'border-amber-200', EscIcon, 'text-amber-500');
        addLabel(sRX, branchLabelY!, BR_FORK_LW, escLabel, escSub);
        t += DU * 1.4;

        const endItem = items[items.length - 1];
        const endStarY = endItem.nodeY;
        const tBypass = t;
        addPath(
          `M ${sLX},${branchY! + NR} L ${sLX},${endStarY - NR - R} Q ${sLX},${endStarY - NR} ${sLX + R},${endStarY - NR} L ${CX - R},${endStarY - NR} Q ${CX},${endStarY - NR} ${CX},${endStarY - NR + R}`,
          0.70, tBypass
        );

        if (next) {
          addPath(`M ${sRX},${branchY! + NR} L ${sRX},${next.nodeY - NR}`, 0.30);
        }
      } else {
        t += DU * 0.7;
        addNode(sRX, branchY!, 'bg-red-50', 'border-red-200', ThumbsDown, 'text-red-400');
        addLabel(sRX, branchLabelY!, BR_LW, 'Rejected', 'Email is sent to Employee');
        t += DU * 1.4;

        // Ghost "No Response" suggestion — dashed, to the right of Rejected
        // ghostX is far enough right that its label (GHOST_LW=160) doesn't overlap Rejected
        if (!isForkChild && onOpenAssistant) {
          const ghostX = sRXBase + 220; // 640 — clear of Rejected label right edge at ~534
          // unshift so this path renders behind the Rejected branch line in the SVG
          // Use opacity animation (not pathLength) so strokeDasharray isn't overridden by Framer Motion
          pathEls.unshift(
            <motion.path
              key={`p-ghost-${ruleId}`}
              d={`M ${sX},${splitY} L ${ghostX - R},${splitY} Q ${ghostX},${splitY} ${ghostX},${splitY + R} L ${ghostX},${branchY! - NR}`}
              stroke="#cbd5e1"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: t, duration: 0.25 }}
            />
          );
          nodeEls.push(
            <motion.div
              key={`ghost-node-${ruleId}-${nk++}`}
              style={{ position: 'absolute', left: ghostX - NR, top: branchY! - NR, width: ND, height: ND }}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: t, type: 'spring', stiffness: 380, damping: 24 }}
              className="rounded-full border-2 border-dashed border-slate-300 bg-white flex items-center justify-center"
            >
              <Clock size={14} className="text-slate-300" />
            </motion.div>
          );
          nodeEls.push(
            <div key={`ghost-label-${ruleId}-${nk++}`} style={{ position: 'absolute', left: ghostX, top: branchLabelY!, transform: 'translateX(-50%)' }}>
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: t + 0.05, duration: 0.15 }}
                onClick={() => onOpenAssistant()}
                style={{ width: 'max-content', maxWidth: GHOST_LW, textAlign: 'center' }}
                className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5 bg-white/80 hover:border-indigo-300 hover:text-indigo-500 transition-colors cursor-pointer"
              >
                <p className="text-[11px] font-semibold leading-snug"><span className="text-slate-600">+Add an </span><span className="text-amber-600">Escalation Rule</span></p>
                <p className="text-[10px] text-slate-400 mt-0.5">What should happen if there is no response?</p>
              </motion.button>
            </div>
          );
        }

        if (!skippedItemIndices.has(i + 1)) {
          if (isForkChild) {
            if (next) {
              addPath(`M ${CX},${branchY! + NR} L ${CX},${next.nodeY - NR}`, 0.30);
            }
          } else {
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
      }
    } else {
      if (next) {
        addPath(`M ${sX},${nodeY + NR} L ${sX},${next.nodeY - NR}`, 0.26);
      }
    }
  });

  return (
    <div className="relative" style={{ width: TOTAL_W, height: totalH }}>
      <svg
        width={TOTAL_W}
        height={totalH}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        {pathEls}
      </svg>
      {nodeEls}
    </div>
  );
};

// ─── Smart branch label ───────────────────────────────────────────────────────
// Picks the right differentiating label for a rule given all sibling rules.
// When all rules share the same scope, uses time_off_type as the differentiator.
// When scopes differ, uses scope. When both differ, combines them.

function getRuleBranchLabel(rule: WorkflowRule, allRules: WorkflowRule[]): string {
  const allSameScope = allRules.every((r) => r.filter === null)
    || allRules.every((r) => JSON.stringify(r.filter) === JSON.stringify(allRules[0].filter));

  const scopePart = allSameScope
    ? null
    : rule.filter === null
      ? 'All other employees'
      : displayFilterSummary(rule.filter);

  const timeOffVal = rule.nodes.time_off_type?.value as TimeOffTypeValue | undefined;
  const timeOffAttr = timeOffVal?.attribute;
  const anyTimeOff = allRules.some((r) => r.nodes.time_off_type);
  const timeOffPart = anyTimeOff && timeOffAttr
    ? timeOffAttr === 'all_other' ? 'All other time-off types'
    : timeOffAttr === 'all' ? 'All other time-off requests'
    : displayTimeOffTypeValue(timeOffVal!)
    : null;

  if (scopePart && timeOffPart) return `${scopePart} · ${timeOffPart}`;
  if (timeOffPart) return timeOffPart;
  if (scopePart) return scopePart;
  return 'All employees';
}

// ─── Layout constants for the root "workflow type" node ──────────────────────

const FLAG_CY = NR + 10;           // 30 — center y of flag node
const FLAG_LABEL_Y = FLAG_CY + NR + 7; // 57
const FLAG_LABEL_H = 48;
const HEADER_H = FLAG_LABEL_Y + FLAG_LABEL_H + 28; // 133 — space before branches start

// ─── Main Branching Flowchart ────────────────────────────────────────────────

interface BranchingFlowchartProps {
  rules: WorkflowRule[];
  activeRuleId: string;
  workflowName: string;
  onNodeClick?: (ruleId: string, nodeId: string, rect: DOMRect) => void;
  onSuggest?: (prompt: string) => void;
  onOpenAssistant?: () => void;
  validationIssues: ValidationIssue[];
}

export const BranchingFlowchart: React.FC<BranchingFlowchartProps> = ({
  rules, activeRuleId, workflowName, onNodeClick, onSuggest, onOpenAssistant, validationIssues,
}) => {
  const validationNodeIds = new Set(
    validationIssues.filter((i) => i.nodeId).map((i) => i.nodeId!)
  );

  const totalW = rules.length === 1 ? BRANCH_W : rules.length * BRANCH_W;
  const rootCX = totalW / 2;

  // Single rule: flag → line → SingleFlowchart
  if (rules.length === 1) {
    const rule = rules[0];
    const steps = parseWorkflowSteps(rule.template, rule.nodes);
    // The first node of SingleFlowchart sits at G.TOP + NR = 30 from its container top
    const firstNodeAbsY = HEADER_H + G.TOP + NR;

    return (
      <div className="relative" style={{ width: BRANCH_W }}>
        {/* Connector: flag bottom → first branch node */}
        <svg
          width={BRANCH_W}
          height={HEADER_H}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
          <motion.line
            x1={rootCX} y1={FLAG_CY + NR}
            x2={rootCX} y2={firstNodeAbsY - NR}
            stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ delay: 0.1, duration: 0.15, ease: 'easeInOut' }}
          />
        </svg>

        {/* Flag (root) node */}
        <motion.div
          style={{ position: 'absolute', left: rootCX - NR, top: FLAG_CY - NR, width: ND, height: ND }}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          className="rounded-full border-2 border-indigo-300 bg-indigo-50 flex items-center justify-center"
        >
          <Flag size={15} className="text-indigo-600" />
        </motion.div>

        {/* Workflow name label */}
        <div style={{ position: 'absolute', left: rootCX, top: FLAG_LABEL_Y, transform: 'translateX(-50%)' }}>
          <motion.div
            style={{ width: 'max-content', maxWidth: MAIN_LW, textAlign: 'center' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.075, duration: 0.15 }}
            className="rounded-xl border px-3 py-2.5 bg-white border-slate-200 shadow-sm"
          >
            <p className="text-[12px] font-semibold text-slate-700 leading-snug">{workflowName}</p>
          </motion.div>
        </div>

        {/* SingleFlowchart offset below the header */}
        <div style={{ position: 'absolute', top: HEADER_H, left: 0 }}>
          <SingleFlowchart
            steps={steps}
            offsetX={0}
            ruleId={rule.id}
            startDelay={0.5}
            onNodeClick={onNodeClick}
            onSuggest={onSuggest}
            onOpenAssistant={onOpenAssistant}
            validationNodeIds={validationNodeIds}
          />
        </div>
      </div>
    );
  }

  // Multi-rule: flag → rounded split arms → branches (same corner style as fork paths)
  const R = 18; // corner radius, matches SingleFlowchart fork paths
  const SPLIT_Y = FLAG_LABEL_Y + FLAG_LABEL_H + 20;      // y where arms split horizontally
  const BRANCH_LABEL_H = 26;
  const BRANCH_START_Y = SPLIT_Y + 80;                   // y where SingleFlowcharts start
  const firstNodeAbsY = BRANCH_START_Y + G.TOP + NR;     // abs y of first node in each branch

  const isActive = (id: string) => id === activeRuleId;

  // Build arm path from split point to each branch's first node using rounded corners
  const armPath = (branchCX: number) => {
    if (branchCX === rootCX) {
      // Center branch: straight down
      return `M ${rootCX},${SPLIT_Y} L ${rootCX},${firstNodeAbsY - NR}`;
    }
    if (branchCX < rootCX) {
      // Left branch: go left with rounded corner
      return `M ${rootCX},${SPLIT_Y} L ${branchCX + R},${SPLIT_Y} Q ${branchCX},${SPLIT_Y} ${branchCX},${SPLIT_Y + R} L ${branchCX},${firstNodeAbsY - NR}`;
    }
    // Right branch: go right with rounded corner
    return `M ${rootCX},${SPLIT_Y} L ${branchCX - R},${SPLIT_Y} Q ${branchCX},${SPLIT_Y} ${branchCX},${SPLIT_Y + R} L ${branchCX},${firstNodeAbsY - NR}`;
  };

  return (
    <div className="relative" style={{ width: totalW, minHeight: 600 }}>
      {/* SVG paths */}
      <svg
        width={totalW}
        height={BRANCH_START_Y}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        {/* Flag bottom → split point */}
        <motion.line
          x1={rootCX} y1={FLAG_CY + NR}
          x2={rootCX} y2={SPLIT_Y}
          stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ delay: 0.1, duration: 0.1, ease: 'easeInOut' }}
        />

        {/* Rounded arm to each branch */}
        {rules.map((rule, i) => {
          const branchCX = i * BRANCH_W + BRANCH_CX;
          return (
            <motion.path
              key={`arm-${rule.id}`}
              d={armPath(branchCX)}
              stroke="#94a3b8"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ delay: 0.15, duration: 0.175, ease: 'easeInOut' }}
            />
          );
        })}
      </svg>

      {/* Flag (root) node */}
      <motion.div
        style={{ position: 'absolute', left: rootCX - NR, top: FLAG_CY - NR, width: ND, height: ND }}
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 24 }}
        className="rounded-full border-2 border-indigo-300 bg-indigo-50 flex items-center justify-center"
      >
        <Flag size={15} className="text-indigo-600" />
      </motion.div>

      {/* Workflow name label */}
      <div style={{ position: 'absolute', left: rootCX, top: FLAG_LABEL_Y, transform: 'translateX(-50%)', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.075, duration: 0.15 }}
          className="rounded-xl border px-3 py-2.5 bg-white border-slate-200 shadow-sm whitespace-nowrap"
        >
          <p className="text-[12px] font-semibold text-slate-700 leading-snug">{workflowName}</p>
        </motion.div>
      </div>

      {/* Branch scope labels — centered on the vertical arm segment */}
      {rules.map((rule, i) => {
        const branchCX = i * BRANCH_W + BRANCH_CX;
        const label = getRuleBranchLabel(rule, rules);
        const labelY = SPLIT_Y + R + 12;
        return (
          // Outer div handles centering; inner motion.div handles animation (avoids transform conflict)
          <div
            key={`label-${rule.id}`}
            style={{ position: 'absolute', left: branchCX, top: labelY, transform: 'translateX(-50%)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl border px-3 py-2 bg-indigo-50 border-indigo-200 shadow-sm whitespace-nowrap"
            >
              <p className="text-[12px] font-semibold text-indigo-700 leading-snug">{label}</p>
            </motion.div>
          </div>
        );
      })}

      {/* Branch flowcharts */}
      <div style={{ position: 'absolute', top: BRANCH_START_Y, left: 0, display: 'flex' }}>
        {rules.map((rule) => {
          const steps = parseWorkflowSteps(rule.template, rule.nodes);
          return (
            <SingleFlowchart
              key={rule.id}
              steps={steps}
              offsetX={0}
              ruleId={rule.id}
              startDelay={0.7}
              onNodeClick={onNodeClick}
              onSuggest={onSuggest}
              onOpenAssistant={onOpenAssistant}
              validationNodeIds={validationNodeIds}
            />
          );
        })}
      </div>
    </div>
  );
};
