import { useState, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import type { PipelineNodeData, PipelineNodeType, ConditionRule, NodeConfigField } from '../types';
import { getNodeDefinition, NODE_COLORS, CONDITION_OPERATORS } from '../constants';
import type { PipelineConfigTab, PipelineConfigStage } from '@/app/infra/entities/pipeline';
import DynamicFormComponent from '@/app/home/components/dynamic-form/DynamicFormComponent';
import { extractI18nObject } from '@/i18n/I18nProvider';
import { httpClient } from '@/app/infra/http/HttpClient';
import type { Plugin } from '@/app/infra/entities/plugin';
import type { KnowledgeBase } from '@/app/infra/entities/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play, Square, GitBranch, Zap, Brain, Shield, Send,
  Puzzle, Timer, FileText, Globe, Code, Variable, BookOpen,
  X, Plus, Trash2, Copy, ChevronDown, ChevronRight,
  ToggleLeft, MessageSquare, ArrowLeftRight,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Play, Square, GitBranch, Zap, Brain, Shield, Send,
  Puzzle, Timer, FileText, Globe, Code, Variable, BookOpen,
  MessageSquare, ArrowLeftRight,
};

// ======================== Types ========================
export interface ConfigPanelProps {
  node: Node<PipelineNodeData> | null;
  onUpdateNode: (nodeId: string, data: Partial<PipelineNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onClose: () => void;
  /** Server-provided pipeline config metadata (from getGeneralPipelineMetadata) */
  configMetadata?: PipelineConfigTab[];
}

// ======================== Main Component ========================
export default function ConfigPanel({
  node, onUpdateNode, onDeleteNode, onDuplicateNode, onClose,
  configMetadata,
}: ConfigPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['config']));
  // Track which dynamic form stages have been initialized (to suppress initial dirty flag)
  const [initializedStages, setInitializedStages] = useState<Set<string>>(new Set());

  // Reset initialized stages when node changes
  useEffect(() => {
    setInitializedStages(new Set());
  }, [node?.id]);

  if (!node) return null;

  const nodeType = (node.type || node.data.nodeType) as PipelineNodeType;
  const definition = getNodeDefinition(nodeType);
  const colors = NODE_COLORS[nodeType];
  if (!definition) return null;
  const IconComponent = ICON_MAP[definition.icon] || Zap;

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Map nodeType → config metadata tab name
  const nodeTypeToTabName = (nt: PipelineNodeType): string | null => {
    switch (nt) {
      case 'trigger': return 'trigger';
      case 'ai-process': return 'ai';
      case 'safety': return 'safety';
      case 'output-node': return 'output';
      default: return null;
    }
  };

  const tabName = nodeTypeToTabName(nodeType);
  const metadataTab = tabName && configMetadata
    ? configMetadata.find((t) => t.name === tabName)
    : null;

  // Handle DynamicFormComponent emissions — merge stage values into node.data.config
  const handleDynamicFormSubmit = (stageName: string, values: object) => {
    const stageKey = `${node.id}.${stageName}`;
    const isFirstEmission = !initializedStages.has(stageKey);

    const currentConfig = { ...(node.data.config || {}) } as Record<string, unknown>;
    currentConfig[stageName] = values;

    // For AI runner stage, also sync the runner field to node.data.runner
    if (nodeType === 'ai-process' && stageName === 'runner') {
      const runner = (values as Record<string, unknown>).runner as string;
      onUpdateNode(node.id, { config: currentConfig, runner });
    } else {
      onUpdateNode(node.id, { config: currentConfig });
    }

    if (isFirstEmission) {
      setInitializedStages((prev) => new Set(prev).add(stageKey));
    }
  };

  // Handle fallback field changes
  const handleFieldChange = (key: string, value: unknown) => {
    if (key.startsWith('config.')) {
      const path = key.slice(7).split('.');
      const currentConfig = { ...(node.data.config || {}) } as Record<string, unknown>;
      if (path.length === 2) {
        const [stage, field] = path;
        const stageConfig = { ...(currentConfig[stage] as Record<string, unknown> || {}) };
        stageConfig[field] = value;
        currentConfig[stage] = stageConfig;
      } else if (path.length === 1) {
        currentConfig[path[0]] = value;
      }
      onUpdateNode(node.id, { config: currentConfig });
    } else if (key.includes('.')) {
      const [rootKey, subKey] = key.split('.');
      const currentObj = (node.data[rootKey] as Record<string, unknown>) || {};
      onUpdateNode(node.id, { [rootKey]: { ...currentObj, [subKey]: value } });
    } else {
      onUpdateNode(node.id, { [key]: value });
    }
  };

  const getFieldValue = (key: string): unknown => {
    if (key.startsWith('config.')) {
      const path = key.slice(7).split('.');
      let current: unknown = node.data.config;
      for (const p of path) {
        if (current && typeof current === 'object') {
          current = (current as Record<string, unknown>)[p];
        } else {
          return undefined;
        }
      }
      return current;
    }
    if (key.includes('.')) {
      const [rootKey, subKey] = key.split('.');
      return (node.data[rootKey] as Record<string, unknown>)?.[subKey];
    }
    return node.data[key];
  };

  const isEnabled = node.data.isEnabled !== false;
  const isStartEnd = nodeType === 'start' || nodeType === 'end';

  // Determine which stages to render for AI node (runner-dependent)
  const getAIStages = (): PipelineConfigStage[] => {
    if (!metadataTab) return [];
    const runner = (node.data.config?.runner as Record<string, unknown>)?.runner as string
      || node.data.runner
      || 'local-agent';
    return metadataTab.stages.filter((stage) => {
      if (stage.name === 'runner') return true;
      return stage.name === runner;
    });
  };

  // For non-metadata nodes, use fallback hardcoded sections
  const fallbackSections = (!metadataTab) ? buildFallbackSections(nodeType, node.data) : [];

  return (
    <div className="w-[280px] h-full border-l border-border bg-background flex flex-col select-none animate-in slide-in-from-right-2 duration-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
          style={{ backgroundColor: colors.hex + '12' }}
        >
          <IconComponent className="w-3.5 h-3.5" style={{ color: colors.hex }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{definition.label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{nodeType}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-2.5 space-y-1.5">
          {/* Basic Info */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">名称</Label>
              <Input
                className="h-7 text-xs"
                value={node.data.label || ''}
                onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">描述</Label>
              <Input
                className="h-7 text-xs"
                value={node.data.description || ''}
                onChange={(e) => onUpdateNode(node.id, { description: e.target.value })}
                placeholder="节点描述..."
              />
            </div>
            {!isStartEnd && (
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <ToggleLeft className="w-3 h-3 text-muted-foreground" />
                  <Label className="text-[11px]">启用节点</Label>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(v) => onUpdateNode(node.id, { isEnabled: v })}
                />
              </div>
            )}
          </div>

          {/* ========== Dynamic Metadata Sections (from server API) ========== */}
          {metadataTab && metadataTab.stages.length > 0 && (
            <>
              {(nodeType === 'ai-process' ? getAIStages() : metadataTab.stages).map((stage) => (
                <ConfigSection
                  key={stage.name}
                  id={stage.name}
                  title={extractI18nObject(stage.label)}
                  description={stage.description ? extractI18nObject(stage.description) : undefined}
                  expanded={expandedSections.has(stage.name)}
                  onToggle={() => toggleSection(stage.name)}
                  accentColor={colors.hex}
                >
                  <div className="visual-editor-dynamic-form">
                    <DynamicFormComponent
                      itemConfigList={stage.config}
                      initialValues={
                        (node.data.config?.[stage.name] as Record<string, object>) || {}
                      }
                      onSubmit={(values) => handleDynamicFormSubmit(stage.name, values)}
                      isEditing={true}
                    />
                  </div>
                </ConfigSection>
              ))}
            </>
          )}

          {/* ========== Fallback Sections (for non-core nodes without metadata) ========== */}
          {!metadataTab && fallbackSections.map((section) => (
            <ConfigSection
              key={section.id}
              id={section.id}
              title={section.title}
              description={section.description}
              expanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              accentColor={colors.hex}
            >
              <div className="space-y-2">
                {section.fields.map((field) => (
                  <ConfigField
                    key={field.key}
                    field={field}
                    value={getFieldValue(field.key)}
                    onChange={(value) => handleFieldChange(field.key, value)}
                    node={node}
                    onUpdateNode={onUpdateNode}
                  />
                ))}
              </div>
            </ConfigSection>
          ))}

          {/* ========== Plugin Selector ========== */}
          {nodeType === 'plugin' && (
            <ConfigSection
              id="plugin-select"
              title="插件选择"
              expanded={expandedSections.has('plugin-select')}
              onToggle={() => toggleSection('plugin-select')}
              accentColor={colors.hex}
            >
              <PluginSelector
                selectedPlugins={node.data.selectedPlugins || []}
                enableAll={node.data.enableAllPlugins as boolean ?? false}
                onChangePlugins={(list) => onUpdateNode(node.id, { selectedPlugins: list })}
                onToggleEnableAll={(v) => {
                  if (v) {
                    onUpdateNode(node.id, { enableAllPlugins: true, selectedPlugins: [] });
                  } else {
                    onUpdateNode(node.id, { enableAllPlugins: false });
                  }
                }}
              />
            </ConfigSection>
          )}

          {/* ========== Knowledge Base Selector ========== */}
          {nodeType === 'knowledge-base' && (
            <ConfigSection
              id="kb-select"
              title="知识库选择"
              expanded={expandedSections.has('kb-select')}
              onToggle={() => toggleSection('kb-select')}
              accentColor={colors.hex}
            >
              <KnowledgeBaseSelector
                selectedKBId={node.data.knowledgeBaseId as string || ''}
                onSelectKB={(uuid) => onUpdateNode(node.id, { knowledgeBaseId: uuid })}
              />
            </ConfigSection>
          )}

          {/* ========== Condition: Port Config (判断侧 / 影响侧) ========== */}
          {nodeType === 'condition' && (
            <ConfigSection
              id="ports"
              title="端口配置"
              expanded={expandedSections.has('ports')}
              onToggle={() => toggleSection('ports')}
              accentColor={colors.hex}
            >
              <ConditionPortConfig
                judgeCount={node.data.inputPorts?.length || 1}
                effectCount={node.data.outputPorts?.length || 2}
                onChangeJudgeCount={(count) => {
                  const c = Math.max(1, Math.min(8, count));
                  const ports = Array.from({ length: c }, (_, i) => ({
                    id: `in-${i}`,
                    label: `入${i + 1}`,
                  }));
                  onUpdateNode(node.id, { inputPorts: ports });
                }}
                onChangeEffectCount={(count) => {
                  const c = Math.max(2, Math.min(8, count));
                  const ports = Array.from({ length: c }, (_, i) => ({
                    id: `out-${i}`,
                    label: `出${i + 1}`,
                  }));
                  onUpdateNode(node.id, { outputPorts: ports });
                }}
              />
            </ConfigSection>
          )}

          {/* ========== Condition: Rules ========== */}
          {nodeType === 'condition' && (
            <ConfigSection
              id="condition-rules"
              title="条件判断"
              expanded={expandedSections.has('condition-rules')}
              onToggle={() => toggleSection('condition-rules')}
              accentColor={colors.hex}
            >
              <ConditionListEditor
                conditions={node.data.conditions || []}
                onChange={(c) => onUpdateNode(node.id, { conditions: c })}
                inputPorts={node.data.inputPorts || [{ id: 'in-0', label: '入1' }]}
                outputPorts={node.data.outputPorts || [{ id: 'out-0', label: '出1' }, { id: 'out-1', label: '出2' }]}
              />
            </ConfigSection>
          )}

          {/* ========== Output Device Config ========== */}
          {nodeType === 'output-device' && (
            <ConfigSection
              id="output-device-config"
              title="输出内容"
              expanded={expandedSections.has('output-device-config')}
              onToggle={() => toggleSection('output-device-config')}
              accentColor={colors.hex}
            >
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">固定输出内容</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  value={node.data.outputContent || ''}
                  onChange={(e) => onUpdateNode(node.id, { outputContent: e.target.value })}
                  placeholder="输入固定输出的内容..."
                />
                <p className="text-[10px] text-muted-foreground">到达此节点时，忽略输入并输出此内容</p>
              </div>
            </ConfigSection>
          )}

          {/* ========== Replacer Config ========== */}
          {nodeType === 'replacer' && (
            <ConfigSection
              id="replacer-config"
              title="替换规则"
              expanded={expandedSections.has('replacer-config')}
              onToggle={() => toggleSection('replacer-config')}
              accentColor={colors.hex}
            >
              <ReplacerEditor
                replacements={node.data.replacements || []}
                onChange={(reps) => onUpdateNode(node.id, { replacements: reps })}
              />
            </ConfigSection>
          )}

          {/* ========== Port Management (non-condition custom ports) ========== */}
          {!isStartEnd && nodeType !== 'condition' && ((node.data.inputPorts && node.data.inputPorts.length > 1) || (node.data.outputPorts && node.data.outputPorts.length > 0)) && (
            <ConfigSection
              id="ports"
              title="端口管理"
              description="自定义输入/输出端口"
              expanded={expandedSections.has('ports')}
              onToggle={() => toggleSection('ports')}
              accentColor={colors.hex}
            >
              <div className="space-y-3">
                {(node.data.inputPorts && node.data.inputPorts.length > 1) && (
                  <PortManager
                    title="输入端口"
                    ports={node.data.inputPorts || []}
                    onChange={(ports) => onUpdateNode(node.id, { inputPorts: ports })}
                    direction="input"
                  />
                )}
                {(node.data.outputPorts && node.data.outputPorts.length > 0) && (
                  <PortManager
                    title="输出端口"
                    ports={node.data.outputPorts || []}
                    onChange={(ports) => onUpdateNode(node.id, { outputPorts: ports })}
                    direction="output"
                  />
                )}
              </div>
            </ConfigSection>
          )}

          {/* Node Info */}
          <ConfigSection
            id="info"
            title="节点信息"
            expanded={expandedSections.has('info')}
            onToggle={() => toggleSection('info')}
          >
            <div className="space-y-1.5">
              <InfoRow label="类型">
                <Badge variant="secondary" className="text-[10px] h-4 font-mono" style={{ color: colors.hex }}>
                  {nodeType}
                </Badge>
              </InfoRow>
              <InfoRow label="ID">
                <code className="text-[10px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded truncate max-w-[120px] block">
                  {node.id}
                </code>
              </InfoRow>
            </div>
          </ConfigSection>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-2.5 py-2 border-t border-border space-y-1.5 shrink-0">
        {onDuplicateNode && !isStartEnd && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[11px] gap-1"
            onClick={() => onDuplicateNode(node.id)}
          >
            <Copy className="w-3 h-3" />
            复制节点
          </Button>
        )}
        {!isStartEnd && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full h-7 text-[11px] gap-1"
            onClick={() => onDeleteNode(node.id)}
          >
            <Trash2 className="w-3 h-3" />
            删除节点
          </Button>
        )}
      </div>
    </div>
  );
}

// ======================== Collapsible Section ========================
function ConfigSection({
  id,
  title,
  description,
  expanded,
  onToggle,
  accentColor,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  expanded: boolean;
  onToggle: () => void;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-none overflow-hidden gap-0 py-0">
      <button
        className="flex items-center gap-1.5 w-full px-2 py-1 text-left hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-foreground">{title}</span>
          {description && <span className="text-[10px] text-muted-foreground ml-1.5 truncate">{description}</span>}
        </div>
        {accentColor && (
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        )}
      </button>
      {expanded && (
        <CardContent className="px-2 pb-1.5 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// ======================== Fallback sections for non-core node types ========================
interface ConfigSectionDef {
  id: string;
  title: string;
  description?: string;
  fields: NodeConfigField[];
}

function buildFallbackSections(nodeType: PipelineNodeType, data: PipelineNodeData): ConfigSectionDef[] {
  const sections: ConfigSectionDef[] = [];
  const definition = getNodeDefinition(nodeType);

  // For non-core node types (condition, plugin, webhook, etc.), use configSchema from definition
  if (definition && definition.configSchema.length > 0) {
    sections.push({
      id: 'config',
      title: '配置设置',
      fields: definition.configSchema,
    });
  }

  return sections;
}

// ======================== Field Renderer ========================
function ConfigField({
  field,
  value,
  onChange,
  node,
  onUpdateNode,
}: {
  field: NodeConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  node: Node<PipelineNodeData>;
  onUpdateNode: (nodeId: string, data: Partial<PipelineNodeData>) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            {field.label}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Input
            className="h-7 text-xs"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
          <textarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
          <Input
            className="h-7 text-xs"
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={(value as number) ?? field.defaultValue ?? ''}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            {field.label}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Select value={(value as string) || (field.defaultValue as string) || ''} onValueChange={(v) => onChange(v)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="请选择..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'switch':
      return (
        <div className="flex items-center justify-between py-0.5">
          <Label className="text-[11px]">{field.label}</Label>
          <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
        </div>
      );

    case 'slider':
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
            <Badge variant="secondary" className="text-[10px] h-4 font-mono">
              {String(value ?? field.defaultValue ?? 0)}
            </Badge>
          </div>
          <input
            type="range"
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            min={field.min}
            max={field.max}
            step={field.step}
            value={(value as number) ?? (field.defaultValue as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{field.min}</span>
            <span>{field.max}</span>
          </div>
        </div>
      );

    case 'condition-list':
      return (
        <ConditionListEditor
          conditions={node.data.conditions || []}
          onChange={(c) => onUpdateNode(node.id, { conditions: c })}
          inputPorts={node.data.inputPorts || [{ id: 'in-0', label: '入1' }]}
          outputPorts={node.data.outputPorts || [{ id: 'out-0', label: '出1' }, { id: 'out-1', label: '出2' }]}
        />
      );

    case 'variable-list':
      return <VariableListEditor variables={node.data.variables || []} onChange={(v) => onUpdateNode(node.id, { variables: v })} />;

    case 'code':
      return (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-muted/50 px-2 py-1.5 text-[11px] font-mono shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            spellCheck={false}
          />
        </div>
      );

    default:
      return null;
  }
}

// ======================== Conditions ========================
const CONDITION_FIELDS = [
  { label: '消息内容', value: 'message.content' },
  { label: '发送者ID', value: 'sender.id' },
  { label: '发送者名称', value: 'sender.name' },
  { label: '群组ID', value: 'group.id' },
  { label: '平台类型', value: 'platform.type' },
  { label: '消息类型', value: 'message.type' },
  { label: '消息长度', value: 'message.length' },
  { label: '自定义字段', value: '__custom__' },
];

function ConditionListEditor({
  conditions,
  onChange,
  inputPorts,
  outputPorts,
}: {
  conditions: ConditionRule[];
  onChange: (c: ConditionRule[]) => void;
  inputPorts: Array<{ id: string; label: string }>;
  outputPorts: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">条件设置</Label>
      {conditions.map((cond, index) => (
        <Card key={cond.id} className="border-border/60 shadow-none">
          <CardContent className="p-2 space-y-1">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] h-4">条件 {index + 1}</Badge>
              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onChange(conditions.filter((c) => c.id !== cond.id))}>
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
            {/* 入口 / 出口 选择 */}
            <div className="flex items-center gap-1">
              <div className="flex-1 space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">入口</Label>
                <Select value={cond.sourcePort || inputPorts[0]?.id || ''} onValueChange={(v) => onChange(conditions.map((c) => c.id === cond.id ? { ...c, sourcePort: v } : c))}>
                  <SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {inputPorts.map((p) => (<SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground text-[11px] mt-3">→</span>
              <div className="flex-1 space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">出口</Label>
                <Select value={cond.targetPort || outputPorts[0]?.id || ''} onValueChange={(v) => onChange(conditions.map((c) => c.id === cond.id ? { ...c, targetPort: v } : c))}>
                  <SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {outputPorts.map((p) => (<SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* 条件字段 */}
            <Select value={CONDITION_FIELDS.some(f => f.value === cond.field) ? cond.field : '__custom__'} onValueChange={(v) => onChange(conditions.map((c) => c.id === cond.id ? { ...c, field: v === '__custom__' ? '' : v } : c))}>
              <SelectTrigger className="h-6 text-[11px]"><SelectValue placeholder="选择字段..." /></SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
              </SelectContent>
            </Select>
            {(!CONDITION_FIELDS.some(f => f.value === cond.field) || cond.field === '') && (
              <Input className="h-6 text-[11px]" placeholder="自定义字段名" value={cond.field} onChange={(e) => onChange(conditions.map((c) => c.id === cond.id ? { ...c, field: e.target.value } : c))} />
            )}
            <Select value={cond.operator} onValueChange={(v) => onChange(conditions.map((c) => c.id === cond.id ? { ...c, operator: v } : c))}>
              <SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_OPERATORS.map((op) => (<SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input className="h-6 text-[11px]" placeholder="值" value={cond.value} onChange={(e) => onChange(conditions.map((c) => c.id === cond.id ? { ...c, value: e.target.value } : c))} />
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full h-6 text-[11px]" onClick={() => onChange([...conditions, { id: `cond-${Date.now()}`, field: '', operator: 'equals', value: '', sourcePort: inputPorts[0]?.id, targetPort: outputPorts[0]?.id }])}>
        <Plus className="w-3 h-3 mr-1" />添加条件
      </Button>
    </div>
  );
}

// ======================== Variables ========================
function VariableListEditor({ variables, onChange }: { variables: Array<{ key: string; value: string }>; onChange: (v: Array<{ key: string; value: string }>) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">变量列表</Label>
      {variables.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input className="h-6 text-[11px] flex-1" placeholder="变量名" value={v.key} onChange={(e) => onChange(variables.map((vv, ii) => ii === i ? { ...vv, key: e.target.value } : vv))} />
          <span className="text-muted-foreground text-[11px]">=</span>
          <Input className="h-6 text-[11px] flex-1" placeholder="值" value={v.value} onChange={(e) => onChange(variables.map((vv, ii) => ii === i ? { ...vv, value: e.target.value } : vv))} />
          <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => onChange(variables.filter((_, ii) => ii !== i))}>
            <X className="w-2.5 h-2.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full h-6 text-[11px]" onClick={() => onChange([...variables, { key: '', value: '' }])}>
        <Plus className="w-3 h-3 mr-1" />添加变量
      </Button>
    </div>
  );
}

// ======================== Port Manager ========================
function PortManager({
  title,
  ports,
  onChange,
  direction,
}: {
  title: string;
  ports: Array<{ id: string; label: string }>;
  onChange: (ports: Array<{ id: string; label: string }>) => void;
  direction: 'input' | 'output';
}) {
  const prefix = direction === 'input' ? 'in' : 'out';
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{title}</Label>
      {ports.map((port, i) => (
        <div key={port.id} className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] h-4 shrink-0 w-7 justify-center">
            {direction === 'input' ? '入' : '出'}{i + 1}
          </Badge>
          <Input
            className="h-6 text-[11px] flex-1"
            placeholder={`${direction === 'input' ? '输入' : '输出'}端口名`}
            value={port.label}
            onChange={(e) => onChange(ports.map((p, ii) => ii === i ? { ...p, label: e.target.value } : p))}
          />
          {ports.length > 1 && (
            <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => onChange(ports.filter((_, ii) => ii !== i))}>
              <X className="w-2.5 h-2.5" />
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-6 text-[11px]"
        onClick={() => onChange([...ports, { id: `${prefix}-${Date.now()}`, label: '' }])}
      >
        <Plus className="w-3 h-3 mr-1" />添加{direction === 'input' ? '输入' : '输出'}端口
      </Button>
    </div>
  );
}

// ======================== Plugin Selector ========================
function PluginSelector({
  selectedPlugins,
  enableAll,
  onChangePlugins,
  onToggleEnableAll,
}: {
  selectedPlugins: Array<{ author: string; name: string }>;
  enableAll: boolean;
  onChangePlugins: (list: Array<{ author: string; name: string }>) => void;
  onToggleEnableAll: (v: boolean) => void;
}) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    httpClient.getPlugins()
      .then((resp) => setPlugins(resp.plugins))
      .catch((err) => console.warn('Failed to load plugins:', err))
      .finally(() => setLoading(false));
  }, []);

  const getPluginKey = (p: Plugin) => {
    const meta = p.manifest.manifest.metadata;
    return `${meta.author ?? ''}/${meta.name}`;
  };

  const getPluginLabel = (p: Plugin) => {
    const meta = p.manifest.manifest.metadata;
    const label = extractI18nObject(meta.label);
    const author = meta.author ?? '';
    return author ? `${label} (${author})` : label;
  };

  const isSelected = (p: Plugin) => {
    const meta = p.manifest.manifest.metadata;
    return selectedPlugins.some((s) => s.author === (meta.author ?? '') && s.name === meta.name);
  };

  const togglePlugin = (p: Plugin) => {
    const meta = p.manifest.manifest.metadata;
    const author = meta.author ?? '';
    const name = meta.name;
    if (isSelected(p)) {
      onChangePlugins(selectedPlugins.filter((s) => !(s.author === author && s.name === name)));
    } else {
      onChangePlugins([...selectedPlugins, { author, name }]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between py-0.5">
        <Label className="text-[11px]">启用所有插件</Label>
        <Switch checked={enableAll} onCheckedChange={onToggleEnableAll} />
      </div>
      {!enableAll && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            选择插件
            {selectedPlugins.length > 0 && (
              <span className="ml-1 text-foreground">({selectedPlugins.length})</span>
            )}
          </Label>
          {loading ? (
            <div className="text-[10px] text-muted-foreground py-1">加载中...</div>
          ) : plugins.length === 0 ? (
            <div className="text-[10px] text-muted-foreground py-1">暂无插件</div>
          ) : (
            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
              {plugins.map((p) => (
                <button
                  key={getPluginKey(p)}
                  type="button"
                  className={`flex items-center gap-1.5 w-full px-2 py-1 rounded text-left text-[11px] transition-colors ${
                    isSelected(p)
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                  onClick={() => togglePlugin(p)}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    isSelected(p) ? 'bg-primary border-primary' : 'border-input'
                  }`}>
                    {isSelected(p) && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{getPluginLabel(p)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ======================== Knowledge Base Selector ========================
function KnowledgeBaseSelector({
  selectedKBId,
  onSelectKB,
}: {
  selectedKBId: string;
  onSelectKB: (uuid: string) => void;
}) {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    httpClient.getKnowledgeBases()
      .then((resp) => setKbs(resp.bases))
      .catch((err) => console.warn('Failed to load knowledge bases:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">选择知识库</Label>
      {loading ? (
        <div className="text-[10px] text-muted-foreground py-1">加载中...</div>
      ) : kbs.length === 0 ? (
        <div className="text-[10px] text-muted-foreground py-1">暂无知识库</div>
      ) : (
        <Select
          value={selectedKBId}
          onValueChange={(v) => {
            const kb = kbs.find((k) => k.uuid === v);
            if (kb) onSelectKB(kb.uuid!);
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="选择知识库..." />
          </SelectTrigger>
          <SelectContent>
            {kbs.map((kb) => (
              <SelectItem key={kb.uuid} value={kb.uuid!}>
                <span className="truncate">{kb.emoji || '📚'} {kb.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ======================== Condition Port Config ========================
function ConditionPortConfig({
  judgeCount,
  effectCount,
  onChangeJudgeCount,
  onChangeEffectCount,
}: {
  judgeCount: number;
  effectCount: number;
  onChangeJudgeCount: (count: number) => void;
  onChangeEffectCount: (count: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">判断侧（输入端口）</Label>
        <div className="flex items-center gap-2">
          <Input
            className="h-7 text-xs w-16"
            type="number"
            min={1}
            max={8}
            value={judgeCount}
            onChange={(e) => onChangeJudgeCount(Number(e.target.value))}
          />
          <div className="flex flex-wrap gap-1 flex-1">
            {Array.from({ length: judgeCount }, (_, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] h-4">入{i + 1}</Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">影响侧（输出端口）</Label>
        <div className="flex items-center gap-2">
          <Input
            className="h-7 text-xs w-16"
            type="number"
            min={2}
            max={8}
            value={effectCount}
            onChange={(e) => onChangeEffectCount(Number(e.target.value))}
          />
          <div className="flex flex-wrap gap-1 flex-1">
            {Array.from({ length: effectCount }, (_, i) => (
              <Badge key={i} variant="outline" className="text-[9px] h-4">出{i + 1}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================== Replacer Editor ========================
function ReplacerEditor({
  replacements,
  onChange,
}: {
  replacements: Array<{ find: string; replace: string }>;
  onChange: (reps: Array<{ find: string; replace: string }>) => void;
}) {
  return (
    <div className="space-y-1.5">
      {replacements.map((rep, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] h-4">规则 {i + 1}</Badge>
            {replacements.length > 1 && (
              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onChange(replacements.filter((_, ii) => ii !== i))}>
                <X className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Input
              className="h-6 text-[11px] flex-1"
              placeholder="查找关键字"
              value={rep.find}
              onChange={(e) => onChange(replacements.map((r, ii) => ii === i ? { ...r, find: e.target.value } : r))}
            />
            <span className="text-muted-foreground text-[11px]">→</span>
            <Input
              className="h-6 text-[11px] flex-1"
              placeholder="替换为"
              value={rep.replace}
              onChange={(e) => onChange(replacements.map((r, ii) => ii === i ? { ...r, replace: e.target.value } : r))}
            />
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-6 text-[11px]"
        onClick={() => onChange([...replacements, { find: '', replace: '' }])}
      >
        <Plus className="w-3 h-3 mr-1" />添加替换规则
      </Button>
    </div>
  );
}
