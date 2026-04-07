import React from 'react';
import ReactDOM from 'react-dom';
import { Workflow, ScopeValue, TimeOffTypeValue } from '../types';
import { WorkflowSentence } from './WorkflowSentence';
import { displayScopeValue, displayNodeValue } from '../lib/nodes';
import { motion } from 'motion/react';
import { X, AlertTriangle, ArrowRight, CheckCircle2, Wrench, Users, Clock } from 'lucide-react';

interface ScopeSuggestion {
  variantId: string;
  suggestedDisplay: string;
  suggestedAttribute: string;
  suggestedValue: string;
}

export interface CoverageGap {
  kind: 'scope' | 'time_off_type';
  description: string;
}

interface ConflictModalProps {
  suggestions: ScopeSuggestion[];
  coverageGaps: CoverageGap[];
  variants: Workflow[];
  onAcceptSuggestion: (suggestion: ScopeSuggestion) => void;
  onFixCoverageGap: (kind: CoverageGap['kind']) => void;
  onAcceptAll: () => void;
  onClose: () => void;
}

// Renders the workflow sentence with the scope node shown as a strikethrough → new value diff
const DiffSentence: React.FC<{ workflow: Workflow; suggestion: ScopeSuggestion }> = ({ workflow, suggestion }) => {
  const parts = workflow.template.split(/(\{[^{}]+\})/);
  return (
    <div className="workflow-text text-slate-700 leading-relaxed">
      {parts.map((part, i) => {
        if (!part.startsWith('{') || !part.endsWith('}')) {
          return <span key={i}>{part}</span>;
        }
        const nodeId = part.slice(1, -1).trim();
        const node = workflow.nodes[nodeId];
        if (!node) return null;

        if (nodeId === 'scope') {
          const currentDisplay = displayNodeValue(node.type, node.value);
          return (
            <span key={i} className="inline-flex items-center gap-1 flex-wrap">
              <span className="line-through text-slate-400 px-0.5">{currentDisplay}</span>
              <ArrowRight size={11} className="text-slate-400 shrink-0" />
              <span className="font-semibold text-emerald-700 px-0.5">{suggestion.suggestedDisplay}</span>
            </span>
          );
        }

        return (
          <span key={i} className="font-semibold text-indigo-600 px-0.5">
            {displayNodeValue(node.type, node.value)}
          </span>
        );
      })}
    </div>
  );
};

export const ConflictModal: React.FC<ConflictModalProps> = ({
  suggestions,
  coverageGaps,
  variants,
  onAcceptSuggestion,
  onFixCoverageGap,
  onAcceptAll,
  onClose,
}) => {
  const totalIssues = suggestions.length + coverageGaps.length;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/40 z-[9500] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {totalIssues} {totalIssues === 1 ? 'Issue' : 'Issues'} Found
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and resolve the issues below before publishing.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Coverage gap rows */}
          {coverageGaps.map((gap) => {
            const base = variants[0];
            const catchAllPreview: Workflow | null = base ? {
              ...base,
              id: '__preview__',
              status: 'draft',
              nodes: {
                ...base.nodes,
                ...(gap.kind === 'scope' && base.nodes.scope ? {
                  scope: { ...base.nodes.scope, value: { attribute: 'all_other', value: '' } as ScopeValue },
                } : {}),
                ...(gap.kind === 'time_off_type' && base.nodes.time_off_type ? {
                  time_off_type: { ...base.nodes.time_off_type, value: { attribute: 'all_other' } as TimeOffTypeValue },
                } : {}),
              },
            } : null;

            return (
              <div key={gap.kind} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coverage Gap</span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Missing</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      {gap.kind === 'scope'
                        ? <Users size={14} className="text-slate-400 mt-0.5 shrink-0" />
                        : <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      }
                      <p className="text-sm text-slate-600 leading-snug">{gap.description}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50/40">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggested Fix:</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Add a Catch-All</span>
                    </div>
                    <div className="space-y-3">
                      {catchAllPreview && (
                        <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
                          <div className="text-xs leading-relaxed">
                            <WorkflowSentence workflow={catchAllPreview} readOnly hasMultipleVariants />
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => { onFixCoverageGap(gap.kind); onClose(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 size={11} /> Add Catch-All
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Scope conflict rows */}
          {suggestions.map((suggestion) => {
            const variant = variants.find((v) => v.id === suggestion.variantId);
            if (!variant) return null;
            const currentScope = variant.nodes.scope?.value as ScopeValue | undefined;
            const otherVariant = variants.find((v) => v.id !== suggestion.variantId);
            const otherScope = otherVariant?.nodes.scope?.value as ScopeValue | undefined;

            return (
              <div key={suggestion.variantId} className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-amber-200">
                  {/* Left: both conflicting workflows + explanation */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conflicting Workflows</span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Overlap</span>
                    </div>

                    {/* Workflow A */}
                    <div className="rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2.5">
                      <div className="text-xs leading-relaxed">
                        <WorkflowSentence workflow={variant} readOnly hasMultipleVariants />
                      </div>
                    </div>

                    {/* Workflow B */}
                    {otherVariant && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/20 px-3 py-2.5">
                        <div className="text-xs leading-relaxed">
                          <WorkflowSentence workflow={otherVariant} readOnly hasMultipleVariants />
                        </div>
                      </div>
                    )}

                    {/* Plain-text explanation */}
                    <div className="bg-slate-100 rounded-lg px-3 py-2 text-[11px] text-slate-600 leading-snug">
                      <span className="font-semibold">{currentScope ? displayScopeValue(currentScope) : '?'}</span> overlaps with{' '}
                      <span className="font-semibold">{otherScope ? displayScopeValue(otherScope) : 'another workflow'}</span>.
                      {' '}Some employees would be matched by both rules.
                    </div>
                  </div>

                  {/* Right: suggested fix with full diff sentence */}
                  <div className="p-4 bg-emerald-50/40">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggested Fix</span>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
                        <div className="text-xs leading-relaxed">
                          <DiffSentence workflow={variant} suggestion={suggestion} />
                        </div>
                      </div>
                      <button
                        onClick={() => onAcceptSuggestion(suggestion)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 size={11} /> Apply Fix
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          {suggestions.length > 0 && (
            <button
              onClick={onAcceptAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Wrench size={12} /> Apply All Fixes
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
