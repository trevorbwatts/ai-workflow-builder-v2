import { WorkflowNode, TimeoutValue, StatusConditionValue, ApproversValue, NotifyValue } from '../types';
import { displayNodeValueLabel, displayStatusConditionValue, formatOperandLabel } from './nodes';

// ─── Step Types ──────────────────────────────────────────────────────────────

export type StepKind = 'start' | 'notify' | 'fork' | 'condition_fork' | 'end' | 'notify_split';

export interface TimelineStep {
  kind: StepKind;
  actor?: string;
  description?: string;
  forkTimeout?: string;
  forkEscalationActor?: string;
  conditionTriggers?: string;
  conditionBackupActor?: string;
  backup?: string;
  forkChild?: boolean;
  notifyActor?: string;
  notifyChannels?: string[];
  nodeId?: string;          // NEW: which node this step came from (for click-to-edit)
}

export function fmt(v: TimeoutValue): string {
  const u = v.amount === 1 ? v.unit.replace(/s$/, '') : v.unit;
  return `${v.amount} ${u}`;
}

/**
 * Parse a workflow rule (template + nodes) into a linear timeline of steps
 * for rendering in the flowchart.
 */
export function parseWorkflowSteps(
  template: string,
  nodes: Record<string, WorkflowNode>
): TimelineStep[] {
  const ids = (template.match(/\{([^{}]+)\}/g) ?? []).map((p) => p.slice(1, -1).trim());
  const steps: TimelineStep[] = [];
  let hasRequester = false;
  let i = 0;

  while (i < ids.length) {
    const id = ids[i];
    const node = nodes[id];
    if (!node || node.type === 'scope' || node.type === 'time_off_type') { i++; continue; }
    if (node.type === 'notify') { i++; continue; }

    if (node.type === 'approvers' && id === 'requester') {
      hasRequester = true;
      steps.push({ kind: 'start', actor: displayNodeValueLabel(node.type, node.value), description: 'initiates the request', nodeId: id });
      i++; continue;
    }

    if (node.type === 'approvers') {
      let lookAhead = i + 1;
      const peekNode = nodes[ids[lookAhead]];

      // If next node is a notify, emit it as a separate parallel split step
      if (peekNode?.type === 'notify') {
        const nv = peekNode.value as NotifyValue;
        const nActor = nv.operands?.length > 0 ? nv.operands.map(formatOperandLabel).join(' and ') : undefined;
        const nChannels = nv.channels?.map((c) => c === 'email' ? 'Email' : 'Inbox');
        steps.push({
          kind: 'notify_split',
          notifyActor: nActor,
          notifyChannels: nChannels,
          nodeId: ids[lookAhead],
        });
        lookAhead++;
      }

      const nextNode = nodes[ids[lookAhead]];
      const backup = (node.value as ApproversValue).backup
        ? formatOperandLabel((node.value as ApproversValue).backup!)
        : undefined;

      if (nextNode?.type === 'status_condition') {
        const bn = nodes[ids[lookAhead + 1]];
        steps.push({
          kind: 'condition_fork',
          actor: displayNodeValueLabel(node.type, node.value),
          conditionTriggers: displayStatusConditionValue(nextNode.value as StatusConditionValue),
          conditionBackupActor: bn ? displayNodeValueLabel(bn.type, bn.value) : undefined,
          backup,
          nodeId: id,
        });
        if (bn) {
          const bnBackup = (bn.value as ApproversValue)?.backup
            ? formatOperandLabel((bn.value as ApproversValue).backup!)
            : undefined;
          steps.push({ kind: 'notify', actor: displayNodeValueLabel(bn.type, bn.value), backup: bnBackup, forkChild: true, nodeId: ids[lookAhead + 1] });
        }
        i = lookAhead + 2; continue;
      }
      if (nextNode?.type === 'timeout') {
        const en = nodes[ids[lookAhead + 1]];
        steps.push({
          kind: 'fork',
          actor: displayNodeValueLabel(node.type, node.value),
          forkTimeout: fmt(nextNode.value as TimeoutValue),
          forkEscalationActor: en ? displayNodeValueLabel(en.type, en.value) : undefined,
          backup,
          nodeId: id,
        });
        if (en) {
          const enBackup = (en.value as ApproversValue)?.backup
            ? formatOperandLabel((en.value as ApproversValue).backup!)
            : undefined;
          steps.push({ kind: 'notify', actor: displayNodeValueLabel(en.type, en.value), backup: enBackup, forkChild: true, nodeId: ids[lookAhead + 1] });
        }
        i = lookAhead + 2; continue;
      }
      steps.push({ kind: 'notify', actor: displayNodeValueLabel(node.type, node.value), backup, notifyActor, notifyChannels, nodeId: id });
      i = lookAhead; continue;
    }
    i++;
  }

  if (!hasRequester) steps.unshift({ kind: 'start', description: 'Employee submits request' });
  const last = steps[steps.length - 1];
  if (last && last.kind !== 'fork' && last.kind !== 'condition_fork') steps.push({ kind: 'end', description: 'Request Approved.' });
  return steps;
}
