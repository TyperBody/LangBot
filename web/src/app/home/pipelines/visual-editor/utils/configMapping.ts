/**
 * Bidirectional mapping between visual editor nodes and real LangBot pipeline config.
 *
 * Real pipeline config structure:
 * {
 *   trigger: { "group-respond-rules": {...}, "access-control": {...}, ... },
 *   ai:      { runner: { runner: "local-agent" }, "local-agent": {...}, ... },
 *   safety:  { "content-filter": {...}, "rate-limit": {...} },
 *   output:  { "long-text-processing": {...}, "force-delay": {...}, "misc": {...} },
 * }
 *
 * Each visual node maps to a specific section + stage in the real config.
 */

import type { Node, Edge } from '@xyflow/react';
import type { PipelineNodeData, PipelineNodeType } from '../types';

// ======================== Section / Stage Mapping ========================

export interface StageMapping {
  section: 'trigger' | 'ai' | 'safety' | 'output';
  stage: string; // e.g. "group-respond-rules", "local-agent", "content-filter"
}

/**
 * Maps visual node types to their real config section/stage(s).
 * AI nodes are special: the stage depends on the selected runner.
 */
export const NODE_STAGE_MAP: Partial<Record<PipelineNodeType, StageMapping | StageMapping[]>> = {
  'trigger': [
    { section: 'trigger', stage: 'group-respond-rules' },
    { section: 'trigger', stage: 'access-control' },
    { section: 'trigger', stage: 'ignore-rules' },
    { section: 'trigger', stage: 'message-aggregation' },
    { section: 'trigger', stage: 'misc' },
  ],
  'ai-process': { section: 'ai', stage: 'runner' }, // stage depends on runner selection
  'safety': [
    { section: 'safety', stage: 'content-filter' },
    { section: 'safety', stage: 'rate-limit' },
  ],
  'output-node': [
    { section: 'output', stage: 'long-text-processing' },
    { section: 'output', stage: 'force-delay' },
    { section: 'output', stage: 'misc' },
  ],
  'rate-limit': { section: 'safety', stage: 'rate-limit' },
  'text-process': { section: 'output', stage: 'long-text-processing' },
};

// ======================== Config → Nodes ========================

export interface PipelineConfig {
  trigger: Record<string, Record<string, unknown>>;
  ai: Record<string, Record<string, unknown> | unknown>;
  safety: Record<string, Record<string, unknown>>;
  output: Record<string, Record<string, unknown>>;
}

/**
 * Convert a real pipeline config into visual editor nodes + edges.
 * Creates a linear pipeline: start → trigger → ai → safety → output → end
 */
export function configToNodes(config: PipelineConfig): {
  nodes: Node<PipelineNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<PipelineNodeData>[] = [];
  const edges: Edge[] = [];
  let x = 80;
  const y = 200;
  const xGap = 280;

  // Start node
  nodes.push({
    id: 'start-1',
    type: 'start',
    position: { x, y },
    data: {
      label: '开始',
      description: '流水线入口',
      nodeType: 'start',
      config: {},
    },
  });

  // Trigger node
  x += xGap;
  const triggerConfig = config.trigger || {};
  nodes.push({
    id: 'trigger-1',
    type: 'trigger',
    position: { x, y },
    data: {
      label: '触发器',
      description: '消息过滤与响应规则',
      nodeType: 'trigger',
      config: triggerConfig,
      // Promote useful fields for preview
      triggerType: triggerConfig['group-respond-rules']?.at ? 'at-reply' : 'prefix',
    },
  });
  edges.push({ id: 'e-start-trigger', source: 'start-1', target: 'trigger-1', type: 'animated' });

  // AI node
  x += xGap;
  const aiConfig = config.ai || {};
  const runner = (aiConfig.runner as Record<string, unknown>)?.runner as string || 'local-agent';
  const runnerConfig = (aiConfig[runner] as Record<string, unknown>) || {};
  nodes.push({
    id: 'ai-process-1',
    type: 'ai-process',
    position: { x, y },
    data: {
      label: 'AI 处理',
      description: '大模型推理',
      nodeType: 'ai-process',
      config: aiConfig,
      runner,
      model: typeof runnerConfig.model === 'object'
        ? (runnerConfig.model as Record<string, unknown>)?.primary as string || ''
        : runnerConfig.model as string || '',
    },
  });
  edges.push({ id: 'e-trigger-ai', source: 'trigger-1', target: 'ai-process-1', type: 'animated' });

  // Safety node
  x += xGap;
  const safetyConfig = config.safety || {};
  nodes.push({
    id: 'safety-1',
    type: 'safety',
    position: { x, y },
    data: {
      label: '安全审核',
      description: '内容安全过滤',
      nodeType: 'safety',
      config: safetyConfig,
      moderationLevel: (safetyConfig['content-filter'] as Record<string, unknown>)?.scope as string || 'all',
    },
  });
  edges.push({ id: 'e-ai-safety', source: 'ai-process-1', target: 'safety-1', type: 'animated' });

  // Output node
  x += xGap;
  const outputConfig = config.output || {};
  nodes.push({
    id: 'output-1',
    type: 'output-node',
    position: { x, y },
    data: {
      label: '输出',
      description: '响应处理与投递',
      nodeType: 'output-node',
      config: outputConfig,
      outputFormat: (outputConfig['long-text-processing'] as Record<string, unknown>)?.strategy as string || 'none',
    },
  });
  edges.push({ id: 'e-safety-output', source: 'safety-1', target: 'output-1', type: 'animated' });

  // End node
  x += xGap;
  nodes.push({
    id: 'end-1',
    type: 'end',
    position: { x, y },
    data: {
      label: '结束',
      description: '流水线出口',
      nodeType: 'end',
      config: {},
    },
  });
  edges.push({ id: 'e-output-end', source: 'output-1', target: 'end-1', type: 'animated' });

  return { nodes, edges };
}

/**
 * Convert visual editor nodes back into a real pipeline config.
 * Merges config from all relevant nodes into the 4-section structure.
 */
export function nodesToConfig(
  nodes: Node<PipelineNodeData>[],
  baseConfig: PipelineConfig,
): PipelineConfig {
  const config: PipelineConfig = JSON.parse(JSON.stringify(baseConfig));

  for (const node of nodes) {
    const nodeType = node.type as PipelineNodeType;
    if (node.data.isEnabled === false) continue;

    switch (nodeType) {
      case 'trigger':
        if (node.data.config && typeof node.data.config === 'object') {
          Object.assign(config.trigger, node.data.config);
        }
        break;

      case 'ai-process': {
        if (node.data.config && typeof node.data.config === 'object') {
          Object.assign(config.ai, node.data.config);
        }
        // Ensure runner selection is synced
        if (node.data.runner) {
          config.ai.runner = { runner: node.data.runner };
        }
        break;
      }

      case 'safety':
        if (node.data.config && typeof node.data.config === 'object') {
          Object.assign(config.safety, node.data.config);
        }
        break;

      case 'output-node':
        if (node.data.config && typeof node.data.config === 'object') {
          Object.assign(config.output, node.data.config);
        }
        break;

      case 'rate-limit':
        if (node.data.config && typeof node.data.config === 'object') {
          config.safety['rate-limit'] = node.data.config['rate-limit'] as Record<string, unknown> || config.safety['rate-limit'];
        }
        break;

      case 'text-process':
        if (node.data.config && typeof node.data.config === 'object') {
          config.output['long-text-processing'] = node.data.config['long-text-processing'] as Record<string, unknown> || config.output['long-text-processing'];
        }
        break;
    }
  }

  return config;
}

/**
 * Get a human-readable summary of a config stage value for node preview.
 */
export function getConfigSummary(
  section: string,
  stage: string,
  value: Record<string, unknown>,
): string {
  if (!value) return '';

  switch (`${section}.${stage}`) {
    case 'trigger.group-respond-rules': {
      const parts: string[] = [];
      if (value.at) parts.push('@回复');
      if (Array.isArray(value.prefix) && value.prefix.length > 0) parts.push(`前缀: ${(value.prefix as string[]).join(', ')}`);
      return parts.join(' · ') || '默认';
    }
    case 'ai.runner':
      return (value.runner as string) || '';
    case 'safety.content-filter':
      return value.scope === 'all' ? '全部检查' : value.scope === 'income-msg' ? '仅输入' : '仅输出';
    case 'safety.rate-limit':
      return `${value.limitation}次/${value['window-length']}秒`;
    case 'output.long-text-processing':
      return value.strategy === 'none' ? '不处理' : value.strategy === 'forward' ? '转发' : '转图片';
    case 'output.force-delay':
      return value.min === 0 && value.max === 0 ? '无延迟' : `${value.min}-${value.max}秒`;
    default:
      return '';
  }
}
