import { useState, useRef, type DragEvent } from 'react';
import { NODE_CATEGORIES, getNodesByCategory, NODE_COLORS } from '../constants';
import type { NodeDefinition } from '../types';
import {
  Play, Square, GitBranch, Zap, Brain, Shield, Send,
  Puzzle, Timer, FileText, Globe, Code, Variable, BookOpen,
  ChevronDown, ChevronRight, Search, Workflow, Layers, Settings,
  GripVertical, PanelLeftClose, PanelLeft, MessageSquare, ArrowLeftRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const ICON_MAP: Record<string, React.ElementType> = {
  Play, Square, GitBranch, Zap, Brain, Shield, Send,
  Puzzle, Timer, FileText, Globe, Code, Variable, BookOpen,
  Workflow, Layers, Settings, MessageSquare, ArrowLeftRight,
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Workflow, Layers, Puzzle, Settings,
};

interface NodePanelProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function NodePanel({ collapsed, onToggleCollapse }: NodePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(NODE_CATEGORIES.map((c) => c.id))
  );
  const [draggingType, setDraggingType] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onDragStart = (event: DragEvent, nodeDef: NodeDefinition) => {
    event.dataTransfer.setData('application/reactflow-type', nodeDef.type);
    event.dataTransfer.setData('application/reactflow-label', nodeDef.label);
    event.dataTransfer.setData('application/reactflow-description', nodeDef.description);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingType(nodeDef.type);

    // Create a custom drag ghost
    const ghost = document.createElement('div');
    ghost.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-lg border text-sm font-medium';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.textContent = nodeDef.label;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const onDragEnd = () => setDraggingType(null);

  const filteredCategories = NODE_CATEGORIES.map((cat) => ({
    ...cat,
    nodes: getNodesByCategory(cat.id).filter((node) =>
      searchQuery === '' ||
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.labelEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.nodes.length > 0);

  if (collapsed) {
    return (
      <div className="w-12 h-full border-r border-border bg-background flex flex-col items-center py-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-muted transition-colors mb-2"
          title="展开面板"
        >
          <PanelLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        {/* Mini icons for quick drag */}
        <div className="space-y-1 mt-2">
          {NODE_CATEGORIES.flatMap((cat) =>
            getNodesByCategory(cat.id).slice(0, 2).map((nodeDef) => {
              const colors = NODE_COLORS[nodeDef.type];
              const Icon = ICON_MAP[nodeDef.icon] || Zap;
              return (
                <div
                  key={nodeDef.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, nodeDef)}
                  onDragEnd={onDragEnd}
                  className="w-8 h-8 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                  style={{ backgroundColor: colors.hex + '12' }}
                  title={nodeDef.label}
                >
                  <Icon className="w-4 h-4" style={{ color: colors.hex }} />
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[260px] h-full border-r border-border bg-background flex flex-col select-none">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">节点面板</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">拖拽节点到画布</p>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="折叠面板"
          >
            <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            className="pl-8 h-8 text-xs bg-muted/50 border-border"
            placeholder="搜索节点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable categories */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3 custom-scrollbar">
        {filteredCategories.map((cat) => {
          const CatIcon = CATEGORY_ICONS[cat.icon] || Layers;
          const isExpanded = expandedCategories.has(cat.id);

          return (
            <div key={cat.id} className="mb-1">
              <button
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-md transition-colors uppercase tracking-wider"
                onClick={() => toggleCategory(cat.id)}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <CatIcon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                <span className="ml-auto text-[10px] font-normal text-muted-foreground/60">
                  {cat.nodes.length}
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-0.5 mt-0.5 ml-1">
                  {cat.nodes.map((nodeDef) => (
                    <NodeItem
                      key={nodeDef.type}
                      nodeDef={nodeDef}
                      isDragging={draggingType === nodeDef.type}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            没有匹配的节点
          </div>
        )}
      </div>
    </div>
  );
}

function NodeItem({
  nodeDef,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  nodeDef: NodeDefinition;
  isDragging: boolean;
  onDragStart: (event: DragEvent, nodeDef: NodeDefinition) => void;
  onDragEnd: () => void;
}) {
  const colors = NODE_COLORS[nodeDef.type];
  const IconComponent = ICON_MAP[nodeDef.icon] || Zap;

  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-[7px] rounded-lg cursor-grab active:cursor-grabbing
        border border-transparent
        hover:border-border
        hover:bg-muted/50
        transition-all duration-150 group
        ${isDragging ? 'opacity-40 scale-95' : ''}
      `}
      draggable
      onDragStart={(e) => onDragStart(e, nodeDef)}
      onDragEnd={onDragEnd}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -ml-0.5" />

      <div
        className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
        style={{ backgroundColor: colors.hex + '12' }}
      >
        <IconComponent className="w-3.5 h-3.5" style={{ color: colors.hex }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate leading-tight">
          {nodeDef.label}
        </div>
        <div className="text-[10px] text-muted-foreground truncate leading-tight mt-[1px]">
          {nodeDef.description}
        </div>
      </div>
    </div>
  );
}
