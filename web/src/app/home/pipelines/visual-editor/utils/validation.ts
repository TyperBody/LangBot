import type { Node, Edge } from '@xyflow/react';
import type { PipelineNodeData } from '../types';

export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  type: 'error' | 'warning';
  message: string;
}

export function validatePipeline(
  nodes: Node<PipelineNodeData>[],
  edges: Edge[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  const startNodes = nodes.filter((n) => n.type === 'start');
  const endNodes = nodes.filter((n) => n.type === 'end');

  if (startNodes.length === 0) {
    errors.push({ type: 'error', message: '流水线必须包含一个「开始」节点' });
  }
  if (startNodes.length > 1) {
    startNodes.slice(1).forEach((n) =>
      errors.push({ nodeId: n.id, type: 'warning', message: '建议只保留一个「开始」节点' })
    );
  }
  if (endNodes.length === 0) {
    errors.push({ type: 'error', message: '流水线必须包含一个「结束」节点' });
  }

  // Start: no incoming, must have outgoing
  startNodes.forEach((n) => {
    if (edges.some((e) => e.target === n.id)) {
      errors.push({ nodeId: n.id, type: 'error', message: '「开始」节点不应有输入连线' });
    }
    if (!edges.some((e) => e.source === n.id)) {
      errors.push({ nodeId: n.id, type: 'warning', message: '「开始」节点没有输出连线' });
    }
  });

  // End: no outgoing
  endNodes.forEach((n) => {
    if (edges.some((e) => e.source === n.id)) {
      errors.push({ nodeId: n.id, type: 'error', message: '「结束」节点不应有输出连线' });
    }
  });

  // Disconnected nodes
  nodes.forEach((node) => {
    if (node.type === 'start' || node.type === 'end') return;
    const connected = edges.some((e) => e.source === node.id || e.target === node.id);
    if (!connected) {
      errors.push({ nodeId: node.id, type: 'warning', message: `节点「${node.data.label}」未连接到任何其他节点` });
    }
  });

  // Cycle detection (DFS)
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => adj.get(e.source)?.push(e.target));

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(id: string): boolean {
    visited.add(id);
    inStack.add(id);
    for (const nb of adj.get(id) || []) {
      if (!visited.has(nb)) {
        if (hasCycle(nb)) return true;
      } else if (inStack.has(nb)) {
        return true;
      }
    }
    inStack.delete(id);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      errors.push({ type: 'error', message: '流水线存在循环依赖，请检查连线' });
      break;
    }
  }

  // Required field checks
  nodes.forEach((node) => {
    if (node.type === 'ai-process' && !node.data.runner) {
      errors.push({ nodeId: node.id, type: 'warning', message: 'AI 处理节点未选择运行器' });
    }
    if (node.type === 'webhook' && !node.data.webhookUrl) {
      errors.push({ nodeId: node.id, type: 'warning', message: 'Webhook 节点未配置 URL' });
    }
    if (node.type === 'plugin' && !node.data.pluginName) {
      errors.push({ nodeId: node.id, type: 'warning', message: '插件节点未配置插件名称' });
    }
  });

  return errors;
}

export function isValidConnection(
  sourceType: string,
  targetType: string,
  existingEdges: Edge[],
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return false;
  if (targetType === 'start') return false;
  if (sourceType === 'end') return false;
  if (existingEdges.some((e) => e.source === sourceId && e.target === targetId)) return false;
  return true;
}
