import type { Node, Edge } from '@xyflow/react';

// ======================== Node Types ========================
export type PipelineNodeType =
  | 'start'
  | 'end'
  | 'trigger'
  | 'ai-process'
  | 'condition'
  | 'safety'
  | 'output-node'
  | 'plugin'
  | 'rate-limit'
  | 'text-process'
  | 'knowledge-base'
  | 'webhook'
  | 'code-exec'
  | 'variable-assign'
  | 'output-device'
  | 'replacer';

export type NodeCategory = 'flow-control' | 'processing' | 'extensions' | 'advanced';

// ======================== Node Data ========================
export interface ConditionRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  sourcePort?: string; // 入口端口 id
  targetPort?: string; // 出口端口 id
}

export interface PortDefinition {
  id: string;
  label: string;
}

export interface PipelineNodeData {
  label: string;
  description: string;
  nodeType: PipelineNodeType;
  config: Record<string, unknown>;
  // Dynamic ports
  inputPorts?: PortDefinition[];
  outputPorts?: PortDefinition[];
  // Condition node specific
  conditions?: ConditionRule[];
  // AI process specific
  model?: string;
  runner?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  // Trigger specific
  triggerType?: string;
  messageFilter?: string;
  // Output specific
  outputFormat?: string;
  // Plugin specific
  pluginName?: string;
  pluginAuthor?: string;
  selectedPlugins?: Array<{ author: string; name: string }>;
  // Safety specific
  sensitiveWords?: string[];
  moderationLevel?: string;
  // Knowledge base specific
  knowledgeBaseId?: string;
  topK?: number;
  // Webhook specific
  webhookUrl?: string;
  // Code exec specific
  code?: string;
  language?: string;
  // Variable assign specific
  variables?: Array<{ key: string; value: string }>;
  // Output device specific
  outputContent?: string;
  // Replacer specific
  replacements?: Array<{ find: string; replace: string }>;
  // Status
  isEnabled?: boolean;
  // Validation
  hasError?: boolean;
  errorMessage?: string;
  [key: string]: unknown;
}

// ======================== Node Definition (Registry) ========================
export interface NodeDefinition {
  type: PipelineNodeType;
  category: NodeCategory;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  colorHex: string; // hex color for ReactFlow
  bgColorClass: string;
  borderColorClass: string;
  textColorClass: string;
  maxInputs: number; // 0 = unlimited
  maxOutputs: number; // 0 = unlimited
  defaultConfig: Partial<PipelineNodeData>;
  configSchema: NodeConfigField[];
}

export interface NodeConfigField {
  key: string;
  label: string;
  labelEn: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'switch' | 'slider' | 'condition-list' | 'variable-list' | 'code';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  defaultValue?: unknown;
}

// ======================== Visual Pipeline Data ========================
export interface VisualPipelineData {
  version: string;
  nodes: Node<PipelineNodeData>[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  metadata: {
    createdAt: string;
    updatedAt: string;
    nodeCount: number;
    edgeCount: number;
  };
}

// ======================== Editor State ========================
export interface EditorState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isPanelOpen: boolean;
  isGridVisible: boolean;
  isSnapToGrid: boolean;
  isMinimapVisible: boolean;
  gridSize: number;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
}

// ======================== History ========================
export interface HistoryEntry {
  nodes: Node<PipelineNodeData>[];
  edges: Edge[];
  timestamp: number;
}
