import BaseNode from './BaseNode';
import type { PipelineNodeData } from '../types';
import type { Node, NodeTypes } from '@xyflow/react';

type PipelineNode = Node<PipelineNodeData>;

// All node types use the same BaseNode component,
// which renders differently based on the node type in data.nodeType
export const nodeTypes: NodeTypes = {
  'start': BaseNode,
  'end': BaseNode,
  'trigger': BaseNode,
  'ai-process': BaseNode,
  'condition': BaseNode,
  'safety': BaseNode,
  'output-node': BaseNode,
  'plugin': BaseNode,
  'rate-limit': BaseNode,
  'text-process': BaseNode,
  'knowledge-base': BaseNode,
  'webhook': BaseNode,
  'code-exec': BaseNode,
  'variable-assign': BaseNode,
  'output-device': BaseNode,
  'replacer': BaseNode,
} as unknown as NodeTypes;
