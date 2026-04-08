import { NodeType, NodeValue, ApproversValue, ScopeValue, TimeoutValue, AdvanceNoticeValue, TimeOffTypeValue, StatusConditionValue, NotifyValue, WorkflowFilter, ConditionAttribute } from '../types';

export const APPROVAL_ROLES = [
  'CEO', 'CFO', 'COO',
  'Full Admin',
  'VP of Engineering', 'VP of Sales', 'VP of Marketing', 'VP of HR',
  'Director of Engineering', 'Director of Sales', 'Director of Marketing', 'Director of HR',
  'Engineering Manager', 'Sales Manager', 'Marketing Manager', 'HR Manager', 'Team Lead',
];

export const SCOPE_OPTIONS: Record<string, string[]> = {
  location_country: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'India', 'Singapore'],
  location_state: ['California', 'New York', 'Texas', 'Florida', 'Washington', 'Illinois', 'Massachusetts', 'Colorado'],
  department: ['Engineering', 'Sales', 'Marketing', 'Human Resources', 'Finance', 'Operations', 'Legal', 'Customer Success'],
  division: ['North America', 'EMEA', 'APAC', 'Latin America'],
  employment_status: ['Full-time', 'Part-time', 'Contract', 'Intern', 'Temporary'],
  team: ['Frontend', 'Backend', 'Design', 'Data', 'DevOps', 'Support', 'Mobile'],
};

export function formatOperand(op: string): string {
  if (op === 'manager') return 'their Manager';
  if (op === 'managers manager') return "their Manager's Manager";
  if (op.startsWith('role:')) return `the ${op.slice(5)}`;
  if (op.startsWith('person:')) return op.slice(7);
  return op;
}

// Label variant for use in non-sentence contexts (e.g. flowchart preview nodes)
export function formatOperandLabel(op: string): string {
  if (op === 'manager') return 'Manager';
  if (op === 'managers manager') return "Manager's Manager";
  if (op.startsWith('role:')) return op.slice(5);
  if (op.startsWith('person:')) return op.slice(7);
  return op;
}

export function displayScopeValue(v: ScopeValue): string {
  if (v.attribute === 'all') return 'all employees';
  if (v.attribute === 'all_other') return 'all other employees';
  if (!v.value) return '...';
  switch (v.attribute) {
    case 'location_country':
    case 'location_state':
      return `employees in ${v.value}`;
    case 'department':
      return `the ${v.value} department`;
    case 'division':
      return `the ${v.value} division`;
    case 'employment_status':
      return `${v.value} employees`;
    case 'team':
      return `the ${v.value} team`;
    default:
      return v.value;
  }
}

export function displayTimeOffTypeValue(v: TimeOffTypeValue): string {
  switch (v.attribute) {
    case 'all': return 'all time-off requests';
    case 'all_other': return 'all other time-off requests';
    case 'pto': return 'PTO requests';
    case 'sick_leave': return 'Sick Leave requests';
    case 'bereavement': return 'Bereavement requests';
    case 'parental_leave': return 'Parental Leave requests';
    default: return v.attribute;
  }
}

export function displayStatusConditionValue(v: StatusConditionValue): string {
  const labels: Record<string, string> = {
    out_of_office: 'Out of Office',
    on_leave: 'On Leave',
    terminated: 'Terminated',
  };
  const parts = v.triggers.map((t) => labels[t] ?? t);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} or ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`;
}

export function displayNotifyValue(v: NotifyValue): string {
  if (!v.operands || v.operands.length === 0) return '—';
  const who = v.operands.map(formatOperand).join(' and ');
  const channels = v.channels.map((c) => c === 'email' ? 'Email' : 'Inbox').join(' and ');
  return `${who} via ${channels}`;
}

export function displayNotifyValueLabel(v: NotifyValue): string {
  if (!v.operands || v.operands.length === 0) return '—';
  const who = v.operands.map(formatOperandLabel).join(' and ');
  const channels = v.channels.map((c) => c === 'email' ? 'Email' : 'Inbox').join(' and ');
  return `${who} via ${channels}`;
}

export function displayNodeValue(type: NodeType, value: NodeValue): string {
  if (type === 'scope') {
    return displayScopeValue(value as ScopeValue);
  }
  if (type === 'time_off_type') {
    return displayTimeOffTypeValue(value as TimeOffTypeValue);
  }
  if (type === 'approvers') {
    const v = value as ApproversValue;
    if (!v.operands || v.operands.length === 0) return '—';
    const formatted = v.operands.map(formatOperand);
    const joiner = v.operator === 'AND' ? ' and ' : ' or ';
    return formatted.join(joiner);
  }
  if (type === 'timeout') {
    const v = value as TimeoutValue;
    const unitLabel = v.amount === 1 ? v.unit.replace(/s$/, '') : v.unit;
    return `${v.amount} ${unitLabel}`;
  }
  if (type === 'advance_notice') {
    const v = value as AdvanceNoticeValue;
    const unitLabel = v.amount === 1 ? v.unit.replace(/s$/, '') : v.unit;
    return `${v.amount} ${unitLabel}`;
  }
  if (type === 'status_condition') {
    return displayStatusConditionValue(value as StatusConditionValue);
  }
  if (type === 'notify') {
    return displayNotifyValue(value as NotifyValue);
  }
  return '';
}

// Label variant for non-sentence contexts (e.g. flowchart preview nodes)
export function displayNodeValueLabel(type: NodeType, value: NodeValue): string {
  if (type === 'approvers') {
    const v = value as ApproversValue;
    if (!v.operands || v.operands.length === 0) return '—';
    const formatted = v.operands.map(formatOperandLabel);
    const joiner = v.operator === 'AND' ? ' and ' : ' or ';
    return formatted.join(joiner);
  }
  if (type === 'notify') {
    return displayNotifyValueLabel(value as NotifyValue);
  }
  return displayNodeValue(type, value);
}

// Converts a ScopeValue (from scope node) to a WorkflowFilter for the rule
export function scopeValueToFilter(v: ScopeValue): WorkflowFilter | null {
  if (v.attribute === 'all' || v.attribute === 'all_other' || !v.value) return null;
  const attr = v.attribute as unknown as ConditionAttribute;
  return { logic: 'AND', conditions: [{ attribute: attr, operator: 'is', value: v.value }] };
}

export function displayFilterSummary(filter: WorkflowFilter | null): string {
  if (!filter || filter.conditions.length === 0) return 'All Employees';
  const parts = filter.conditions.map((c) => {
    const label = c.attribute === 'location_country' ? 'Country'
      : c.attribute === 'location_state' ? 'State'
      : c.attribute === 'department' ? 'Department'
      : c.attribute === 'division' ? 'Division'
      : c.attribute === 'employment_status' ? 'Employment Status'
      : c.attribute === 'person' ? 'Person'
      : c.attribute;
    const op = c.operator === 'is' ? 'is' : 'is not';
    return `${label} ${op} ${c.value}`;
  });
  const joiner = filter.logic === 'AND' ? ' and ' : ' or ';
  return parts.join(joiner);
}

export const NODE_LIBRARY_DESCRIPTION = `
AVAILABLE NODE TYPES (you may ONLY use these):

1. "approvers" — Defines who approves or receives a request.
   value shape: { operator: "AND" | "OR", operands: string[] }
   Operand values: "manager", "managers manager", "role:CEO", "role:HR Manager", "person:Jane Smith", etc.
   For sequential approvals, use multiple approver nodes in the template with ", then " between them.

2. "timeout" — A duration before the next step triggers (e.g. escalation).
   value shape: { amount: number, unit: "hours" | "days" | "weeks" }

3. "advance_notice" — A time threshold for a conditional branch.
   value shape: { amount: number, unit: "hours" | "days", comparison: "less_than" | "greater_than" }

4. "time_off_type" — Specifies which types of time-off this rule handles.
   value shape: { attribute: "all" | "pto" | "sick_leave" | "bereavement" | "parental_leave" }

5. "status_condition" — A condition that triggers routing when the approver has a specific status.
   value shape: { triggers: Array<"out_of_office" | "on_leave" | "terminated"> }
   At least one trigger must be present.
   IMPORTANT: Always place the status_condition and its backup approver as a SEPARATE SENTENCE at the END of the template, after the main approval flow. Never embed it inline in the middle of a sentence.
   Correct pattern: "...{main_approvers}. If approver is {status_condition}, forwarded to {backup_approver}."
   Wrong pattern:   "...{main_approvers}, but if approver is {status_condition} it goes to {backup_approver}, then..."

6. "notify" — Sends a notification to someone without requiring action. Attached to an approval step.
   value shape: { operands: string[], channels: Array<"email" | "inbox"> }
   Operand values: same as approvers — "manager", "managers manager", "role:HR Manager", "person:Jane Smith", etc.
   Channels defaults to ["email", "inbox"] (both).
   Place directly after the approver node it's associated with, using "and notify {notify_id}" in the template.
   Example: "...approved by {approvers} and notify {notify_approvers}, then {secondary}."
   The node display renders as: "HR Manager via Email and Inbox"

RULE FILTER SYSTEM:
Each rule has a "filter" that determines which employees it applies to.
A filter is either null (catch-all, applies to all employees) or:
{ logic: "AND" | "OR", conditions: [{ attribute: "department" | "location_country" | "location_state" | "division" | "employment_status" | "person", operator: "is" | "is_not", value: string }] }
SCOPE NODE (required, always first in every rule):
Every rule MUST have a "scope" node as its first node. Template always starts with "For {scope}, ...".
scope value shape: { attribute: "all" | "all_other" | "location_country" | "location_state" | "department" | "division" | "employment_status" | "team", value: string }
For "all" or "all_other": value is "". For others: value is the specific group (e.g., "United Kingdom", "Engineering").
When you create or update a scope node, also update rule.filter to match:
- attribute "all" or "all_other" → filter: null
- attribute "location_country", value "United Kingdom" → filter: { logic: "AND", conditions: [{ attribute: "location_country", operator: "is", value: "United Kingdom" }] }
`;
