export interface ApproversValue {
  operator: 'AND' | 'OR';
  operands: string[];
  backup?: string; // operand string: 'person:Jane Smith', 'role:HR Manager', 'manager', etc.
}

export interface TimeoutValue {
  amount: number;
  unit: 'hours' | 'days' | 'weeks';
}

export interface AdvanceNoticeValue {
  amount: number;
  unit: 'hours' | 'days';
  comparison: 'less_than' | 'greater_than';
}

export type ScopeAttribute =
  | 'all'
  | 'all_other'
  | 'location_country'
  | 'location_state'
  | 'department'
  | 'division'
  | 'employment_status'
  | 'team';

export interface ScopeValue {
  attribute: ScopeAttribute;
  value: string; // empty string when attribute is 'all'
}

export type TimeOffTypeAttribute = 'all' | 'all_other' | 'pto' | 'sick_leave' | 'bereavement' | 'parental_leave';

export interface TimeOffTypeValue {
  attribute: TimeOffTypeAttribute;
}

export type StatusTrigger = 'out_of_office' | 'on_leave' | 'terminated';

export interface StatusConditionValue {
  triggers: StatusTrigger[];
}

export type NodeType = 'approvers' | 'timeout' | 'advance_notice' | 'scope' | 'time_off_type' | 'status_condition';
export type NodeValue = ApproversValue | TimeoutValue | AdvanceNoticeValue | ScopeValue | TimeOffTypeValue | StatusConditionValue;

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  value: NodeValue;
}

export type WorkflowStatus = 'draft' | 'saved' | 'published';

export interface PendingDraft {
  template: string;
  nodes: Record<string, WorkflowNode>;
}

export interface Workflow {
  id: string;
  name: string;
  template: string;
  nodes: Record<string, WorkflowNode>;
  status: WorkflowStatus;
  pendingDraft?: PendingDraft;
}

export interface WorkflowGroup {
  id: string;
  name: string;
  variants: Workflow[];
}

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export type ConditionAttribute =
  | 'location_country'
  | 'location_state'
  | 'department'
  | 'division'
  | 'employment_status'
  | 'person';

export interface WorkflowCondition {
  attribute: ConditionAttribute;
  operator: 'is' | 'is_not';
  value: string;
}

export interface WorkflowFilter {
  logic: 'AND' | 'OR';
  conditions: WorkflowCondition[];
}
