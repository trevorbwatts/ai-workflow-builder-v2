import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ApprovalWorkflow, WorkflowRule, Message, ValidationIssue, WorkflowNode } from '../types';
import { ChatPanel } from './ChatPanel';
import { Save, Upload, Trash2, Sparkles, Send } from 'lucide-react';
import { BranchingFlowchart } from './BranchingFlowchart';
import { WorkflowSentence } from './WorkflowSentence';
import { NodeEditor } from './NodeEditor';
import { PannableCanvas } from './PannableCanvas';
import { processWorkflowEdit } from '../lib/gemini';
import { validateWorkflow } from '../lib/validation';
import { scopeValueToFilter } from '../lib/nodes';
import { ScopeValue } from '../types';
import { AnimatePresence, motion } from 'motion/react';

const FLOATING_SUGGESTIONS = [
  'Add backup approvers for when manager is out of office...',
  'Add a 3-day timeout with escalation to VP...',
  'Require CEO approval for the Engineering department...',
  'Notify HR when a request is submitted...',
  'Add a separate rule for employees in the UK...',
  'Route parental leave requests directly to HR...',
];

interface WorkflowEditorProps {
  workflow: ApprovalWorkflow;
  onSave: (w: ApprovalWorkflow) => void;
  onPublish: (w: ApprovalWorkflow) => void;
  onBack: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow: initialWorkflow, onSave, onPublish, onBack,
}) => {
  const [workflow, setWorkflow] = useState<ApprovalWorkflow>(initialWorkflow);
  const [isDirty, setIsDirty] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [floatingInput, setFloatingInput] = useState('');

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
    setIsDirty(true);
  }, [runValidation]);

  const handleSendMessage = useCallback(async (msg: string) => {
    const userMsg: Message = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setEditingNode(null);

    try {
      const result = await processWorkflowEdit(workflow, activeRuleId, msg, [...messages, userMsg]);
      setWorkflow(result.updatedWorkflow);
      setIsDirty(true);
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
    // Note: does NOT open the chat panel
  }, [activeRuleId]);

  const handleSuggest = useCallback((prompt: string) => {
    setChatOpen(true);
    handleSendMessage(prompt);
  }, [handleSendMessage]);

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
    setIsDirty(true);
    setActiveRuleId(id);
  }, [activeRule, runValidation]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    if (ruleId === workflow.defaultRuleId) return;
    setWorkflow((prev) => {
      const next = { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) };
      runValidation(next);
      return next;
    });
    setIsDirty(true);
    if (activeRuleId === ruleId) setActiveRuleId(workflow.rules[0]?.id ?? '');
  }, [workflow.defaultRuleId, workflow.rules, activeRuleId, runValidation]);

  const handleDiscard = useCallback(() => {
    setWorkflow(initialWorkflow);
    setIsDirty(false);
    setChatOpen(false);
    setMessages([]);
    setValidationIssues([]);
    setEditingNode(null);
  }, [initialWorkflow]);

  const handleSave = useCallback(() => {
    onSave(workflow);
    setIsDirty(false);
  }, [workflow, onSave]);

  const handlePublish = useCallback(() => {
    onPublish({ ...workflow, status: 'published' as const });
    setIsDirty(false);
  }, [workflow, onPublish]);

  const hasErrors = validationIssues.some((i) => i.severity === 'error');
  const editingNodeData = editingNode && workflow.rules.find((r) => r.id === editingNode.ruleId)?.nodes[editingNode.nodeId];

  // Floating suggestion cycling
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const fadeTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionVisible(false);
      fadeTimeout.current = setTimeout(() => {
        setSuggestionIdx((prev) => (prev + 1) % FLOATING_SUGGESTIONS.length);
        setSuggestionVisible(true);
      }, 300);
    }, 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout.current);
    };
  }, []);

  const handleFloatingSubmit = useCallback(() => {
    const msg = floatingInput.trim();
    if (!msg) return;
    setFloatingInput('');
    setChatOpen(true);
    handleSendMessage(msg);
  }, [floatingInput, handleSendMessage]);

  const statusBadge = isDirty
    ? { label: 'Has Unpublished Changes', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    : { label: 'Published', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex min-h-0">
        {/* Left: Summary + Flowchart */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Summary bar — always editable */}
          <div className="border-b border-slate-200 bg-white px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{workflow.name}</h2>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscard}
                  disabled={!isDirty}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} /> Discard Changes
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save size={12} /> Save &amp; Finish Later
                </button>
                <button
                  onClick={handlePublish}
                  disabled={hasErrors}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload size={12} /> Save &amp; Publish
                </button>
              </div>
            </div>

            {/* Editable sentence — always active */}
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
          </div>

          {/* Canvas area */}
          <div className="flex-1 relative min-h-0 flex flex-col">
            <PannableCanvas workflowId={`${workflow.id}-${activeRuleId}`}>
              <BranchingFlowchart
                rules={workflow.rules}
                activeRuleId={activeRuleId}
                workflowName={workflow.name}
                onNodeClick={handleNodeClick}
                onSuggest={handleSuggest}
                validationIssues={validationIssues}
              />
            </PannableCanvas>

            {/* Floating prompt bar */}
            <AnimatePresence>
              {!chatOpen && (
                <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220, delay: 0.2 }}
                    style={{ pointerEvents: 'auto', width: '100%', maxWidth: 560, padding: '0 16px' }}
                  >
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <Sparkles size={16} className="text-indigo-500 shrink-0" />
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={floatingInput}
                            onChange={(e) => setFloatingInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleFloatingSubmit(); }}
                            className="w-full text-sm outline-none text-slate-700 bg-transparent relative z-10"
                          />
                          {!floatingInput && (
                            <span
                              className="absolute inset-0 flex items-center text-sm text-slate-400 pointer-events-none transition-opacity duration-300"
                              style={{ opacity: suggestionVisible ? 1 : 0 }}
                            >
                              {FLOATING_SUGGESTIONS[suggestionIdx]}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={handleFloatingSubmit}
                          disabled={!floatingInput.trim()}
                          className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Chat Panel — only opens via floating bar */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              key="chat-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="w-[380px] h-full">
                <ChatPanel
                  messages={messages}
                  onSend={handleSendMessage}
                  isLoading={isLoading}
                  validationIssues={validationIssues}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
