import { useState, useCallback } from 'react';
import { WorkflowGroup, Workflow, WorkflowNode } from './types';
import { WorkflowCard } from './components/WorkflowCard';
import { motion, AnimatePresence } from 'motion/react';
import { Home, User, Users, IdCard, PieChart, FileText, CircleDollarSign, Banknote, Zap, Menu, Plus } from 'lucide-react';
import { suggestScopeAdjustments } from './lib/gemini';
import { ScopeValue } from './types';
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
      template: 'For {scope}, time off requests are sent to {approvers} for approval. If not approved within {timeout}, they are forwarded to {escalation}.',
      nodes: {
        scope: scopeNode(),
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

export default function App() {
  const [groups, setGroups] = useState<WorkflowGroup[]>(WORKFLOW_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState(WORKFLOW_GROUPS[0].id);
  const [scopeSuggestions, setScopeSuggestions] = useState<ScopeSuggestion[]>([]);
  const [newVariantId, setNewVariantId] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)!;

  const updateVariants = useCallback(
    (updater: (variants: Workflow[]) => Workflow[]) => {
      setGroups((prev) =>
        prev.map((g) => g.id === selectedGroupId ? { ...g, variants: updater(g.variants) } : g)
      );
    },
    [selectedGroupId]
  );

  const handleApply = useCallback(
    async (updatedWorkflow: Workflow) => {
      setNewVariantId((prev) => (prev === updatedWorkflow.id ? null : prev));
      updateVariants((variants) =>
        variants.map((v) => (v.id === updatedWorkflow.id ? updatedWorkflow : v))
      );

      // Check for scope conflicts asynchronously
      setGroups((prev) => {
        const group = prev.find((g) => g.id === selectedGroupId)!;
        const updated = group.variants.map((v) => v.id === updatedWorkflow.id ? updatedWorkflow : v);
        if (updated.length > 1) {
          const scopeData = updated.map((v) => ({
            id: v.id,
            scope: v.nodes.scope?.value as ScopeValue ?? { attribute: 'all' as const, value: '' },
          }));
          suggestScopeAdjustments(scopeData, group.name).then(setScopeSuggestions).catch(() => {});
        }
        return prev;
      });
    },
    [updateVariants, selectedGroupId]
  );

  const handleAddVariant = useCallback(() => {
    const variants = selectedGroup.variants;
    const base = variants[variants.length - 1];
    const id = `${selectedGroupId}-${Date.now()}`;
    const newVariant: Workflow = {
      ...JSON.parse(JSON.stringify(base)),
      id,
    };
    setNewVariantId(id);
    updateVariants((v) => [...v, newVariant]);
  }, [selectedGroup, selectedGroupId, updateVariants]);

  const handleDeleteVariant = useCallback(
    (variantId: string) => {
      updateVariants((v) => v.filter((w) => w.id !== variantId));
      setScopeSuggestions((s) => s.filter((x) => x.variantId !== variantId));
    },
    [updateVariants]
  );

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
      setScopeSuggestions((s) => s.filter((x) => x.variantId !== suggestion.variantId));
    },
    [updateVariants]
  );

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
                  onClick={() => { setSelectedGroupId(g.id); setScopeSuggestions([]); }}
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
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
            <motion.div
              key={selectedGroupId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl space-y-4"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-4">{selectedGroup.name}</h2>

              {/* Scope conflict suggestions */}
              <AnimatePresence>
                {scopeSuggestions.map((s) => {
                  const variant = selectedGroup.variants.find((v) => v.id === s.variantId);
                  if (!variant) return null;
                  return (
                    <motion.div
                      key={s.variantId}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-amber-800">
                        <span className="font-semibold">Scope conflict:</span> Suggest changing{' '}
                        <span className="font-medium">"{displayScopeValue(variant.nodes.scope?.value as ScopeValue)}"</span>{' '}
                        to <span className="font-medium">"{s.suggestedDisplay}"</span>
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleAcceptSuggestion(s)}
                          className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setScopeSuggestions((prev) => prev.filter((x) => x.variantId !== s.variantId))}
                          className="px-3 py-1 text-amber-700 border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {selectedGroup.variants.map((variant) => (
                <WorkflowCard
                  key={variant.id}
                  liveWorkflow={variant}
                  onUpdateLiveNode={() => {}}
                  onApply={handleApply}
                  onDelete={selectedGroup.variants.length > 1 ? () => handleDeleteVariant(variant.id) : undefined}
                  initiallyEditing={variant.id === newVariantId}
                  isNew={variant.id === newVariantId}
                />
              ))}

              <button
                onClick={handleAddVariant}
                className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all w-full max-w-3xl justify-center"
              >
                <Plus size={14} /> Add Workflow
              </button>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
