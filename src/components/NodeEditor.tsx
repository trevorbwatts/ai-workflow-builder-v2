import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { WorkflowNode, ApproversValue, TimeoutValue, AdvanceNoticeValue, ScopeValue, ScopeAttribute, TimeOffTypeValue, TimeOffTypeAttribute, StatusConditionValue, StatusTrigger } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, ChevronDown, Check } from 'lucide-react';
import { APPROVAL_ROLES, formatOperand, SCOPE_OPTIONS } from '../lib/nodes';
import { EMPLOYEES } from '../lib/employees';

// ─── Custom Select ────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const estimatedHeight = options.length * 36 + 8;
      setDropUp(rect.bottom + estimatedHeight > window.innerHeight - 16);
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 text-sm border border-slate-200 rounded-xl pl-3 pr-2.5 py-2.5 bg-white hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-left"
      >
        <span className="truncate text-slate-700 font-medium">{selected?.label ?? value}</span>
        <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.1 }}
            className={`absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden ${
              dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                  opt.value === value
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt.label}
                {opt.value === value && <Check size={13} className="text-indigo-500 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── NodeEditor ───────────────────────────────────────────────────────────────

interface NodeEditorProps {
  node: WorkflowNode;
  onClose: () => void;
  onSave: (newValue: any) => void;
  anchorRect: DOMRect;
  hasMultipleVariants?: boolean;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onClose, onSave, anchorRect, hasMultipleVariants = false }) => {
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
        <ScopeEditor value={value as ScopeValue} onChange={setValue} hasMultipleVariants={hasMultipleVariants} />
      )}
      {node.type === 'time_off_type' && (
        <TimeOffTypeEditor value={value as TimeOffTypeValue} onChange={setValue} hasMultipleVariants={hasMultipleVariants} />
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
      {node.type === 'status_condition' && (
        <StatusConditionEditor value={value as StatusConditionValue} onChange={setValue} />
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

// ─── Person Autocomplete ──────────────────────────────────────────────────────

interface PersonAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
}

const PersonAutocomplete: React.FC<PersonAutocompleteProps> = ({ value, onChange }) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = query.trim().length > 0
    ? EMPLOYEES.filter((e) => {
        const q = query.toLowerCase();
        return e.name.toLowerCase().split(' ').some((word) => word.startsWith(q));
      }).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Search by name..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(e.target.value); }}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
      />
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
          >
            {results.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => { setQuery(emp.name); onChange(emp.name); setOpen(false); }}
                className="w-full flex flex-col px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-medium text-slate-700">{emp.name}</span>
                <span className="text-[11px] text-slate-400">{emp.title} · {emp.department}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

      {/* Backup Approver */}
      <div className="pt-1 border-t border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Backup Approver</p>
        {value.backup ? (
          <OperandRow
            op={value.backup}
            onChange={(newOp) => onChange({ ...value, backup: newOp })}
            onRemove={() => onChange({ ...value, backup: undefined })}
          />
        ) : (
          <button
            onClick={() => onChange({ ...value, backup: 'manager' })}
            className="w-full py-2 border border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 text-xs font-medium"
          >
            <Plus size={13} /> Add Backup
          </button>
        )}
      </div>
    </div>
  );
};

interface OperandRowProps {
  op: string;
  onChange: (op: string) => void;
  onRemove: () => void;
}

const OPERAND_TYPE_OPTIONS: SelectOption[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'managers manager', label: "Manager's Manager" },
  { value: 'role', label: 'Specific Role' },
  { value: 'person', label: 'Specific Person' },
];

const OperandRow: React.FC<OperandRowProps> = ({ op, onChange, onRemove }) => {
  const isRole = op.startsWith('role:');
  const isPerson = op.startsWith('person:');
  const baseValue = isRole ? 'role' : isPerson ? 'person' : op;
  const detailValue = isRole ? op.slice(5) : isPerson ? op.slice(7) : '';

  return (
    <div className="p-2.5 bg-slate-50 rounded-xl space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <CustomSelect
            value={baseValue}
            onChange={(v) => {
              if (v === 'role') onChange(`role:${APPROVAL_ROLES[0]}`);
              else if (v === 'person') onChange('person:');
              else onChange(v);
            }}
            options={OPERAND_TYPE_OPTIONS}
          />
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-400 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {isRole && (
        <CustomSelect
          value={detailValue}
          onChange={(v) => onChange(`role:${v}`)}
          options={APPROVAL_ROLES.map((r) => ({ value: r, label: r }))}
        />
      )}

      {isPerson && (
        <PersonAutocomplete
          value={detailValue}
          onChange={(name) => onChange(`person:${name}`)}
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

const TIMEOUT_AMOUNTS = [1,2,3,4,5,6,7,10,14,21,30,48,72].map((n) => ({ value: String(n), label: String(n) }));
const TIME_UNITS: SelectOption[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

const TimeoutEditor: React.FC<TimeoutEditorProps> = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <CustomSelect
      value={String(value.amount)}
      onChange={(v) => onChange({ ...value, amount: Number(v) })}
      options={TIMEOUT_AMOUNTS}
      className="flex-1"
    />
    <CustomSelect
      value={value.unit}
      onChange={(v) => onChange({ ...value, unit: v as TimeoutValue['unit'] })}
      options={TIME_UNITS}
      className="flex-1"
    />
  </div>
);

// ─── Advance Notice Editor ────────────────────────────────────────────────────

interface AdvanceNoticeEditorProps {
  value: AdvanceNoticeValue;
  onChange: (v: AdvanceNoticeValue) => void;
}

const ADVANCE_AMOUNTS = [1,2,3,6,12,24,48,72].map((n) => ({ value: String(n), label: String(n) }));
const ADVANCE_UNITS: SelectOption[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

const AdvanceNoticeEditor: React.FC<AdvanceNoticeEditorProps> = ({ value, onChange }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <CustomSelect
        value={String(value.amount)}
        onChange={(v) => onChange({ ...value, amount: Number(v) })}
        options={ADVANCE_AMOUNTS}
        className="flex-1"
      />
      <CustomSelect
        value={value.unit}
        onChange={(v) => onChange({ ...value, unit: v as AdvanceNoticeValue['unit'] })}
        options={ADVANCE_UNITS}
        className="flex-1"
      />
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

const SCOPE_ATTRIBUTES_BASE: SelectOption[] = [
  { value: 'all', label: 'All Employees' },
  { value: 'location_country', label: 'Country' },
  { value: 'location_state', label: 'State' },
  { value: 'department', label: 'Department' },
  { value: 'division', label: 'Division' },
  { value: 'employment_status', label: 'Employment Status' },
  { value: 'team', label: 'Team' },
];

const SCOPE_ATTRIBUTE_ALL_OTHER: SelectOption = { value: 'all_other', label: 'All Other Employees' };

interface ScopeEditorProps {
  value: ScopeValue;
  onChange: (v: ScopeValue) => void;
  hasMultipleVariants?: boolean;
}

const ScopeEditor: React.FC<ScopeEditorProps> = ({ value, onChange, hasMultipleVariants = false }) => {
  const options = value.attribute !== 'all' && value.attribute !== 'all_other' ? SCOPE_OPTIONS[value.attribute] ?? [] : [];

  const scopeAttributeOptions = hasMultipleVariants
    ? [SCOPE_ATTRIBUTES_BASE[0], SCOPE_ATTRIBUTE_ALL_OTHER, ...SCOPE_ATTRIBUTES_BASE.slice(1)]
    : SCOPE_ATTRIBUTES_BASE;

  return (
    <div className="space-y-3">
      <CustomSelect
        value={value.attribute}
        onChange={(attr) => {
          const a = attr as ScopeAttribute;
          onChange({ attribute: a, value: a === 'all' || a === 'all_other' ? '' : (SCOPE_OPTIONS[a]?.[0] ?? '') });
        }}
        options={scopeAttributeOptions}
      />

      {value.attribute !== 'all' && value.attribute !== 'all_other' && (
        <CustomSelect
          value={value.value}
          onChange={(v) => onChange({ ...value, value: v })}
          options={options.map((o) => ({ value: o, label: o }))}
        />
      )}
    </div>
  );
};

// ─── Status Condition Editor ──────────────────────────────────────────────────

const STATUS_TRIGGERS: { value: StatusTrigger; label: string }[] = [
  { value: 'out_of_office', label: 'Out of Office' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
];

interface StatusConditionEditorProps {
  value: StatusConditionValue;
  onChange: (v: StatusConditionValue) => void;
}

const StatusConditionEditor: React.FC<StatusConditionEditorProps> = ({ value, onChange }) => {
  const toggle = (trigger: StatusTrigger) => {
    const current = value.triggers;
    if (current.includes(trigger)) {
      if (current.length === 1) return; // must keep at least one
      onChange({ triggers: current.filter((t) => t !== trigger) });
    } else {
      onChange({ triggers: [...current, trigger] });
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">Forward request when approver is:</p>
      <div className="flex flex-col gap-2">
        {STATUS_TRIGGERS.map(({ value: trigger, label }) => {
          const active = value.triggers.includes(trigger);
          return (
            <button
              key={trigger}
              type="button"
              onClick={() => toggle(trigger)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                active
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {label}
              {active && <Check size={13} className="text-amber-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Time Off Type Editor ─────────────────────────────────────────────────────

const TIME_OFF_TYPE_OPTIONS_BASE: SelectOption[] = [
  { value: 'all', label: 'All Time-Off Requests' },
  { value: 'pto', label: 'PTO' },
  { value: 'sick_leave', label: 'Sick Leave' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'parental_leave', label: 'Parental Leave' },
];

const TIME_OFF_TYPE_ALL_OTHER: SelectOption = { value: 'all_other', label: 'All Other Time-Off Requests' };

interface TimeOffTypeEditorProps {
  value: TimeOffTypeValue;
  onChange: (v: TimeOffTypeValue) => void;
  hasMultipleVariants?: boolean;
}

const TimeOffTypeEditor: React.FC<TimeOffTypeEditorProps> = ({ value, onChange, hasMultipleVariants = false }) => {
  const options = hasMultipleVariants
    ? [TIME_OFF_TYPE_OPTIONS_BASE[0], TIME_OFF_TYPE_ALL_OTHER, ...TIME_OFF_TYPE_OPTIONS_BASE.slice(1)]
    : TIME_OFF_TYPE_OPTIONS_BASE;

  return (
    <CustomSelect
      value={value.attribute}
      onChange={(v) => onChange({ attribute: v as TimeOffTypeAttribute })}
      options={options}
    />
  );
};
