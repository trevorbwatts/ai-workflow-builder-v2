import React from 'react';
import { X, Plus } from 'lucide-react';
import { WorkflowFilter, WorkflowCondition, ConditionAttribute } from '../types';

// ─── Attribute metadata ───────────────────────────────────────────────────────

const ATTRIBUTES: { value: ConditionAttribute; label: string }[] = [
  { value: 'location_country', label: 'Country' },
  { value: 'location_state',   label: 'State' },
  { value: 'department',       label: 'Department' },
  { value: 'division',         label: 'Division' },
  { value: 'employment_status', label: 'Employment Status' },
  { value: 'person',           label: 'Person' },
];

function attrLabel(attr: ConditionAttribute) {
  return ATTRIBUTES.find((a) => a.value === attr)?.label ?? attr;
}

// ─── Display (read-only) ─────────────────────────────────────────────────────

interface RuleFilterDisplayProps {
  filter: WorkflowFilter | null;
}

export const RuleFilterDisplay: React.FC<RuleFilterDisplayProps> = ({ filter }) => {
  if (!filter) {
    return (
      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-wider">
        Default
      </span>
    );
  }

  return (
    <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-600">
      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">If</span>
      {filter.conditions.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              {filter.logic}
            </span>
          )}
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
            {attrLabel(c.attribute)} {c.operator === 'is' ? 'is' : 'is not'}{' '}
            <span className="text-indigo-600">{c.value || '…'}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Editor ──────────────────────────────────────────────────────────────────

interface RuleFilterEditorProps {
  filter: WorkflowFilter | null;
  onChange: (filter: WorkflowFilter) => void;
}

const DEFAULT_CONDITION: WorkflowCondition = {
  attribute: 'department',
  operator: 'is',
  value: '',
};

export const RuleFilterEditor: React.FC<RuleFilterEditorProps> = ({ filter, onChange }) => {
  // If this is the default rule, it can't have conditions
  if (!filter) return null;

  const updateCondition = (i: number, partial: Partial<WorkflowCondition>) => {
    const conditions = filter.conditions.map((c, idx) =>
      idx === i ? { ...c, ...partial } : c
    );
    onChange({ ...filter, conditions });
  };

  const removeCondition = (i: number) => {
    onChange({ ...filter, conditions: filter.conditions.filter((_, idx) => idx !== i) });
  };

  const addCondition = () => {
    onChange({ ...filter, conditions: [...filter.conditions, { ...DEFAULT_CONDITION }] });
  };

  return (
    <div className="space-y-2">
      {filter.conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          {i > 0 && (
            <button
              onClick={() => onChange({ ...filter, logic: filter.logic === 'AND' ? 'OR' : 'AND' })}
              className="text-[10px] font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors uppercase tracking-wider w-10 text-center"
            >
              {filter.logic}
            </button>
          )}
          {i === 0 && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10 text-center">If</span>}

          <select
            value={cond.attribute}
            onChange={(e) => updateCondition(i, { attribute: e.target.value as ConditionAttribute })}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-indigo-300 cursor-pointer"
          >
            {ATTRIBUTES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>

          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, { operator: e.target.value as 'is' | 'is_not' })}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-indigo-300 cursor-pointer"
          >
            <option value="is">is</option>
            <option value="is_not">is not</option>
          </select>

          <input
            type="text"
            value={cond.value}
            onChange={(e) => updateCondition(i, { value: e.target.value })}
            placeholder="value..."
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-indigo-300 flex-1 min-w-24"
          />

          <button
            onClick={() => removeCondition(i)}
            className="p-1 text-slate-300 hover:text-red-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <button
        onClick={addCondition}
        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-indigo-500 transition-colors"
      >
        <Plus size={11} /> Add Condition
      </button>
    </div>
  );
};
