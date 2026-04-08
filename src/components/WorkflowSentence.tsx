import React, { useState } from 'react';
import { WorkflowNode } from '../types';
import { displayNodeValue } from '../lib/nodes';
import { AnimatePresence } from 'motion/react';
import { NodeEditor } from './NodeEditor';

type EditingState = { id: string; rect: DOMRect } | null;

// Accept either a full Workflow or a minimal { template, nodes, ... } shape (e.g., WorkflowRule)
interface WorkflowLike {
  template: string;
  nodes: Record<string, WorkflowNode>;
  [key: string]: any;
}

interface WorkflowSentenceProps {
  workflow: WorkflowLike;
  onUpdateNode?: (id: string, newValue: any) => void;
  onRemoveNode?: (id: string) => void;
  readOnly?: boolean;
  inline?: boolean;  // renders as <span> instead of <div> for flowing paragraphs
}

export const WorkflowSentence: React.FC<WorkflowSentenceProps> = ({
  workflow,
  onUpdateNode,
  onRemoveNode,
  readOnly = false,
  inline = false,
}) => {
  const [editing, setEditing] = useState<EditingState>(null);

  const parts = workflow.template.split(/(\{[^{}]+\})/);

  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper className="workflow-text text-slate-700 leading-relaxed">
      {parts.map((part, i) => {
        if (!part.startsWith('{') || !part.endsWith('}')) {
          return <span key={i}>{part}</span>;
        }

        const nodeId = part.slice(1, -1).trim();
        const node = workflow.nodes[nodeId];

        if (!node) {
          return (
            <span key={i} className="text-red-400 text-sm">
              [{nodeId}?]
            </span>
          );
        }

        const displayVal = displayNodeValue(node.type, node.value);

        if (readOnly) {
          return (
            <span
              key={i}
              className="font-semibold text-indigo-600 px-0.5"
            >
              {displayVal}
            </span>
          );
        }

        // A node is removable if the template has it as a ", then {nodeId}" sequential step
        const isRemovable = onRemoveNode != null &&
          /,\s*then\s*\{/.test(workflow.template) &&
          new RegExp(`,\\s*then\\s*\\{${nodeId}\\}`).test(workflow.template);

        return (
          <span key={i} className="inline-block">
            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setEditing(editing?.id === nodeId ? null : { id: nodeId, rect });
              }}
              className="variable-underline font-medium text-indigo-700"
            >
              {displayVal}
            </button>
            <AnimatePresence>
              {editing?.id === nodeId && (
                <NodeEditor
                  node={node}
                  anchorRect={editing.rect}
                  onClose={() => setEditing(null)}
                  onSave={(newValue) => {
                    onUpdateNode?.(nodeId, newValue);
                    setEditing(null);
                  }}
                  onRemove={isRemovable ? () => {
                    setEditing(null);
                    onRemoveNode(nodeId);
                  } : undefined}
                />
              )}
            </AnimatePresence>
          </span>
        );
      })}
    </Wrapper>
  );
};
