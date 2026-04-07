import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Workflow, Message } from '../types';
import { WorkflowSentence } from './WorkflowSentence';
import { processWorkflowEdit } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Pencil, Send, Check, X, Loader2, Bot, User, Trash2, MoreHorizontal, Copy, Upload } from 'lucide-react';

interface WorkflowCardProps {
  liveWorkflow: Workflow;
  onUpdateLiveNode: (nodeId: string, newValue: any) => void;
  onSave: (workflow: Workflow) => void;
  onPublish: (variantId: string) => void;
  onDiscardDraft: (variantId: string) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onPreview?: (workflow: Workflow) => void;
  groupName: string;
  initiallyEditing?: boolean;
  hasConflicts?: boolean;
  hasMultipleVariants?: boolean;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  liveWorkflow,
  onUpdateLiveNode,
  onSave,
  onPublish,
  onDiscardDraft,
  onDelete,
  onDuplicate,
  onPreview,
  groupName,
  initiallyEditing = false,
  hasConflicts = false,
  hasMultipleVariants = false,
}) => {
  const isDraft = liveWorkflow.status === 'draft';
  const pendingWorkflow: Workflow | null = liveWorkflow.pendingDraft
    ? { ...liveWorkflow, ...liveWorkflow.pendingDraft }
    : null;
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  // When editing a published workflow that has a pending draft, start from the pending draft
  const [draft, setDraft] = useState<Workflow>(() =>
    pendingWorkflow ?? liveWorkflow
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-open preview whenever draft changes while editing/in draft mode
  useEffect(() => {
    if (isEditing || isDraft) {
      onPreview?.(draft);
    }
  }, [draft, isEditing, isDraft]);

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
    const base = pendingWorkflow ?? liveWorkflow;
    setDraft(JSON.parse(JSON.stringify(base)));
    setMessages([]);
    setInput('');
    setIsEditing(true);
    onPreview?.(base);
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
    onPreview?.(liveWorkflow);
  };

  const handleSave = () => {
    onSave(draft);
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

  const compareBase = pendingWorkflow ?? liveWorkflow;
  const hasDraftChanges = JSON.stringify(draft) !== JSON.stringify(compareBase);
  const saveDisabled = !isDraft && !hasDraftChanges;

  return (
    <div className={`glass-panel rounded-2xl overflow-hidden max-w-3xl w-full transition-all duration-300`}>
      {/* ── Live Section ─────────────────────────────────────── */}
      {!isDraft && <div className="p-8 cursor-pointer hover:bg-slate-50/60 transition-colors" onClick={() => onPreview?.(liveWorkflow)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {liveWorkflow.status === 'published' ? 'Active Workflow' : 'Saved Workflow'}
            </h2>
            {liveWorkflow.status === 'published' && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live
              </span>
            )}
            {liveWorkflow.status === 'saved' && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Unpublished
              </span>
            )}
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2">
              {liveWorkflow.status !== 'published' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPublish(liveWorkflow.id); }}
                  disabled={hasConflicts}
                  title={hasConflicts ? 'Resolve conflicts before publishing' : 'Publish workflow'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload size={12} /> Publish
                </button>
              )}
            <div ref={menuRef} className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
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
            </div>
          )}
        </div>

        <WorkflowSentence
          workflow={liveWorkflow}
          readOnly={true}
          hasMultipleVariants={hasMultipleVariants}
        />
      </div>}


      {/* ── Pending Draft Section ────────────────────────────── */}
      <AnimatePresence>
        {liveWorkflow.status === 'published' && pendingWorkflow && !isEditing && (
          <motion.div
            key="pending-draft"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 bg-slate-50/40">
              <div className="px-8 pt-6 pb-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Saved Workflow</h2>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Unpublished</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { handleOpenEdit(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => onDiscardDraft(liveWorkflow.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 border border-slate-200 bg-white rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <X size={11} /> Discard
                    </button>
                    <button
                      onClick={() => onPublish(liveWorkflow.id)}
                      disabled={hasConflicts}
                      title={hasConflicts ? 'Resolve conflicts before publishing' : 'Publish this workflow'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Upload size={11} /> Publish
                    </button>
                  </div>
                </div>
                <div
                  className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-200 transition-colors"
                  onClick={() => onPreview?.(pendingWorkflow)}
                >
                  <WorkflowSentence
                    workflow={pendingWorkflow}
                    readOnly
                    hasMultipleVariants={hasMultipleVariants}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    Changes preview here before saving
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
                    onClick={handleSave}
                    disabled={saveDisabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check size={12} />
                    Save
                  </button>
                </div>
              </div>

              {/* Draft workflow sentence — clicking restores preview */}
              <div className="px-8 pb-5">
                <div
                  className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-200 transition-colors"
                  onClick={() => onPreview?.(draft)}
                >
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

    </div>
  );
};
