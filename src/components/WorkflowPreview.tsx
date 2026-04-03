import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Workflow, TimeoutValue, ScopeValue, TimeOffTypeValue, StatusConditionValue, ApproversValue } from '../types';
import { displayNodeValue, displayScopeValue, displayTimeOffTypeValue, displayStatusConditionValue, formatOperand } from '../lib/nodes';
import { motion } from 'motion/react';
import { User, Bell, Clock, CheckCircle2, Mail, Inbox, X, ArrowRight, ArrowDown, UserX } from 'lucide-react';

// ─── Step Types ───────────────────────────────────────────────────────────────

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

// ─── Parser ───────────────────────────────────────────────────────────────────

function formatTimeout(v: TimeoutValue): string {
  const unit = v.amount === 1 ? v.unit.replace(/s$/, '') : v.unit;
  return `${v.amount} ${unit}`;
}

function parseWorkflowSteps(workflow: Workflow): TimelineStep[] {
  const placeholders = (workflow.template.match(/\{([^{}]+)\}/g) ?? []).map((p) => p.slice(1, -1).trim());
  const steps: TimelineStep[] = [];
  let hasRequester = false;

  let i = 0;
  while (i < placeholders.length) {
    const nodeId = placeholders[i];
    const node = workflow.nodes[nodeId];

    if (!node || node.type === 'scope' || node.type === 'time_off_type') { i++; continue; }

    if (node.type === 'approvers' && nodeId === 'requester') {
      hasRequester = true;
      steps.push({ kind: 'start', actor: displayNodeValue(node.type, node.value), description: 'initiates the request' });
      i++; continue;
    }

    if (node.type === 'approvers') {
      const nextId = placeholders[i + 1];
      const nextNode = workflow.nodes[nextId];
      const backup = (node.value as ApproversValue).backup
        ? formatOperand((node.value as ApproversValue).backup!)
        : undefined;

      if (nextNode?.type === 'status_condition') {
        const backupNode = workflow.nodes[placeholders[i + 2]];
        steps.push({
          kind: 'condition_fork',
          actor: displayNodeValue(node.type, node.value),
          conditionTriggers: displayStatusConditionValue(nextNode.value as StatusConditionValue),
          conditionBackupActor: backupNode ? displayNodeValue(backupNode.type, backupNode.value) : undefined,
          backup,
        });
        i += 3; continue;
      }
      if (nextNode?.type === 'timeout') {
        const escalationNode = workflow.nodes[placeholders[i + 2]];
        steps.push({
          kind: 'fork',
          actor: displayNodeValue(node.type, node.value),
          forkTimeout: formatTimeout(nextNode.value as TimeoutValue),
          forkEscalationActor: escalationNode ? displayNodeValue(escalationNode.type, escalationNode.value) : undefined,
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
  if (last && last.kind !== 'fork') steps.push({ kind: 'end', description: 'Approved' });

  return steps;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

const Pills: React.FC = () => (
  <div className="flex items-center gap-1.5 mt-1.5">
    <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px] font-medium"><Inbox size={10} /> Inbox</span>
    <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px] font-medium"><Mail size={10} /> Email</span>
  </div>
);

// ─── View 1: Timeline ─────────────────────────────────────────────────────────

const TimelineView: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => (
  <div className="px-6 py-5">
    {steps.map((step, i) => {
      const isLast = i === steps.length - 1;
      if (step.kind === 'start') return (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><User size={14} className="text-indigo-600" /></div>
            {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          <div className="pb-5 pt-1">
            {step.actor ? <><span className="text-sm font-semibold text-slate-800">{step.actor}</span><span className="text-sm text-slate-500"> {step.description}</span></> : <span className="text-sm text-slate-600">{step.description}</span>}
          </div>
        </div>
      );
      if (step.kind === 'notify') return (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Bell size={14} className="text-slate-500" /></div>
            {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          <div className="pb-5 pt-1">
            <p className="text-sm font-semibold text-slate-800">{step.actor}</p>
            <p className="text-xs text-slate-400 mt-0.5">Reviews and approves</p>
            <Pills />
            {step.backup && <p className="text-xs text-slate-400 mt-1.5">↳ Backup: {step.backup}</p>}
          </div>
        </div>
      );
      if (step.kind === 'condition_fork') return (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Bell size={14} className="text-slate-500" /></div>
            {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          <div className="pb-5 pt-1 flex-1">
            <p className="text-sm font-semibold text-slate-800">{step.actor}</p>
            <p className="text-xs text-slate-400 mt-0.5">Reviews and approves</p>
            <Pills />
            {step.backup && <p className="text-xs text-slate-400 mt-1.5">↳ Backup: {step.backup}</p>}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} className="shrink-0" /> Approved <ArrowRight size={11} className="mx-0.5" /> Complete
              </div>
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                <UserX size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-700">If {step.conditionTriggers}</p>
                  {step.conditionBackupActor && <p className="text-xs text-amber-600 mt-0.5">Forwarded to {step.conditionBackupActor}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      if (step.kind === 'fork') return (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Bell size={14} className="text-slate-500" /></div>
            {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          <div className="pb-5 pt-1 flex-1">
            <p className="text-sm font-semibold text-slate-800">{step.actor}</p>
            <p className="text-xs text-slate-400 mt-0.5">Reviews and approves</p>
            <Pills />
            {step.backup && <p className="text-xs text-slate-400 mt-1.5">↳ Backup: {step.backup}</p>}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-medium text-emerald-700">
                <CheckCircle2 size={13} className="shrink-0" /> Approved <ArrowRight size={11} className="mx-0.5" /> Complete
              </div>
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                <Clock size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-700">No response within {step.forkTimeout}</p>
                  {step.forkEscalationActor && <p className="text-xs text-amber-600 mt-0.5">Forwarded to {step.forkEscalationActor}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      return (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 size={14} className="text-emerald-600" /></div>
          <div className="pt-1"><span className="text-sm font-semibold text-emerald-700">{step.description}</span></div>
        </div>
      );
    })}
  </div>
);

// ─── View 2: Cards ────────────────────────────────────────────────────────────

const CardsView: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => (
  <div className="px-6 py-5 space-y-2">
    {steps.map((step, i) => {
      const isLast = i === steps.length - 1;
      if (step.kind === 'start') return (
        <div key={i}>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><User size={14} className="text-indigo-600" /></div>
            <div>
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Start</p>
              <p className="text-sm text-indigo-800">{step.actor ? <><span className="font-semibold">{step.actor}</span> {step.description}</> : step.description}</p>
            </div>
          </div>
          {!isLast && <div className="flex justify-center py-1"><ArrowDown size={14} className="text-slate-300" /></div>}
        </div>
      );
      if (step.kind === 'notify') return (
        <div key={i}>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Bell size={14} className="text-slate-500" /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Approval</p>
              <p className="text-sm font-semibold text-slate-800">{step.actor}</p>
              <Pills />
              {step.backup && <p className="text-[11px] text-slate-400 mt-1">Backup: {step.backup}</p>}
            </div>
          </div>
          {!isLast && <div className="flex justify-center py-1"><ArrowDown size={14} className="text-slate-300" /></div>}
        </div>
      );
      if (step.kind === 'condition_fork') return (
        <div key={i}>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Bell size={14} className="text-slate-500" /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Approval</p>
              <p className="text-sm font-semibold text-slate-800">{step.actor}</p>
              <Pills />
              {step.backup && <p className="text-[11px] text-slate-400 mt-1">Backup: {step.backup}</p>}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
              <CheckCircle2 size={14} className="text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-emerald-700">Approved</p>
              <p className="text-[11px] text-emerald-600">Complete</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
              <UserX size={14} className="text-amber-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-amber-700 truncate">{step.conditionTriggers}</p>
              <p className="text-[11px] text-amber-600 truncate">{step.conditionBackupActor ?? 'Forwarded'}</p>
            </div>
          </div>
        </div>
      );
      if (step.kind === 'fork') return (
        <div key={i}>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Bell size={14} className="text-slate-500" /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Approval</p>
              <p className="text-sm font-semibold text-slate-800">{step.actor}</p>
              <Pills />
              {step.backup && <p className="text-[11px] text-slate-400 mt-1">Backup: {step.backup}</p>}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
              <CheckCircle2 size={14} className="text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-emerald-700">Approved</p>
              <p className="text-[11px] text-emerald-600">Complete</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
              <Clock size={14} className="text-amber-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-amber-700">After {step.forkTimeout}</p>
              <p className="text-[11px] text-amber-600 truncate">{step.forkEscalationActor ?? 'Escalated'}</p>
            </div>
          </div>
        </div>
      );
      return (
        <div key={i} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold text-emerald-700">{step.description}</span>
        </div>
      );
    })}
  </div>
);

// ─── View 3: Numbered Steps ───────────────────────────────────────────────────

const StepsView: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => (
  <div className="px-6 py-5 space-y-3">
    {steps.map((step, i) => {
      const num = i + 1;
      if (step.kind === 'end') return (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold text-emerald-700">{step.description}</span>
        </div>
      );
      return (
        <div key={i} className="flex gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${step.kind === 'start' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{num}</div>
          <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
              {step.kind === 'start' ? 'Trigger' : step.kind === 'fork' ? 'Approval + Escalation' : step.kind === 'condition_fork' ? 'Approval + Availability Rule' : 'Approval'}
            </p>
            <p className="text-sm text-slate-800">
              {step.actor ? <><span className="font-semibold">{step.actor}</span>{step.description ? ` ${step.description}` : ' reviews and approves'}</> : step.description}
            </p>
            {(step.kind === 'notify' || step.kind === 'fork' || step.kind === 'condition_fork') && <Pills />}
            {(step.kind === 'notify' || step.kind === 'fork' || step.kind === 'condition_fork') && step.backup && (
              <p className="text-xs text-slate-400 mt-1">Backup: {step.backup}</p>
            )}
            {step.kind === 'condition_fork' && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
                If <span className="font-semibold text-amber-600">{step.conditionTriggers}</span>, routes to <span className="font-semibold">{step.conditionBackupActor}</span>
              </div>
            )}
            {step.kind === 'fork' && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
                If no response within <span className="font-semibold text-amber-600">{step.forkTimeout}</span>, escalates to <span className="font-semibold">{step.forkEscalationActor}</span>
              </div>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

// ─── View 4: At a Glance ──────────────────────────────────────────────────────

const GlanceView: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
  const approvers = steps.filter((s) => s.kind === 'notify' || s.kind === 'fork' || s.kind === 'condition_fork');
  const fork = steps.find((s) => s.kind === 'fork');
  const conditionFork = steps.find((s) => s.kind === 'condition_fork');
  const initiator = steps.find((s) => s.kind === 'start');

  return (
    <div className="px-6 py-5 space-y-4">
      {/* Who's involved */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Who's Involved</p>
        <div className="space-y-2">
          {initiator && (
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center"><User size={13} className="text-indigo-600" /></div>
                <span className="text-sm text-slate-700">{initiator.actor ?? 'Employee'}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Initiates</span>
            </div>
          )}
          {approvers.map((s, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center"><Bell size={13} className="text-slate-500" /></div>
                  <span className="text-sm text-slate-700">{s.actor}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Approves</span>
              </div>
              {s.backup && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50/60 rounded-xl ml-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><User size={11} className="text-slate-400" /></div>
                    <span className="text-xs text-slate-500">{s.backup}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Fallback</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Notifications Sent</p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl">
            <Inbox size={14} className="text-slate-400" />
            <span className="text-sm text-slate-600">In-app Inbox</span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl">
            <Mail size={14} className="text-slate-400" />
            <span className="text-sm text-slate-600">Email</span>
          </div>
        </div>
      </div>

      {/* Availability Rule */}
      {conditionFork && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Availability Rule</p>
          <div className="px-3 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
            If <span className="font-semibold">{conditionFork.actor}</span> is <span className="font-semibold">{conditionFork.conditionTriggers}</span>, the request is forwarded to <span className="font-semibold">{conditionFork.conditionBackupActor}</span>.
          </div>
        </div>
      )}

      {/* Escalation */}
      {fork && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Escalation Rule</p>
          <div className="px-3 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
            If <span className="font-semibold">{fork.actor}</span> doesn't respond within <span className="font-semibold">{fork.forkTimeout}</span>, the request is forwarded to <span className="font-semibold">{fork.forkEscalationActor}</span>.
          </div>
        </div>
      )}

      {/* Outcome */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Outcome</p>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span className="text-sm font-medium text-emerald-700">Request is approved and processed</span>
        </div>
      </div>
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

const TABS = ['Timeline', 'Cards', 'Steps', 'At a Glance'] as const;
type Tab = typeof TABS[number];

interface WorkflowPreviewProps {
  workflow: Workflow;
  groupName: string;
  onClose: () => void;
}

export const WorkflowPreview: React.FC<WorkflowPreviewProps> = ({ workflow, groupName, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Timeline');
  const steps = parseWorkflowSteps(workflow);

  const scopeNode = workflow.nodes.scope;
  const timeOffNode = workflow.nodes.time_off_type;
  const scopeLabel = scopeNode ? displayScopeValue(scopeNode.value as ScopeValue) : null;
  const timeOffLabel = timeOffNode ? displayTimeOffTypeValue(timeOffNode.value as TimeOffTypeValue) : null;
  const contextLine = [scopeLabel, timeOffLabel].filter(Boolean).join(' · ');

  const panel = (
    <div className="fixed inset-0 bg-black/40 z-[9000] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{groupName} — Preview</h2>
            {contextLine && <p className="text-xs text-slate-400 mt-0.5 capitalize">{contextLine}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 shrink-0 ml-4">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {activeTab === 'Timeline' && <TimelineView steps={steps} />}
          {activeTab === 'Cards' && <CardsView steps={steps} />}
          {activeTab === 'Steps' && <StepsView steps={steps} />}
          {activeTab === 'At a Glance' && <GlanceView steps={steps} />}
        </div>
      </motion.div>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
