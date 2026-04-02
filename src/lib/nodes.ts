import { NodeType, NodeValue, ApproversValue, ScopeValue, TimeoutValue, AdvanceNoticeValue } from '../types';

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
  if (op === 'manager') return 'Manager';
  if (op === 'managers manager') return "Manager's Manager";
  if (op.startsWith('role:')) return op.slice(5);
  if (op.startsWith('person:')) return op.slice(7);
  return op;
}

export function displayScopeValue(v: ScopeValue): string {
  if (v.attribute === 'all') return 'all employees';
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

export function displayNodeValue(type: NodeType, value: NodeValue): string {
  if (type === 'scope') {
    return displayScopeValue(value as ScopeValue);
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
  return '';
}

export const NODE_LIBRARY_DESCRIPTION = `
AVAILABLE NODE TYPES (you may ONLY use these):

1. "scope" — Defines who this workflow applies to. Always the first node.
   value shape: { attribute: "all" | "location_country" | "location_state" | "department" | "division" | "employment_status" | "team", value: string }
   For "all": value is "". For others: value is the specific group name.

2. "approvers" — Defines who approves or receives a request.
   value shape: { operator: "AND" | "OR", operands: string[] }
   Operand values: "manager", "managers manager", "role:CEO", "role:HR Manager", "person:Jane Smith", etc.
   For sequential approvals, use multiple approver nodes in the template with ", then " between them.

3. "timeout" — A duration before the next step triggers (e.g. escalation).
   value shape: { amount: number, unit: "hours" | "days" | "weeks" }

4. "advance_notice" — A time threshold for a conditional branch.
   value shape: { amount: number, unit: "hours" | "days", comparison: "less_than" | "greater_than" }
`;
