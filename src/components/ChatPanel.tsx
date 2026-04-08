import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Message, ValidationIssue } from '../types';
import { Sparkles, Send, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatPanelProps {
  messages: Message[];
  onSend: (msg: string) => void;
  isLoading: boolean;
  validationIssues: ValidationIssue[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, onSend, isLoading, validationIssues,
}) => {
  const [input, setInput] = useState('');
  const [showIssues, setShowIssues] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput('');
    onSend(msg);
  }, [input, isLoading, onSend]);

  const errors = validationIssues.filter((i) => i.severity === 'error');
  const warnings = validationIssues.filter((i) => i.severity === 'warning');

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
            <Sparkles size={12} className="text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Workflow Assistant</h3>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <Sparkles size={18} className="text-indigo-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">Build your workflow with AI</p>
            <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
              Describe changes in plain English. For example: "Add a 3-day timeout with escalation to VP"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl rounded-bl-sm text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Validation Banner */}
      {validationIssues.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 shrink-0">
          <button
            onClick={() => setShowIssues(!showIssues)}
            className="flex items-center gap-1.5 w-full text-xs font-semibold"
          >
            {errors.length > 0 ? (
              <AlertTriangle size={12} className="text-red-500" />
            ) : (
              <AlertTriangle size={12} className="text-amber-500" />
            )}
            <span className={errors.length > 0 ? 'text-red-600' : 'text-amber-600'}>
              {validationIssues.length} {validationIssues.length === 1 ? 'issue' : 'issues'} found
            </span>
            <span className="flex-1" />
            {showIssues ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronUp size={12} className="text-slate-400" />}
          </button>
          {showIssues && (
            <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
              {validationIssues.map((issue, i) => (
                <div key={i} className={`text-[11px] leading-snug px-2 py-1 rounded-lg ${
                  issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {validationIssues.length === 0 && messages.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-2 bg-emerald-50 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle2 size={12} /> No issues found
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Describe changes to your workflow..."
              rows={3}
              className="w-full resize-none border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15 placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};
