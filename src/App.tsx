import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { WorkflowGroup, Workflow, WorkflowNode } from './types';
import { WorkflowCard } from './components/WorkflowCard';
import { WorkflowPreview } from './components/WorkflowPreview';
import { NewWorkflowInput } from './components/NewWorkflowInput';
import { motion, AnimatePresence } from 'motion/react';
import { Home, User, Users, IdCard, PieChart, FileText, CircleDollarSign, Banknote, Zap, Menu, Plus, Loader2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { suggestScopeAdjustments } from './lib/gemini';
import { ScopeValue, TimeOffTypeValue } from './types';
import { displayScopeValue } from './lib/nodes';

const NAV_ITEMS = [
  { icon: Home, label: 'Home' },
  { icon: User, label: 'Profile' },
  { icon: Users, label: 'Team' },
  { icon: IdCard, label: 'Directory' },
  { icon: PieChart, label: 'Reports' },
  { icon: FileText, label: 'Documents' },
  { icon: CircleDollarSign, label: 'Payroll' },
  { icon: Banknote, label: 'Expenses' },
  { icon: Zap, label: 'Automations', active: true },
];

function scopeNode(): WorkflowNode {
  return { id: 'scope', type: 'scope', label: 'Scope', value: { attribute: 'all', value: '' } };
}

const WORKFLOW_GROUPS: WorkflowGroup[] = [
  {
    id: 'information-updates',
    name: 'Information Updates',
    variants: [{
      id: 'information-updates-default',
      name: 'Information Updates',
      template: 'For {scope}, employee information updates are approved by {approvers}, then {secondary_approver}.',
      nodes: {
        scope: scopeNode(),
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['manager'] } },
        secondary_approver: { id: 'secondary_approver', type: 'approvers', label: 'Secondary Approver', value: { operator: 'AND', operands: ['managers manager'] } },
      },
    }],
  },
  {
    id: 'time-off',
    name: 'Time Off Requests',
    variants: [{
      id: 'time-off-default',
      name: 'Time Off Requests',
      template: 'For {scope}, {time_off_type} are sent to {approvers} for approval. If not approved within {timeout}, they are forwarded to {escalation}.',
      nodes: {
        scope: scopeNode(),
        time_off_type: { id: 'time_off_type', type: 'time_off_type', label: 'Time-Off Type', value: { attribute: 'all' } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['manager'] } },
        timeout: { id: 'timeout', type: 'timeout', label: 'Timeout', value: { amount: 3, unit: 'days' } },
        escalation: { id: 'escalation', type: 'approvers', label: 'Escalation', value: { operator: 'AND', operands: ['managers manager'] } },
      },
    }],
  },
  {
    id: 'timesheet',
    name: 'Timesheet',
    variants: [{
      id: 'timesheet-default',
      name: 'Timesheet',
      template: 'For {scope}, timesheets are submitted to {approvers} for approval. If not approved within {timeout}, they are escalated to {escalation}.',
      nodes: {
        scope: scopeNode(),
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['manager'] } },
        timeout: { id: 'timeout', type: 'timeout', label: 'Timeout', value: { amount: 2, unit: 'days' } },
        escalation: { id: 'escalation', type: 'approvers', label: 'Escalation', value: { operator: 'AND', operands: ['managers manager'] } },
      },
    }],
  },
  {
    id: 'compensation',
    name: 'Compensation',
    variants: [{
      id: 'compensation-default',
      name: 'Compensation',
      template: 'For {scope}, compensation change requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: scopeNode(),
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
  {
    id: 'employment-status',
    name: 'Employment Status',
    variants: [{
      id: 'employment-status-default',
      name: 'Employment Status',
      template: 'For {scope}, employment status change requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: scopeNode(),
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
  {
    id: 'job-information',
    name: 'Job Information',
    variants: [{
      id: 'job-information-default',
      name: 'Job Information',
      template: 'For {scope}, job information change requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: scopeNode(),
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
  {
    id: 'promotion',
    name: 'Promotion',
    variants: [{
      id: 'promotion-default',
      name: 'Promotion',
      template: 'For {scope}, promotion requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: scopeNode(),
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
];

interface ScopeSuggestion {
  variantId: string;
  suggestedDisplay: string;
  suggestedAttribute: string;
  suggestedValue: string;
}

interface PublishingState {
  workflow: Workflow;
  phase: 'loading' | 'conflicts';
  suggestions: ScopeSuggestion[];
}

export default function App() {
  const [groups, setGroups] = useState<WorkflowGroup[]>(WORKFLOW_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState(WORKFLOW_GROUPS[0].id);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newestVariantId, setNewestVariantId] = useState<string | null>(null);
  const [dismissedUncovered, setDismissedUncovered] = useState(false);
  const [dismissedTimeOffUncovered, setDismissedTimeOffUncovered] = useState(false);
  const [duplicateDraftIds, setDuplicateDraftIds] = useState<Set<string>>(new Set());
  const [publishingState, setPublishingState] = useState<PublishingState | null>(null);
  const publishResolveRef = useRef<((published: boolean) => void) | null>(null);
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)!;

  const showUncoveredBanner = useMemo(() => {
    if (dismissedUncovered) return false;
    const variants = selectedGroup.variants;
    if (variants.length === 0) return false;
    return !variants.some((v) => {
      const attr = (v.nodes.scope?.value as ScopeValue)?.attribute;
      return attr === 'all' || attr === 'all_other';
    });
  }, [selectedGroup.variants, dismissedUncovered]);

  const showTimeOffCoverageBanner = useMemo(() => {
    if (dismissedTimeOffUncovered) return false;
    const variants = selectedGroup.variants;
    if (variants.length === 0) return false;
    const hasTimeOffTypeNode = variants.some((v) => v.nodes.time_off_type);
    if (!hasTimeOffTypeNode) return false;
    return !variants.some((v) => {
      const attr = (v.nodes.time_off_type?.value as TimeOffTypeValue)?.attribute;
      return attr === 'all' || attr === 'all_other';
    });
  }, [selectedGroup.variants, dismissedTimeOffUncovered]);

  const updateVariants = useCallback(
    (updater: (variants: Workflow[]) => Workflow[]) => {
      setGroups((prev) =>
        prev.map((g) => g.id === selectedGroupId ? { ...g, variants: updater(g.variants) } : g)
      );
    },
    [selectedGroupId]
  );

  const doCommit = useCallback((workflow: Workflow) => {
    setNewestVariantId((prev) => (prev === workflow.id ? null : prev));
    setDuplicateDraftIds((prev) => { const next = new Set(prev); next.delete(workflow.id); return next; });
    updateVariants((variants) => variants.map((v) => v.id === workflow.id ? workflow : v));
    publishResolveRef.current?.(true);
    publishResolveRef.current = null;
    setPublishingState(null);
  }, [updateVariants]);

  const handleApply = useCallback((updatedWorkflow: Workflow): Promise<boolean> => {
    return new Promise((resolve) => {
      publishResolveRef.current = resolve;
      setPublishingState({ workflow: updatedWorkflow, phase: 'loading', suggestions: [] });
    });
  }, []);

  // Run conflict check when publish modal opens
  useEffect(() => {
    if (!publishingState || publishingState.phase !== 'loading') return;
    const { workflow } = publishingState;
    const group = groups.find((g) => g.id === selectedGroupId)!;
    const updatedVariants = group.variants.map((v) => v.id === workflow.id ? workflow : v);

    if (updatedVariants.length <= 1) {
      doCommit(workflow);
      return;
    }

    const scopeData = updatedVariants.map((v) => ({
      id: v.id,
      scope: (v.nodes.scope?.value as ScopeValue) ?? { attribute: 'all' as const, value: '' },
      timeOffType: v.nodes.time_off_type?.value as TimeOffTypeValue | undefined,
    }));

    suggestScopeAdjustments(scopeData, group.name)
      .then((suggestions) => {
        if (suggestions.length > 0) {
          setPublishingState((prev) => prev ? { ...prev, phase: 'conflicts', suggestions } : null);
        } else {
          doCommit(workflow);
        }
      })
      .catch(() => doCommit(workflow));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishingState?.workflow?.id, publishingState?.phase]);

  const handleNewWorkflowCreated = useCallback((workflow: Workflow) => {
    const id = `${selectedGroupId}-${Date.now()}`;
    const newVariant: Workflow = { ...workflow, id };
    setNewestVariantId(id);
    setIsCreatingNew(false);
    updateVariants((v) => [...v, newVariant]);
  }, [selectedGroupId, updateVariants]);

  const handleDeleteVariant = useCallback(
    (variantId: string) => {
      updateVariants((v) => v.filter((w) => w.id !== variantId));
      setDuplicateDraftIds((prev) => { const next = new Set(prev); next.delete(variantId); return next; });
    },
    [updateVariants]
  );

  const handleDuplicateVariant = useCallback((variantId: string) => {
    const source = selectedGroup.variants.find((v) => v.id === variantId)!;
    const id = `${selectedGroupId}-${Date.now()}`;
    const duplicate: Workflow = { ...source, id };
    setDuplicateDraftIds((prev) => new Set([...prev, id]));
    setNewestVariantId(id);
    updateVariants((v) => [...v, duplicate]);
  }, [selectedGroup.variants, selectedGroupId, updateVariants]);

  const handleAddCatchAll = useCallback(() => {
    const base = selectedGroup.variants[0];
    const id = `${selectedGroupId}-${Date.now()}`;
    const catchAllVariant: Workflow = {
      ...base,
      id,
      nodes: {
        ...base.nodes,
        scope: {
          ...base.nodes.scope,
          value: { attribute: 'all_other', value: '' } as ScopeValue,
        },
      },
    };
    setNewestVariantId(id);
    updateVariants((v) => [...v, catchAllVariant]);
  }, [selectedGroup.variants, selectedGroupId, updateVariants]);

  const handleAddTimeOffCatchAll = useCallback(() => {
    const base = selectedGroup.variants[0];
    const id = `${selectedGroupId}-${Date.now()}`;
    const catchAllVariant: Workflow = {
      ...base,
      id,
      nodes: {
        ...base.nodes,
        time_off_type: {
          ...base.nodes.time_off_type,
          value: { attribute: 'all_other' } as TimeOffTypeValue,
        },
      },
    };
    setNewestVariantId(id);
    updateVariants((v) => [...v, catchAllVariant]);
  }, [selectedGroup.variants, selectedGroupId, updateVariants]);

  const handleAcceptSuggestion = useCallback(
    (suggestion: ScopeSuggestion) => {
      updateVariants((variants) =>
        variants.map((v) => {
          if (v.id !== suggestion.variantId) return v;
          return {
            ...v,
            nodes: {
              ...v.nodes,
              scope: {
                ...v.nodes.scope,
                value: { attribute: suggestion.suggestedAttribute as ScopeValue['attribute'], value: suggestion.suggestedValue },
              },
            },
          };
        })
      );
    },
    [updateVariants]
  );

  const handlePublishModalCancel = useCallback(() => {
    publishResolveRef.current?.(false);
    publishResolveRef.current = null;
    setPublishingState(null);
  }, []);

  const handleFixAndPublish = useCallback(() => {
    if (!publishingState) return;
    // Apply all suggestions then commit
    publishingState.suggestions.forEach(handleAcceptSuggestion);
    doCommit(publishingState.workflow);
  }, [publishingState, handleAcceptSuggestion, doCommit]);

  const handlePublishAnyway = useCallback(() => {
    if (!publishingState) return;
    doCommit(publishingState.workflow);
  }, [publishingState, doCommit]);

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* Global Nav */}
      <nav className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-4 sticky top-0 h-screen z-20 shrink-0">
        <div className="flex-1 flex flex-col items-center gap-1 mt-2">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              title={label}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
            <img src="https://i.pravatar.cc/32" alt="avatar" className="w-full h-full object-cover" />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <Menu size={18} />
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="text-white" size={18} />
            </div>
            <h1 className="text-sm font-bold text-slate-900">Automations</h1>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-56 border-r border-slate-200 bg-white hidden lg:flex flex-col p-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Your Workflows</h3>
            <div className="space-y-0.5">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGroupId(g.id); setDismissedUncovered(false); setDismissedTimeOffUncovered(false); setPreviewWorkflow(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    g.id === selectedGroupId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 min-w-0">
            <motion.div
              key={selectedGroupId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl space-y-4"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-4">{selectedGroup.name}</h2>

              {/* Coverage gap banner */}
              <AnimatePresence>
                {showUncoveredBanner && (
                  <motion.div
                    key="uncovered-banner"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-red-800">
                      <span className="font-semibold">Coverage gap:</span> Some employees aren't covered by any workflow variant. Add a catch-all to ensure everyone is included.
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleAddCatchAll}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
                      >
                        Add catch-all
                      </button>
                      <button
                        onClick={() => setDismissedUncovered(true)}
                        className="px-3 py-1 text-red-700 border border-red-300 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Time-off type coverage gap banner */}
              <AnimatePresence>
                {showTimeOffCoverageBanner && (
                  <motion.div
                    key="time-off-uncovered-banner"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-red-800">
                      <span className="font-semibold">Coverage gap:</span> Some time-off types aren't covered by any workflow variant. Add a catch-all to ensure all request types are included.
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleAddTimeOffCatchAll}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
                      >
                        Add catch-all
                      </button>
                      <button
                        onClick={() => setDismissedTimeOffUncovered(true)}
                        className="px-3 py-1 text-red-700 border border-red-300 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {[...selectedGroup.variants].sort((a, b) => {
                  const aIsOther =
                    (a.nodes.scope?.value as ScopeValue)?.attribute === 'all_other' ||
                    (a.nodes.time_off_type?.value as TimeOffTypeValue)?.attribute === 'all_other';
                  const bIsOther =
                    (b.nodes.scope?.value as ScopeValue)?.attribute === 'all_other' ||
                    (b.nodes.time_off_type?.value as TimeOffTypeValue)?.attribute === 'all_other';
                  return aIsOther === bIsOther ? 0 : aIsOther ? 1 : -1;
                }).map((variant) => (
                  <motion.div
                    key={variant.id}
                    layout
                    initial={variant.id === newestVariantId ? { opacity: 0, y: -16 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                  >
                    <WorkflowCard
                      liveWorkflow={variant}
                      onUpdateLiveNode={() => {}}
                      onApply={handleApply}
                      onDelete={selectedGroup.variants.length > 1 ? () => handleDeleteVariant(variant.id) : undefined}
                      onDuplicate={() => handleDuplicateVariant(variant.id)}
                      onPreview={setPreviewWorkflow}
                      groupName={selectedGroup.name}
                      initiallyEditing={variant.id === newestVariantId}
                      isDraft={variant.id === newestVariantId}
                      isDuplicateDraft={duplicateDraftIds.has(variant.id)}
                      hasConflict={false}
                      hasMultipleVariants={selectedGroup.variants.length > 1}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {isCreatingNew && (
                  <motion.div
                    key="new-workflow-input"
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                  >
                    <NewWorkflowInput
                      baseWorkflow={selectedGroup.variants[selectedGroup.variants.length - 1]}
                      onCreated={handleNewWorkflowCreated}
                      onCancel={() => setIsCreatingNew(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {!isCreatingNew && (
                <button
                  onClick={() => setIsCreatingNew(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all w-full max-w-3xl justify-center"
                >
                  <Plus size={14} /> Add Workflow
                </button>
              )}
            </motion.div>
          </div>

          {/* Preview Sidebar */}
          <AnimatePresence>
            {previewWorkflow && (
              <motion.div
                key="preview-sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 600, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                className="border-l border-slate-200 bg-white overflow-hidden shrink-0"
              >
                <WorkflowPreview
                  workflow={previewWorkflow}
                  groupName={selectedGroup.name}
                  onClose={() => setPreviewWorkflow(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Publishing Modal */}
      {publishingState && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {publishingState.phase === 'loading' && (
              <div className="flex flex-col items-center justify-center px-8 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                  <Loader2 size={22} className="text-indigo-500 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Setting up your workflow</p>
                <p className="text-xs text-slate-400 mt-1">Checking for conflicts...</p>
              </div>
            )}

            {publishingState.phase === 'conflicts' && (
              <>
                <div className="flex items-start justify-between px-5 pt-5 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={15} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Scope conflict detected</p>
                      <p className="text-xs text-slate-500 mt-0.5">Publishing this will create overlapping rules.</p>
                    </div>
                  </div>
                  <button onClick={handlePublishModalCancel} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>

                <div className="px-5 pb-4 space-y-2">
                  {publishingState.suggestions.map((s) => {
                    const group = groups.find((g) => g.id === selectedGroupId)!;
                    const variant = group.variants.find((v) => v.id === s.variantId) ?? publishingState.workflow;
                    return (
                      <div key={s.variantId} className="px-3 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                        Change <span className="font-semibold">"{displayScopeValue(variant.nodes.scope?.value as ScopeValue)}"</span>{' '}
                        to <span className="font-semibold">"{s.suggestedDisplay}"</span> to avoid overlap.
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 pb-5 flex gap-2">
                  <button
                    onClick={handleFixAndPublish}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <CheckCircle2 size={13} /> Fix &amp; Publish
                  </button>
                  <button
                    onClick={handlePublishAnyway}
                    className="flex-1 px-3 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Publish Anyway
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
