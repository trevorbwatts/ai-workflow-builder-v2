import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Workflow, Message } from '../types';
import { WorkflowSentence } from './WorkflowSentence';
import { processWorkflowEdit } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Pencil, Send, Check, X, Loader2, Bot, User, Trash2, MoreHorizontal, Copy, Eye } from 'lucide-react';
import { WorkflowPreview } from './WorkflowPreview';

interface WorkflowCardProps {
  liveWorkflow: Workflow;
  onUpdateLiveNode: (nodeId: string, newValue: any) => void;
  onApply: (workflow: Workflow) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  groupName: string;
  initiallyEditing?: boolean;
  isDraft?: boolean;
  isDuplicateDraft?: boolean;
  hasConflict?: boolean;
  hasMultipleVariants?: boolean;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  liveWorkflow,
  onUpdateLiveNode,
  onApply,
  onDelete,
  onDuplicate,
  groupName,
  initiallyEditing = false,
  isDraft = false,
  isDuplicateDraft = false,
  hasConflict = false,
  hasMultipleVariants = false,
}) => {
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  const [draft, setDraft] = useState<Workflow>(liveWorkflow);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inButton = menuRef.current?.contains(e.target as Node);
      const inPortal = menuPortalRef.current?.contains(e.target as Node);
      if (!inButton && !inPortal) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const hasDraftChanges = JSON.stringify(draft) !== JSON.stringify(liveWorkflow);
  const publishDisabled = isDuplicateDraft ? !hasDraftChanges : (!isDraft && !hasDraftChanges);

  return (
    <div className={`glass-panel rounded-2xl overflow-hidden max-w-3xl w-full transition-all duration-300 ${hasConflict ? 'ring-2 ring-amber-400' : ''}`}>
      {/* ── Live Section ─────────────────────────────────────── */}
      {!isDraft && <div className="p-8">
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
            <div ref={menuRef} className="relative">
              <button
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenuRect(rect);
                  setMenuOpen((o) => !o);
                }}
                className="flex items-center px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && menuRect && ReactDOM.createPortal(
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.1 }}
                    ref={menuPortalRef}
                    style={{ position: 'fixed', top: menuRect.bottom + 4, right: window.innerWidth - menuRect.right, zIndex: 9999 }}
                    className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-visible"
                  >
                    <button
                      onClick={() => { handleOpenEdit(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left rounded-t-xl"
                    >
                      <Pencil size={13} className="shrink-0" /> Edit Workflow
                    </button>
                    <button
                      onClick={() => { setShowPreview(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                    >
                      <Eye size={13} className="shrink-0" /> Preview Workflow
                    </button>
                    <button
                      onClick={() => { onDuplicate?.(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                    >
                      <Copy size={13} className="shrink-0" /> Duplicate Workflow
                    </button>
                    <div className="relative group border-t border-slate-100">
                      <button
                        onClick={() => { if (onDelete) { onDelete(); setMenuOpen(false); } }}
                        disabled={!onDelete}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left rounded-b-xl ${
                          onDelete
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 size={13} className="shrink-0" /> Delete Workflow
                      </button>
                      {!onDelete && (
                        <div className="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60]">
                          At least one workflow is required
                          <div className="absolute top-full left-4 -mt-px border-4 border-transparent border-t-slate-800" />
                        </div>
                      )}
                    </div>
                  </motion.div>,
                  document.body
                )}
            </div>
          )}
        </div>

        <WorkflowSentence
          workflow={liveWorkflow}
          readOnly={true}
          hasMultipleVariants={hasMultipleVariants}
        />
      </div>}


      {/* ── Draft + AI Section (expandable) ──────────────────── */}
      <AnimatePresence>
        {(isEditing || isDraft) && (
          <motion.div
            key="draft-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="overflow-hidden"
          >
            <div className={`bg-slate-50/60 ${!isDraft ? 'border-t border-slate-200' : ''}`}>
              {/* Draft header */}
              <div className="px-8 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Draft
                  </span>
                  <span className="text-xs text-slate-400">
                    {isDuplicateDraft
                      ? 'Make at least one change before publishing'
                      : 'Changes preview here before going live'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={isDraft ? onDelete : handleDiscard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <X size={12} /> {isDraft ? 'Cancel' : 'Discard'}
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={publishDisabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check size={12} /> {isDraft ? 'Publish' : 'Apply Changes'}
                  </button>
                </div>
              </div>

              {/* Draft workflow sentence */}
              <div className="px-8 pb-5">
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <WorkflowSentence
                    workflow={draft}
                    onUpdateNode={handleUpdateDraftNode}
                    hasMultipleVariants={hasMultipleVariants}
                  />
                </div>
              </div>

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
                        placeholder="Make edits, add escalation rules, etc."
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

      {showPreview && (
        <WorkflowPreview
          workflow={isEditing || isDraft ? draft : liveWorkflow}
          groupName={groupName}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
