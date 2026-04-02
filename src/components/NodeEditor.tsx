import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { WorkflowNode, ApproversValue, TimeoutValue, AdvanceNoticeValue, ScopeValue, ScopeAttribute } from '../types';
import { motion } from 'motion/react';
import { X, Plus, ChevronDown } from 'lucide-react';
import { APPROVAL_ROLES, formatOperand, SCOPE_OPTIONS } from '../lib/nodes';

interface NodeEditorProps {
  node: WorkflowNode;
  onClose: () => void;
  onSave: (newValue: any) => void;
  anchorRect: DOMRect;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onClose, onSave, anchorRect }) => {
  const [value, setValue] = useState<any>(structuredClone(node.value));

  const handleSave = () => onSave(value);

  const panel = (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', top: anchorRect.bottom + 8, left: anchorRect.left, zIndex: 9999 }}
      className="w-72 bg-white border border-slate-200 shadow-xl rounded-2xl p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Edit {node.label}
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {node.type === 'scope' && (
        <ScopeEditor value={value as ScopeValue} onChange={setValue} />
      )}
      {node.type === 'approvers' && (
        <ApproversEditor value={value as ApproversValue} onChange={setValue} />
      )}
      {node.type === 'timeout' && (
        <TimeoutEditor value={value as TimeoutValue} onChange={setValue} />
      )}
      {node.type === 'advance_notice' && (
        <AdvanceNoticeEditor value={value as AdvanceNoticeValue} onChange={setValue} />
      )}

      <button
        onClick={handleSave}
        className="mt-4 w-full bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
      >
        Apply Changes
      </button>
    </motion.div>
  );

  return ReactDOM.createPortal(panel, document.body);
};

// ─── Approvers Editor ────────────────────────────────────────────────────────

interface ApproversEditorProps {
  value: ApproversValue;
  onChange: (v: ApproversValue) => void;
}

const ApproversEditor: React.FC<ApproversEditorProps> = ({ value, onChange }) => {
  const updateOperand = (i: number, op: string) => {
    const ops = [...value.operands];
    ops[i] = op;
    onChange({ ...value, operands: ops });
  };

  const removeOperand = (i: number) => {
    onChange({ ...value, operands: value.operands.filter((_, idx) => idx !== i) });
  };

  const addOperand = () => {
    onChange({ ...value, operands: [...value.operands, 'manager'] });
  };

  return (
    <div className="space-y-3">
      <OperandRow
        op={value.operands[0]}
        onChange={(newOp) => updateOperand(0, newOp)}
        onRemove={() => removeOperand(0)}
      />

      {value.operands.length > 1 && (
        <div className="flex p-1 bg-slate-100 rounded-xl">
          {(['AND', 'OR'] as const).map((op) => (
            <button
              key={op}
              onClick={() => onChange({ ...value, operator: op })}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                value.operator === op
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      )}

      {value.operands.slice(1).map((op, i) => (
        <OperandRow
          key={i + 1}
          op={op}
          onChange={(newOp) => updateOperand(i + 1, newOp)}
          onRemove={() => removeOperand(i + 1)}
        />
      ))}

      <button
        onClick={addOperand}
        className="w-full py-2 border border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 text-xs font-medium"
      >
        <Plus size={13} /> Add Person
      </button>
    </div>
  );
};

interface OperandRowProps {
  op: string;
  onChange: (op: string) => void;
  onRemove: () => void;
}

const OperandRow: React.FC<OperandRowProps> = ({ op, onChange, onRemove }) => {
  const isRole = op.startsWith('role:');
  const isPerson = op.startsWith('person:');
  const baseValue = isRole ? 'role' : isPerson ? 'person' : op;
  const detailValue = isRole ? op.slice(5) : isPerson ? op.slice(7) : '';

  return (
    <div className="p-2.5 bg-slate-50 rounded-xl space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={baseValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'role') onChange(`role:${APPROVAL_ROLES[0]}`);
            else if (v === 'person') onChange('person:');
            else onChange(v);
          }}
          className="flex-1 text-xs font-semibold bg-transparent outline-none text-slate-700 cursor-pointer"
        >
          <option value="manager">Manager</option>
          <option value="managers manager">Manager's Manager</option>
          <option value="role">Specific Role</option>
          <option value="person">Specific Person</option>
        </select>
        <button
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {isRole && (
        <select
          value={detailValue}
          onChange={(e) => onChange(`role:${e.target.value}`)}
          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-300"
        >
          {APPROVAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )}

      {isPerson && (
        <input
          type="text"
          placeholder="Full name..."
          value={detailValue}
          onChange={(e) => onChange(`person:${e.target.value}`)}
          className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-300"
        />
      )}
    </div>
  );
};

// ─── Timeout Editor ───────────────────────────────────────────────────────────

interface TimeoutEditorProps {
  value: TimeoutValue;
  onChange: (v: TimeoutValue) => void;
}

const TimeoutEditor: React.FC<TimeoutEditorProps> = ({ value, onChange }) => (
  <div className="flex items-center gap-3">
    <div className="relative flex-1">
      <select
        value={value.amount}
        onChange={(e) => onChange({ ...value, amount: Number(e.target.value) })}
        className="w-full appearance-none text-sm border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
      >
        {[1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30, 48, 72].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
    </div>
    <div className="relative flex-1">
      <select
        value={value.unit}
        onChange={(e) => onChange({ ...value, unit: e.target.value as TimeoutValue['unit'] })}
        className="w-full appearance-none text-sm border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
      >
        <option value="hours">Hours</option>
        <option value="days">Days</option>
        <option value="weeks">Weeks</option>
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
    </div>
  </div>
);

// ─── Advance Notice Editor ────────────────────────────────────────────────────

interface AdvanceNoticeEditorProps {
  value: AdvanceNoticeValue;
  onChange: (v: AdvanceNoticeValue) => void;
}

const AdvanceNoticeEditor: React.FC<AdvanceNoticeEditorProps> = ({ value, onChange }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <select
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: Number(e.target.value) })}
          className="w-full appearance-none text-sm border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
        >
          {[1, 2, 3, 6, 12, 24, 48, 72].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      <div className="relative flex-1">
        <select
          value={value.unit}
          onChange={(e) =>
            onChange({ ...value, unit: e.target.value as AdvanceNoticeValue['unit'] })
          }
          className="w-full appearance-none text-sm border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
        <ChevronDown
          size={13}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
    </div>
    <div className="flex p-1 bg-slate-100 rounded-xl">
      {(['less_than', 'greater_than'] as const).map((comp) => (
        <button
          key={comp}
          onClick={() => onChange({ ...value, comparison: comp })}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
            value.comparison === comp
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {comp === 'less_than' ? 'Less than' : 'More than'}
        </button>
      ))}
    </div>
  </div>
);

// ─── Scope Editor ─────────────────────────────────────────────────────────────

const SCOPE_ATTRIBUTES: { value: ScopeAttribute; label: string }[] = [
  { value: 'all', label: 'All Employees' },
  { value: 'location_country', label: 'Country' },
  { value: 'location_state', label: 'State' },
  { value: 'department', label: 'Department' },
  { value: 'division', label: 'Division' },
  { value: 'employment_status', label: 'Employment Status' },
  { value: 'team', label: 'Team' },
];

interface ScopeEditorProps {
  value: ScopeValue;
  onChange: (v: ScopeValue) => void;
}

const ScopeEditor: React.FC<ScopeEditorProps> = ({ value, onChange }) => {
  const options = value.attribute !== 'all' ? SCOPE_OPTIONS[value.attribute] ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <select
          value={value.attribute}
          onChange={(e) => {
            const attr = e.target.value as ScopeAttribute;
            onChange({ attribute: attr, value: attr === 'all' ? '' : (SCOPE_OPTIONS[attr]?.[0] ?? '') });
          }}
          className="w-full appearance-none text-sm border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
        >
          {SCOPE_ATTRIBUTES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {value.attribute !== 'all' && (
        <div className="relative">
          <select
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            className="w-full appearance-none text-sm border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}
    </div>
  );
};
