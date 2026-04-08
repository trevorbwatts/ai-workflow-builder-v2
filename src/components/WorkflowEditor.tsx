import React, { useState, useCallback, useMemo } from 'react';
import { ApprovalWorkflow, WorkflowRule, Message, ValidationIssue, WorkflowNode } from '../types';
import { ChatPanel } from './ChatPanel';
import { Save, Upload, Pencil, Trash2 } from 'lucide-react';
import { BranchingFlowchart } from './BranchingFlowchart';
import { WorkflowSentence } from './WorkflowSentence';
import { NodeEditor } from './NodeEditor';
import { PannableCanvas } from './PannableCanvas';
import { processWorkflowEdit } from '../lib/gemini';
import { validateWorkflow } from '../lib/validation';
import { scopeValueToFilter } from '../lib/nodes';
import { ScopeValue } from '../types';
import { AnimatePresence, motion } from 'motion/react';

type DraftState = 'none' | 'unsaved' | 'saved';

interface WorkflowEditorProps {
  workflow: ApprovalWorkflow;
  onSave: (w: ApprovalWorkflow) => void;
  onPublish: (w: ApprovalWorkflow) => void;
  onBack: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow: initialWorkflow, onSave, onPublish, onBack,
}) => {
  // The frozen published snapshot shown in the top box
  const [publishedRules, setPublishedRules] = useState(initialWorkflow.rules);

  // The working copy (draft) — starts equal to published
  const [workflow, setWorkflow] = useState<ApprovalWorkflow>(initialWorkflow);

  // none → no draft box shown; unsaved → "Draft"; saved → "Saved Draft"
  const [draftState, setDraftState] = useState<DraftState>('none');

  const [activeRuleId, setActiveRuleId] = useState(workflow.rules[0]?.id ?? '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [editingNode, setEditingNode] = useState<{ ruleId: string; nodeId: string; rect: DOMRect } | null>(null);

  const activeRule = useMemo(
    () => workflow.rules.find((r) => r.id === activeRuleId),
    [workflow.rules, activeRuleId]
  );

  const runValidation = useCallback((wf: ApprovalWorkflow) => {
    const issues = validateWorkflow(wf);
    setValidationIssues(issues);
    return issues;
  }, []);

  const updateRule = useCallback((ruleId: string, updater: (r: WorkflowRule) => WorkflowRule) => {
    setWorkflow((prev) => {
      const next = { ...prev, rules: prev.rules.map((r) => r.id === ruleId ? updater(r) : r) };
      runValidation(next);
      return next;
    });
    setDraftState('unsaved');
  }, [runValidation]);

  const handleSendMessage = useCallback(async (msg: string) => {
    const userMsg: Message = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setEditingNode(null);

    try {
      const result = await processWorkflowEdit(workflow, activeRuleId, msg, [...messages, userMsg]);
      setWorkflow(result.updatedWorkflow);
      setDraftState('unsaved');
      setMessages((prev) => [...prev, { role: 'model', content: result.explanation }]);

      const clientIssues = validateWorkflow(result.updatedWorkflow);
      const aiIssues = result.validationIssues ?? [];
      const allIssues = [...clientIssues];
      for (const ai of aiIssues) {
        if (!allIssues.some((c) => c.message === ai.message)) allIssues.push(ai);
      }
      setValidationIssues(allIssues);

      if (!result.updatedWorkflow.rules.find((r) => r.id === activeRuleId)) {
        setActiveRuleId(result.updatedWorkflow.rules[0]?.id ?? '');
      }
    } catch (err) {
      console.error('Workflow edit error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, { role: 'model', content: `Error: ${errMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [workflow, activeRuleId, messages]);

  const handleUpdateNodeForRule = useCallback((ruleId: string, nodeId: string, newValue: any) => {
    updateRule(ruleId, (r) => {
      const updatedNodes = { ...r.nodes, [nodeId]: { ...r.nodes[nodeId], value: newValue } };
      const updatedRule = { ...r, nodes: updatedNodes };
      if (nodeId === 'scope') updatedRule.filter = scopeValueToFilter(newValue as ScopeValue);
      return updatedRule;
    });
  }, [updateRule]);

  const handleRemoveNodeForRule = useCallback((ruleId: string, nodeId: string) => {
    updateRule(ruleId, (r) => {
      const { [nodeId]: _, ...restNodes } = r.nodes;
      const template = r.template.replace(new RegExp(`,\\s*then\\s*\\{${nodeId}\\}`), '');
      return { ...r, nodes: restNodes, template };
    });
  }, [updateRule]);

  const handleUpdateNode = useCallback((nodeId: string, newValue: any) => {
    if (editingNode) handleUpdateNodeForRule(editingNode.ruleId, nodeId, newValue);
  }, [editingNode, handleUpdateNodeForRule]);

  const handleNodeClick = useCallback((ruleId: string, nodeId: string, rect: DOMRect) => {
    setEditingNode({ ruleId, nodeId, rect });
    if (ruleId !== activeRuleId) setActiveRuleId(ruleId);
  }, [activeRuleId]);

  const handleAddRule = useCallback(() => {
    const id = `rule-${Date.now()}`;
    const newRule: WorkflowRule = {
      id,
      label: 'New Rule',
      filter: { logic: 'AND', conditions: [{ attribute: 'department', operator: 'is', value: 'Engineering' }] },
      template: activeRule?.template ?? 'For {scope}, requests are approved by {approvers}.',
      nodes: activeRule ? { ...activeRule.nodes } : {
        scope: { id: 'scope', type: 'scope', label: 'Scope', value: { attribute: 'all', value: '' } } as WorkflowNode,
        approvers: { id: 'approvers', type: 'approvers', label: 'Approvers', value: { operator: 'AND', operands: ['manager'] } } as WorkflowNode,
      },
    };
    setWorkflow((prev) => {
      const next = { ...prev, rules: [...prev.rules, newRule] };
      runValidation(next);
      return next;
    });
    setDraftState('unsaved');
    setActiveRuleId(id);
  }, [activeRule, runValidation]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    if (ruleId === workflow.defaultRuleId) return;
    setWorkflow((prev) => {
      const next = { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) };
      runValidation(next);
      return next;
    });
    setDraftState('unsaved');
    if (activeRuleId === ruleId) setActiveRuleId(workflow.rules[0]?.id ?? '');
  }, [workflow.defaultRuleId, workflow.rules, activeRuleId, runValidation]);

  const handleSave = useCallback(() => {
    onSave(workflow);
    setDraftState('saved');
  }, [workflow, onSave]);

  const handlePublish = useCallback(() => {
    const published = { ...workflow, status: 'published' as const };
    setPublishedRules(workflow.rules);
    setDraftState('none');
    onPublish(published);
  }, [workflow, onPublish]);

  const hasErrors = validationIssues.some((i) => i.severity === 'error');
  const editingNodeData = editingNode && workflow.rules.find((r) => r.id === editingNode.ruleId)?.nodes[editingNode.nodeId];

  const draftBadge = draftState === 'saved'
    ? 'bg-sky-50 text-sky-700 border-sky-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
  const draftLabel = draftState === 'saved' ? 'Saved Draft' : 'Draft';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex min-h-0">
        {/* Left: Summary boxes + Flowchart */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

          {/* Published box — always visible, read-only */}
          <div className="border-b border-slate-200 bg-white px-5 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{workflow.name}</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  Published
                </span>
              </div>
              {draftState === 'none' && (
                <button
                  onClick={() => setDraftState('unsaved')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            <div className="workflow-text text-slate-700 leading-relaxed">
              {publishedRules.map((rule) => (
                <WorkflowSentence
                  key={rule.id + rule.template}
                  workflow={rule}
                  readOnly
                />
              ))}
            </div>
          </div>

          {/* Draft box — slides in when edits are made */}
          <AnimatePresence>
            {draftState !== 'none' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="border-b border-slate-200 bg-slate-50 px-5 py-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${draftBadge}`}>
                    {draftLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setWorkflow((prev) => ({ ...prev, rules: publishedRules }));
                        setDraftState('none');
                        setValidationIssues([]);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-white hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <Trash2 size={12} /> Discard
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={draftState === 'saved'}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={hasErrors}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Upload size={12} /> Publish
                    </button>
                  </div>
                </div>
                <div className="workflow-text text-slate-700 leading-relaxed">
                  {workflow.rules.map((rule) => (
                    <WorkflowSentence
                      key={rule.id + rule.template}
                      workflow={rule}
                      onUpdateNode={(nodeId, val) => handleUpdateNodeForRule(rule.id, nodeId, val)}
                      onRemoveNode={(nodeId) => handleRemoveNodeForRule(rule.id, nodeId)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flowchart Canvas — always shows working copy */}
          <PannableCanvas workflowId={`${workflow.id}-${activeRuleId}`}>
            <BranchingFlowchart
              rules={workflow.rules}
              activeRuleId={activeRuleId}
              workflowName={workflow.name}
              onNodeClick={handleNodeClick}
              validationIssues={validationIssues}
            />
          </PannableCanvas>
        </div>

        {/* Right: Chat Panel */}
        <div className="w-[380px] shrink-0">
          <ChatPanel
            messages={messages}
            onSend={handleSendMessage}
            isLoading={isLoading}
            validationIssues={validationIssues}
          />
        </div>
      </div>

      {/* NodeEditor portal */}
      <AnimatePresence>
        {editingNode && editingNodeData && (
          <NodeEditor
            node={editingNodeData}
            anchorRect={editingNode.rect}
            onClose={() => setEditingNode(null)}
            onSave={(newValue) => {
              handleUpdateNode(editingNode.nodeId, newValue);
              setEditingNode(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
