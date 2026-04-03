import { memo, useMemo } from 'react';
import { Handle, Position, useConnection, type NodeProps, type Node } from '@xyflow/react';
import { NODE_COLORS, getNodeDefinition } from '../constants';
import type { PipelineNodeData, PipelineNodeType, PortDefinition } from '../types';
import {
  Play, Square, GitBranch, Zap, Brain, Shield, Send,
  Puzzle, Timer, FileText, Globe, Code, Variable, BookOpen,
  AlertCircle, PowerOff, MessageSquare, ArrowLeftRight,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Play, Square, GitBranch, Zap, Brain, Shield, Send,
  Puzzle, Timer, FileText, Globe, Code, Variable, BookOpen,
  MessageSquare, ArrowLeftRight,
};

type PipelineNode = Node<PipelineNodeData>;

function BaseNode({ id, data, selected, type }: NodeProps<PipelineNode>) {
  const nodeType = (type || data.nodeType) as PipelineNodeType;
  const definition = useMemo(() => getNodeDefinition(nodeType), [nodeType]);
  const colors = NODE_COLORS[nodeType] || NODE_COLORS['start'];
  const connection = useConnection();

  if (!definition) return null;

  const IconComponent = ICON_MAP[definition.icon] || Zap;
  const isConnecting = connection.inProgress;
  const isTarget = isConnecting && connection.fromNode?.id !== id;
  const isSource = isConnecting && connection.fromNode?.id === id;

  const showInput = definition.maxInputs !== 0;
  const showOutput = definition.maxOutputs !== 0;

  // Dynamic input ports
  const inputPorts: PortDefinition[] = data.inputPorts && data.inputPorts.length > 0
    ? data.inputPorts
    : showInput ? [{ id: 'target', label: '' }] : [];

  // Dynamic output ports
  const outputPorts: PortDefinition[] = data.outputPorts && data.outputPorts.length > 0
    ? data.outputPorts
    : nodeType === 'safety'
      ? [{ id: 'output-0', label: '✓ 通过' }, { id: 'output-1', label: '✗ 拦截' }]
      : showOutput ? [{ id: 'source', label: '' }] : [];

  const hasMultiInput = inputPorts.length > 1;
  const hasMultiOutput = outputPorts.length > 1;

  const isDisabled = data.isEnabled === false;
  const isStartEnd = nodeType === 'start' || nodeType === 'end';

  return (
    <div
      className={`group relative transition-all duration-200 ease-out ${isDisabled ? 'opacity-50' : ''}`}
      style={{ filter: isDisabled ? 'grayscale(40%)' : undefined }}
    >
      {/* Selection glow */}
      {selected && (
        <div
          className="absolute -inset-[3px] rounded-2xl pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${colors.hex}40, ${colors.hex}15)`,
            boxShadow: `0 0 20px ${colors.hex}30`,
          }}
        />
      )}

      {/* Drop target glow */}
      {isTarget && (
        <div
          className="absolute -inset-2.5 rounded-2xl pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(circle, ${colors.hex}20, transparent)`,
            boxShadow: `0 0 24px ${colors.hex}40`,
          }}
        />
      )}

      {/* Main card */}
      <div
        className={`
          relative rounded-xl overflow-visible
          ${isStartEnd ? 'min-w-[140px]' : 'min-w-[200px] max-w-[260px]'}
          ${selected
            ? 'shadow-xl'
            : 'shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
          }
          bg-white dark:bg-[#1e1e2e]
          border border-gray-200/80 dark:border-gray-700/60
          transition-shadow duration-200
        `}
        style={{
          borderColor: selected ? colors.hex : undefined,
          borderWidth: selected ? '1.5px' : '1px',
          // Scale condition node height based on max port count
          ...(nodeType === 'condition' ? { minHeight: `${Math.max(80, Math.max(inputPorts.length, outputPorts.length) * 36 + 50)}px` } : {}),
        }}
      >
        {/* Top accent line */}
        <div
          className="h-[3px]"
          style={{ background: `linear-gradient(90deg, ${colors.hex}, ${colors.hex}99)` }}
        />

        <div className="px-3 py-2.5">
          {/* Header row */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: colors.hex + '12' }}
            >
              <IconComponent className="w-[18px] h-[18px]" style={{ color: colors.hex }} strokeWidth={2} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] text-gray-800 dark:text-gray-100 truncate leading-tight">
                {data.label}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate leading-tight mt-[2px]">
                {data.description}
              </div>
            </div>

            {isDisabled && <PowerOff className="w-3 h-3 text-gray-400 shrink-0" />}
          </div>

          {/* Mini preview content */}
          {!isStartEnd && <NodePreview nodeType={nodeType} data={data} colors={colors} />}
        </div>
      </div>

      {/* Error badge */}
      {data.hasError && (
        <div className="absolute -top-2 -right-2 z-10">
          <div
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 shadow-lg"
            title={data.errorMessage || '配置错误'}
          >
            <AlertCircle className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
        </div>
      )}

      {/* --- INPUT HANDLES --- */}
      {inputPorts.length === 1 && (
        <Handle
          type="target"
          position={Position.Left}
          id={inputPorts[0].id}
          className={`
            !border-[2.5px] !rounded-full !border-white dark:!border-[#1e1e2e]
            transition-all duration-200
            ${isTarget ? '!w-5 !h-5' : '!w-3.5 !h-3.5'}
          `}
          style={{
            backgroundColor: isTarget ? '#22c55e' : colors.hex,
            boxShadow: isTarget
              ? '0 0 0 4px rgba(34,197,94,0.2), 0 0 12px rgba(34,197,94,0.3)'
              : `0 0 0 2px ${colors.hex}20`,
          }}
        />
      )}

      {hasMultiInput && (
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-center pointer-events-none">
          {inputPorts.map((port, i) => {
            const spacing = Math.min(32, 100 / inputPorts.length);
            const totalHeight = (inputPorts.length - 1) * spacing;
            const offset = i * spacing - totalHeight / 2;

            return (
              <div
                key={port.id}
                className="absolute pointer-events-auto flex items-center"
                style={{ left: '-7px', top: `calc(50% + ${offset}px)`, transform: 'translateY(-50%)' }}
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={port.id}
                  className={`
                    !relative !transform-none !top-auto !left-auto !w-3 !h-3 !border-[2px] !rounded-full
                    !border-white dark:!border-[#1e1e2e]
                    ${isTarget ? '!w-4 !h-4' : ''}
                  `}
                  style={{
                    backgroundColor: isTarget ? '#22c55e' : colors.hex,
                    boxShadow: `0 0 0 2px ${colors.hex}15`,
                  }}
                />
                {port.label && (
                  <span
                    className="ml-3 text-[9px] font-medium whitespace-nowrap select-none"
                    style={{ color: colors.hex }}
                  >
                    {port.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- OUTPUT HANDLES --- */}
      {outputPorts.length === 1 && (
        <Handle
          type="source"
          position={Position.Right}
          id={outputPorts[0].id}
          className={`
            !w-3.5 !h-3.5 !border-[2.5px] !rounded-full
            !border-white dark:!border-[#1e1e2e] transition-all duration-200
            hover:!w-4 hover:!h-4
            ${isSource ? '!ring-2 !ring-blue-300' : ''}
          `}
          style={{
            backgroundColor: colors.hex,
            boxShadow: `0 0 0 2px ${colors.hex}20`,
          }}
        />
      )}

      {hasMultiOutput && (
        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center pointer-events-none">
          {outputPorts.map((port, i) => {
            const spacing = Math.min(32, 100 / outputPorts.length);
            const totalHeight = (outputPorts.length - 1) * spacing;
            const offset = i * spacing - totalHeight / 2;
            const isDefault = port.id.includes('default') || i === outputPorts.length - 1;

            return (
              <div
                key={port.id}
                className="absolute pointer-events-auto flex items-center"
                style={{ right: '-7px', top: `calc(50% + ${offset}px)`, transform: 'translateY(-50%)' }}
              >
                {port.label && (
                  <span
                    className="mr-3 text-[9px] font-medium whitespace-nowrap select-none"
                    style={{ color: isDefault && nodeType === 'condition' ? '#94a3b8' : colors.hex }}
                  >
                    {port.label}
                  </span>
                )}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.id}
                  className="!relative !transform-none !top-auto !left-auto !w-3 !h-3 !border-[2px] !rounded-full !border-white dark:!border-[#1e1e2e]"
                  style={{
                    backgroundColor: isDefault && nodeType === 'condition' ? '#94a3b8' : colors.hex,
                    boxShadow: `0 0 0 2px ${colors.hex}15`,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ======================== Preview ========================
function NodePreview({ nodeType, data, colors }: { nodeType: PipelineNodeType; data: PipelineNodeData; colors: { hex: string } }) {
  const items: Array<{ icon: string; text: string }> = [];

  switch (nodeType) {
    case 'ai-process':
      if (data.runner) items.push({ icon: '🤖', text: `${data.runner}${data.model ? ` · ${data.model}` : ''}` });
      break;
    case 'trigger':
      if (data.triggerType) items.push({ icon: '⚡', text: data.triggerType === 'message' ? '消息触发' : data.triggerType === 'command' ? '命令触发' : data.triggerType === 'schedule' ? '定时触发' : data.triggerType });
      break;
    case 'condition':
      data.conditions?.slice(0, 2).forEach((c, i) => items.push({ icon: i === 0 ? '🔀' : '', text: `${c.field || '...'} ${c.operator} ${c.value || '...'}` }));
      if ((data.conditions?.length ?? 0) > 2) items.push({ icon: '', text: `+${(data.conditions!.length) - 2} more` });
      break;
    case 'plugin':
      if (data.enableAllPlugins) {
        items.push({ icon: '🧩', text: '所有插件已启用' });
      } else if (data.selectedPlugins && data.selectedPlugins.length > 0) {
        const first = data.selectedPlugins[0];
        items.push({ icon: '🧩', text: `${first.name}${first.author ? ` (${first.author})` : ''}` });
        if (data.selectedPlugins.length > 1) items.push({ icon: '', text: `+${data.selectedPlugins.length - 1} 个插件` });
      } else {
        items.push({ icon: '🧩', text: '未选择插件' });
      }
      break;
    case 'output-node':
      if (data.outputFormat) items.push({ icon: '📤', text: data.outputFormat === 'text' ? '纯文本' : data.outputFormat === 'markdown' ? 'Markdown' : data.outputFormat });
      break;
    case 'safety':
      if (data.moderationLevel) items.push({ icon: '🛡️', text: data.moderationLevel === 'standard' ? '标准审核' : data.moderationLevel === 'strict' ? '严格审核' : '宽松审核' });
      break;
    case 'knowledge-base':
      items.push({ icon: '📚', text: `Top-${data.topK || 5}` });
      break;
    case 'webhook':
      if (data.webhookUrl) items.push({ icon: '🌐', text: data.webhookUrl });
      break;
    case 'code-exec':
      if (data.language) items.push({ icon: '💻', text: data.language });
      break;
    case 'rate-limit':
      items.push({ icon: '⏱', text: '频率限制' });
      break;
    case 'output-device':
      if (data.outputContent) items.push({ icon: '📢', text: data.outputContent.slice(0, 30) + (data.outputContent.length > 30 ? '...' : '') });
      else items.push({ icon: '📢', text: '固定输出' });
      break;
    case 'replacer': {
      const reps = data.replacements || [];
      if (reps.length > 0 && reps[0].find) items.push({ icon: '🔄', text: `${reps[0].find} → ${reps[0].replace}` });
      if (reps.length > 1) items.push({ icon: '', text: `+${reps.length - 1} 条规则` });
      if (reps.length === 0 || !reps[0].find) items.push({ icon: '🔄', text: '关键字替换' });
      break;
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="h-px bg-gray-100 dark:bg-gray-700/50 -mx-3" />
      <div className="pt-1 space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[10px] leading-tight truncate"
            style={{ backgroundColor: colors.hex + '08', color: colors.hex + 'cc' }}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="truncate font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(BaseNode);
