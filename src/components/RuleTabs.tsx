import React from 'react';
import { WorkflowRule } from '../types';
import { displayFilterSummary } from '../lib/nodes';
import { Plus, X } from 'lucide-react';

interface RuleTabsProps {
  rules: WorkflowRule[];
  activeRuleId: string;
  defaultRuleId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export const RuleTabs: React.FC<RuleTabsProps> = ({
  rules, activeRuleId, defaultRuleId, onSelect, onAdd, onDelete,
}) => {
  return (
    <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-slate-200 bg-white overflow-x-auto">
      {rules.map((rule) => {
        const isActive = rule.id === activeRuleId;
        const isDefault = rule.id === defaultRuleId;
        const label = rule.label || displayFilterSummary(rule.filter);

        return (
          <button
            key={rule.id}
            onClick={() => onSelect(rule.id)}
            className={`group relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors shrink-0 ${
              isActive
                ? 'text-indigo-700 bg-indigo-50 border border-b-0 border-slate-200 -mb-px'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="max-w-[140px] truncate">{label}</span>
            {!isDefault && (
              <span
                onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 hover:text-red-600 rounded transition-all"
              >
                <X size={10} />
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-t-lg transition-colors shrink-0"
      >
        <Plus size={12} /> Add Rule
      </button>
    </div>
  );
};
