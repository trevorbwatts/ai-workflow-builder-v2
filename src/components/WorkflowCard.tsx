import React, { useState, useRef, useEffect } from 'react';
import { Workflow, Message } from '../types';
import { WorkflowSentence } from './WorkflowSentence';
import { processWorkflowEdit } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Pencil, Send, Check, X, Loader2, Bot, User, Trash2 } from 'lucide-react';

interface WorkflowCardProps {
  liveWorkflow: Workflow;
  onUpdateLiveNode: (nodeId: string, newValue: any) => void;
  initiallyEditing?: boolean;
  isNew?: boolean;
  onApply: (workflow: Workflow) => void;
  onDelete?: () => void;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  liveWorkflow,
  onUpdateLiveNode,
  onApply,
  onDelete,
  initiallyEditing = false,
  isNew = false,
}) => {
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  const [draft, setDraft] = useState<Workflow>(liveWorkflow);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleOpenEdit = () => {
    setDraft(JSON.parse(JSON.stringify(liveWorkflow)));
    setMessages([]);
    setInput('');
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleUpdateNodeToDraft = (nodeId: string, newValue: any) => {
    setDraft({
      ...liveWorkflow,
      nodes: {
        ...liveWorkflow.nodes,
        [nodeId]: { ...liveWorkflow.nodes[nodeId], value: newValue },
      },
    });
    setMessages([]);
    setInput('');
    setIsEditing(true);
  };

  const handleDiscard = () => {
    setIsEditing(false);
    setMessages([]);
    setInput('');
  };

  const handleApply = () => {
    onApply(draft);
    setIsEditing(false);
    setMessages([]);
    setInput('');
  };

  const handleUpdateDraftNode = (nodeId: string, newValue: any) => {
    setDraft((prev) => ({
      ...prev,
      nodes: {
        ...prev.nodes,
        [nodeId]: { ...prev.nodes[nodeId], value: newValue },
      },
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);
    try {
      const { updatedWorkflow, explanation } = await processWorkflowEdit(
        draft,
        msg,
        messages
      );
      setDraft(updatedWorkflow);
      setMessages((prev) => [...prev, { role: 'model', content: explanation }]);
    } catch (err) {
      console.error('AI error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: `Error: ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasDraftChanges =
    JSON.stringify(draft) !== JSON.stringify(liveWorkflow);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden max-w-3xl w-full group">
      {/* ── Live Section ─────────────────────────────────────── */}
      {!isNew && (
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Active Workflow
              </h2>
              {isEditing && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live
                </span>
              )}
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleOpenEdit}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all"
                >
                  <Pencil size={12} />
                  Edit Workflow
                </button>
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="p-1.5 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          <WorkflowSentence
            workflow={liveWorkflow}
            readOnly={true}
          />
        </div>
      )}

      {/* ── Draft + AI Section (expandable) ──────────────────── */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            key="draft-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="overflow-hidden"
          >
            <div className={`bg-slate-50/60 ${!isNew ? 'border-t border-slate-200' : ''}`}>
              {/* Draft header */}
              <div className="px-8 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  {isNew ? (
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      New
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Draft
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {isNew ? 'Describe the workflow you want to create' : 'Changes preview here before going live'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={isNew ? onDelete : handleDiscard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <X size={12} /> {isNew ? 'Cancel' : 'Discard'}
                  </button>
                  {!isNew && (
                    <button
                      onClick={handleApply}
                      disabled={!hasDraftChanges}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check size={12} /> Apply Changes
                    </button>
                  )}
                </div>
              </div>

              {/* Draft workflow sentence — hidden for new workflows until AI has responded */}
              {(!isNew || messages.length > 0) && (
                <div className="px-8 pb-5">
                  <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <WorkflowSentence
                      workflow={draft}
                      onUpdateNode={handleUpdateDraftNode}
                    />
                  </div>
                  {isNew && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={handleApply}
                        disabled={!hasDraftChanges}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <Check size={12} /> Create Workflow
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AI chat messages */}
              {messages.length > 0 && (
                <div className="px-8 pb-4 space-y-3 max-h-64 overflow-y-auto">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-2.5 ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user'
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-white border border-slate-200 text-slate-500'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User size={13} />
                        ) : (
                          <Bot size={13} />
                        )}
                      </div>
                      <div
                        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center flex-shrink-0">
                        <Loader2 size={13} className="animate-spin" />
                      </div>
                      <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-sm text-slate-400 italic">
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* AI input */}
              <div className="px-8 pb-6">
                <form onSubmit={handleSend}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Sparkles
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none"
                      />
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isNew ? 'Describe what you want this workflow to do...' : 'Try "Add CEO approval for same-day requests"'}
                        className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
