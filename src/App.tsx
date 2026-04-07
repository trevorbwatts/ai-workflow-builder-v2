import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { WorkflowGroup, Workflow, WorkflowNode } from './types';
import { WorkflowCard } from './components/WorkflowCard';
import { WorkflowPreview } from './components/WorkflowPreview';
import { NewWorkflowInput } from './components/NewWorkflowInput';
import { ConflictModal, CoverageGap } from './components/ConflictModal';
import { motion, AnimatePresence } from 'motion/react';
import { Home, User, Users, IdCard, PieChart, FileText, CircleDollarSign, Banknote, Zap, Menu, Plus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { suggestScopeAdjustments } from './lib/gemini';
import { ScopeValue, TimeOffTypeValue } from './types';

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
      status: 'published',
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
      status: 'published',
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
      status: 'published',
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
      status: 'published',
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
      status: 'published',
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
      status: 'published',
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
      status: 'published',
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

type ConflictStatus =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'clear' }
  | { phase: 'conflicts'; suggestions: ScopeSuggestion[] };

export default function App() {
  const [groups, setGroups] = useState<WorkflowGroup[]>(WORKFLOW_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState(WORKFLOW_GROUPS[0].id);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [conflictStatus, setConflictStatus] = useState<ConflictStatus>({ phase: 'idle' });
  const conflictCheckCounter = useRef(0);
  const conflictDebounce = useRef<ReturnType<typeof setTimeout>>();
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)!;

  const updateVariants = useCallback(
    (updater: (variants: Workflow[]) => Workflow[]) => {
      setGroups((prev) =>
        prev.map((g) => g.id === selectedGroupId ? { ...g, variants: updater(g.variants) } : g)
      );
    },
    [selectedGroupId]
  );

  // Project the "effective future published state": published variants (with pending drafts applied)
  // plus saved variants. Drafts are excluded — they haven't been committed yet.
  const getEffectiveVariants = useCallback((variants: Workflow[]): Workflow[] =>
    variants
      .filter((v) => v.status === 'published' || v.status === 'saved')
      .map((v) => v.pendingDraft ? { ...v, ...v.pendingDraft } : v),
    []
  );

  const effectiveVariants = useMemo(
    () => getEffectiveVariants(selectedGroup.variants),
    [selectedGroup.variants, getEffectiveVariants]
  );

  // Coverage gap check runs against the effective future state
  const coverageGaps = useMemo((): CoverageGap[] => {
    const gaps: CoverageGap[] = [];
    if (effectiveVariants.length === 0) return gaps;

    const hasScopeCatchAll = effectiveVariants.some((v) => {
      const attr = (v.nodes.scope?.value as ScopeValue)?.attribute;
      return attr === 'all' || attr === 'all_other';
    });
    if (!hasScopeCatchAll) {
      gaps.push({ kind: 'scope', description: "Some employees aren't covered by any workflow variant. Add a catch-all to ensure everyone is included." });
    }

    const hasTimeOffTypeNode = effectiveVariants.some((v) => v.nodes.time_off_type);
    if (hasTimeOffTypeNode) {
      const hasTimeOffCatchAll = effectiveVariants.some((v) => {
        const attr = (v.nodes.time_off_type?.value as TimeOffTypeValue)?.attribute;
        return attr === 'all' || attr === 'all_other';
      });
      if (!hasTimeOffCatchAll) {
        gaps.push({ kind: 'time_off_type', description: "Some time-off types aren't covered by any workflow variant. Add a catch-all to ensure all request types are included." });
      }
    }

    return gaps;
  }, [effectiveVariants]);

  // Auto-run conflict check (debounced) whenever the effective future state changes
  useEffect(() => {
    clearTimeout(conflictDebounce.current);

    if (effectiveVariants.length <= 1) {
      setConflictStatus({ phase: 'clear' });
      return;
    }

    conflictDebounce.current = setTimeout(() => {
      const myCheck = ++conflictCheckCounter.current;
      setConflictStatus({ phase: 'checking' });

      const scopeData = effectiveVariants.map((v) => ({
        id: v.id,
        scope: (v.nodes.scope?.value as ScopeValue) ?? { attribute: 'all' as const, value: '' },
        timeOffType: v.nodes.time_off_type?.value as TimeOffTypeValue | undefined,
      }));

      const groupName = groups.find((g) => g.id === selectedGroupId)!.name;
      suggestScopeAdjustments(scopeData, groupName)
        .then((suggestions) => {
          if (myCheck !== conflictCheckCounter.current) return;
          setConflictStatus(suggestions.length > 0
            ? { phase: 'conflicts', suggestions }
            : { phase: 'clear' }
          );
        })
        .catch(() => {
          if (myCheck !== conflictCheckCounter.current) return;
          setConflictStatus({ phase: 'clear' });
        });
    }, 600);

    return () => clearTimeout(conflictDebounce.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVariants, selectedGroupId]);

  const handleSave = useCallback((updatedWorkflow: Workflow) => {
    const original = selectedGroup.variants.find((v) => v.id === updatedWorkflow.id);
    if (original?.status === 'published') {
      // Keep the published version live; store changes as a pending draft
      updateVariants((variants) =>
        variants.map((v) => v.id === updatedWorkflow.id
          ? { ...v, pendingDraft: { template: updatedWorkflow.template, nodes: updatedWorkflow.nodes } }
          : v
        )
      );
    } else {
      updateVariants((variants) =>
        variants.map((v) =>
          v.id === updatedWorkflow.id ? { ...updatedWorkflow, status: 'saved' as const, pendingDraft: undefined } : v
        )
      );
    }
  }, [updateVariants, selectedGroup.variants]);

  const handlePublish = useCallback((variantId: string) => {
    updateVariants((variants) =>
      variants.map((v) => {
        if (v.id !== variantId) return v;
        const { pendingDraft, ...rest } = v;
        return pendingDraft
          ? { ...rest, ...pendingDraft, status: 'published' as const }
          : { ...rest, status: 'published' as const };
      })
    );
  }, [updateVariants]);

  const handleDiscardDraft = useCallback((variantId: string) => {
    updateVariants((variants) =>
      variants.map((v) => {
        if (v.id !== variantId) return v;
        const { pendingDraft, ...rest } = v;
        return rest;
      })
    );
  }, [updateVariants]);

  const handleNewWorkflowCreated = useCallback((workflow: Workflow) => {
    const id = `${selectedGroupId}-${Date.now()}`;
    const newVariant: Workflow = { ...workflow, id, status: 'draft', pendingDraft: undefined };
    setIsCreatingNew(false);
    updateVariants((v) => [...v, newVariant]);
  }, [selectedGroupId, updateVariants]);

  const handleDeleteVariant = useCallback(
    (variantId: string) => {
      updateVariants((v) => v.filter((w) => w.id !== variantId));
    },
    [updateVariants]
  );

  const handleDuplicateVariant = useCallback((variantId: string) => {
    const source = selectedGroup.variants.find((v) => v.id === variantId)!;
    const id = `${selectedGroupId}-${Date.now()}`;
    const duplicate: Workflow = { ...source, id, status: 'draft', pendingDraft: undefined };
    updateVariants((v) => [...v, duplicate]);
  }, [selectedGroup.variants, selectedGroupId, updateVariants]);

  const handleAddCatchAll = useCallback(() => {
    const base = selectedGroup.variants[0];
    const id = `${selectedGroupId}-${Date.now()}`;
    const catchAllVariant: Workflow = {
      ...base,
      id,
      status: 'draft',
      nodes: {
        ...base.nodes,
        scope: {
          ...base.nodes.scope,
          value: { attribute: 'all_other', value: '' } as ScopeValue,
        },
      },
    };
    updateVariants((v) => [...v, catchAllVariant]);
  }, [selectedGroup.variants, selectedGroupId, updateVariants]);

  const handleAddTimeOffCatchAll = useCallback(() => {
    const base = selectedGroup.variants[0];
    const id = `${selectedGroupId}-${Date.now()}`;
    const catchAllVariant: Workflow = {
      ...base,
      id,
      status: 'draft',
      nodes: {
        ...base.nodes,
        time_off_type: {
          ...base.nodes.time_off_type,
          value: { attribute: 'all_other' } as TimeOffTypeValue,
        },
      },
    };
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

  const handleAcceptAllSuggestions = useCallback(() => {
    if (conflictStatus.phase === 'conflicts') {
      conflictStatus.suggestions.forEach(handleAcceptSuggestion);
      setConflictStatus({ phase: 'clear' });
      setShowConflictModal(false);
    }
  }, [conflictStatus, handleAcceptSuggestion]);

  const handleAcceptOneSuggestion = useCallback((suggestion: ScopeSuggestion) => {
    handleAcceptSuggestion(suggestion);
    // After applying one fix, update conflict status to remove it
    setConflictStatus((prev) => {
      if (prev.phase !== 'conflicts') return prev;
      const remaining = prev.suggestions.filter((s) => s.variantId !== suggestion.variantId);
      if (remaining.length === 0) {
        setShowConflictModal(false);
        return { phase: 'clear' };
      }
      return { phase: 'conflicts', suggestions: remaining };
    });
  }, [handleAcceptSuggestion]);

  return (
    <div className="h-screen flex bg-[#F9FAFB] overflow-hidden">
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
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Approval Workflows</h3>
            <div className="space-y-0.5">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGroupId(g.id); setPreviewWorkflow(null); setConflictStatus({ phase: 'idle' }); }}
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
              {(() => {
                const scopeConflicts = conflictStatus.phase === 'conflicts' ? conflictStatus.suggestions.length : 0;
                const totalIssues = coverageGaps.length + scopeConflicts;
                const hasIssues = totalIssues > 0;
                const isAllClear = !hasIssues && (conflictStatus.phase === 'clear');

                return (
                  <div className="flex items-center justify-between mb-4 max-w-3xl w-full">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedGroup.name}</h2>
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider">Pre-Flight Check</span>
                      {conflictStatus.phase === 'checking' && (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Loader2 size={12} className="animate-spin" /> Checking...
                        </span>
                      )}
                      {conflictStatus.phase !== 'checking' && isAllClear && (
                        <span className="flex items-center gap-1.5 text-emerald-600">
                          <CheckCircle2 size={12} /> Everything looks good
                        </span>
                      )}
                      {conflictStatus.phase !== 'checking' && !isAllClear && !hasIssues && (
                        <span className="text-slate-400">Ready</span>
                      )}
                      {conflictStatus.phase !== 'checking' && hasIssues && (
                        <span className="flex items-center gap-2 text-amber-600">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            {totalIssues} {totalIssues === 1 ? 'Issue' : 'Issues'} Found
                          </span>
                          <button
                            onClick={() => setShowConflictModal(true)}
                            className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-semibold hover:bg-amber-200 transition-colors"
                          >
                            View &amp; Resolve
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                    initial={variant.status === 'draft' ? { opacity: 0, y: -16 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                  >
                    <WorkflowCard
                      liveWorkflow={variant}
                      onUpdateLiveNode={() => {}}
                      onSave={handleSave}
                      onPublish={handlePublish}
                      onDiscardDraft={handleDiscardDraft}
                      onDelete={selectedGroup.variants.length > 1 ? () => handleDeleteVariant(variant.id) : undefined}
                      onDuplicate={() => handleDuplicateVariant(variant.id)}
                      onPreview={setPreviewWorkflow}
                      groupName={selectedGroup.name}
                      initiallyEditing={variant.status === 'draft'}
                      hasConflicts={conflictStatus.phase === 'conflicts'}
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
                animate={{ width: 500, opacity: 1 }}
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

      {showConflictModal && (
        <ConflictModal
          suggestions={conflictStatus.phase === 'conflicts' ? conflictStatus.suggestions : []}
          coverageGaps={coverageGaps}
          variants={selectedGroup.variants}
          onAcceptSuggestion={handleAcceptOneSuggestion}
          onFixCoverageGap={(kind) => {
            if (kind === 'scope') handleAddCatchAll();
            else handleAddTimeOffCatchAll();
          }}
          onAcceptAll={handleAcceptAllSuggestions}
          onClose={() => setShowConflictModal(false)}
        />
      )}
    </div>
  );
}
