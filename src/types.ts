export interface ApproversValue {
  operator: 'AND' | 'OR';
  operands: string[];
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

export type NodeType = 'approvers' | 'timeout' | 'advance_notice' | 'scope';
export type NodeValue = ApproversValue | TimeoutValue | AdvanceNoticeValue | ScopeValue;

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  value: NodeValue;
}

export interface Workflow {
  id: string;
  name: string;
  template: string;
  nodes: Record<string, WorkflowNode>;
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
