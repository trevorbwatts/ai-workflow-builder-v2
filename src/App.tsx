import { useState, useCallback } from 'react';
import { ApprovalWorkflow } from './types';
import { ApprovalTileGrid } from './components/ApprovalTileGrid';
import { WorkflowEditor } from './components/WorkflowEditor';
import { motion, AnimatePresence } from 'motion/react';
import { Home, User, Users, IdCard, PieChart, FileText, CircleDollarSign, Banknote, Zap, Menu, ArrowLeft } from 'lucide-react';

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

// ─── Seed Data ───────────────────────────────────────────────────────────────

const defaultScope = { id: 'scope', type: 'scope' as const, label: 'Scope', value: { attribute: 'all' as const, value: '' } };

const APPROVAL_WORKFLOWS: ApprovalWorkflow[] = [
  {
    id: 'information-updates',
    name: 'Information Updates',
    icon: 'FileEdit',
    defaultRuleId: 'information-updates-default',
    status: 'published',
    rules: [{
      id: 'information-updates-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, employee information updates are approved by {approvers}, then {secondary_approver}.',
      nodes: {
        scope: defaultScope,
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['manager'] } },
        secondary_approver: { id: 'secondary_approver', type: 'approvers', label: 'Secondary Approver', value: { operator: 'AND', operands: ['managers manager'] } },
      },
    }],
  },
  {
    id: 'time-off',
    name: 'Time Off Requests',
    icon: 'Calendar',
    defaultRuleId: 'time-off-default',
    status: 'published',
    rules: [{
      id: 'time-off-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, {time_off_type} are sent to {approvers} for approval. If not approved within {timeout}, they are forwarded to {escalation}.',
      nodes: {
        scope: defaultScope,
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
    icon: 'Clock',
    defaultRuleId: 'timesheet-default',
    status: 'published',
    rules: [{
      id: 'timesheet-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, timesheets are submitted to {approvers} for approval. If not approved within {timeout}, they are escalated to {escalation}.',
      nodes: {
        scope: defaultScope,
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['manager'] } },
        timeout: { id: 'timeout', type: 'timeout', label: 'Timeout', value: { amount: 2, unit: 'days' } },
        escalation: { id: 'escalation', type: 'approvers', label: 'Escalation', value: { operator: 'AND', operands: ['managers manager'] } },
      },
    }],
  },
  {
    id: 'compensation',
    name: 'Compensation',
    icon: 'DollarSign',
    defaultRuleId: 'compensation-default',
    status: 'published',
    rules: [{
      id: 'compensation-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, compensation change requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: defaultScope,
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
  {
    id: 'employment-status',
    name: 'Employment Status',
    icon: 'UserCog',
    defaultRuleId: 'employment-status-default',
    status: 'published',
    rules: [{
      id: 'employment-status-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, employment status change requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: defaultScope,
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
  {
    id: 'job-information',
    name: 'Job Information',
    icon: 'Briefcase',
    defaultRuleId: 'job-information-default',
    status: 'published',
    rules: [{
      id: 'job-information-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, job information change requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: defaultScope,
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
  {
    id: 'promotion',
    name: 'Promotion',
    icon: 'Award',
    defaultRuleId: 'promotion-default',
    status: 'published',
    rules: [{
      id: 'promotion-default',
      label: 'Default',
      filter: null,
      template: 'For {scope}, promotion requests can be made by {requester}, and are approved by {approvers}.',
      nodes: {
        scope: defaultScope,
        requester: { id: 'requester', type: 'approvers', label: 'Requester', value: { operator: 'AND', operands: ['manager'] } },
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['role:Full Admin'] } },
      },
    }],
  },
];

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>(APPROVAL_WORKFLOWS);
  const [view, setView] = useState<'tiles' | 'editor'>('tiles');
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) ?? null;

  const handleSelect = useCallback((id: string) => {
    setActiveWorkflowId(id);
    setView('editor');
  }, []);

  const handleBack = useCallback(() => {
    setView('tiles');
    setActiveWorkflowId(null);
  }, []);

  const handleSave = useCallback((updated: ApprovalWorkflow) => {
    setWorkflows((prev) =>
      prev.map((w) => w.id === updated.id ? { ...updated, status: updated.status === 'published' ? 'published' : 'saved' as const } : w)
    );
  }, []);

  const handlePublish = useCallback((updated: ApprovalWorkflow) => {
    setWorkflows((prev) =>
      prev.map((w) => w.id === updated.id ? { ...updated, status: 'published' as const, pendingDraft: undefined } : w)
    );
  }, []);

  const selectedName = activeWorkflow?.name;

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
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 sticky top-0 z-10">
          {view === 'editor' ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={16} />
              Automations
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={18} />
              </div>
              <h1 className="text-sm font-bold text-slate-900">Automations</h1>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {view === 'tiles' && (
              <motion.div
                key="tiles"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto"
              >
                <ApprovalTileGrid workflows={workflows} onSelect={handleSelect} />
              </motion.div>
            )}
            {view === 'editor' && activeWorkflow && (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <WorkflowEditor
                  key={activeWorkflow.id}
                  workflow={activeWorkflow}
                  onSave={handleSave}
                  onPublish={handlePublish}
                  onBack={handleBack}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
