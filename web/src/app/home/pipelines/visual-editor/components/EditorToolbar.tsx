import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  Map,
  Download,
  Play,
  AlignCenter,
  Trash2,
  Copy,
  Upload,
} from 'lucide-react';

interface EditorToolbarProps {
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onAutoLayout: () => void;
  onToggleGrid: () => void;
  onToggleMinimap: () => void;
  onExportJSON: () => void;
  onImportJSON?: () => void;
  onClearCanvas?: () => void;
  onDuplicateSelected?: () => void;
  onRunPipeline?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isGridVisible: boolean;
  isMinimapVisible: boolean;
  isDirty: boolean;
  nodeCount: number;
  edgeCount: number;
  zoom: number;
  hasSelection: boolean;
}

export default function EditorToolbar({
  onSave,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onAutoLayout,
  onToggleGrid,
  onToggleMinimap,
  onExportJSON,
  onImportJSON,
  onClearCanvas,
  onDuplicateSelected,
  onRunPipeline,
  canUndo,
  canRedo,
  isGridVisible,
  isMinimapVisible,
  isDirty,
  nodeCount,
  edgeCount,
  zoom,
  hasSelection,
}: EditorToolbarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        {/* Left: History + Save */}
        <div className="flex items-center gap-0.5">
          <ToolbarBtn icon={<Undo2 />} tip="撤销 (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
          <ToolbarBtn icon={<Redo2 />} tip="重做 (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} />
          <Sep />
          <ToolbarBtn icon={<Save />} tip="保存 (Ctrl+S)" onClick={onSave} highlight={isDirty} />
          <Sep />
          {onDuplicateSelected && (
            <ToolbarBtn icon={<Copy />} tip="复制选中节点" onClick={onDuplicateSelected} disabled={!hasSelection} />
          )}
          {onClearCanvas && (
            <ToolbarBtn icon={<Trash2 />} tip="清空画布" onClick={onClearCanvas} />
          )}
        </div>

        {/* Center: View */}
        <div className="flex items-center gap-0.5">
          <ToolbarBtn icon={<ZoomOut />} tip="缩小" onClick={onZoomOut} />
          <button
            onClick={onFitView}
            className="px-2 py-1 text-[11px] text-muted-foreground font-mono tabular-nums rounded hover:bg-muted transition-colors min-w-[46px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarBtn icon={<ZoomIn />} tip="放大" onClick={onZoomIn} />
          <Sep />
          <ToolbarBtn icon={<Maximize2 />} tip="适应画布" onClick={onFitView} />
          <ToolbarBtn icon={<AlignCenter />} tip="自动布局 (dagre)" onClick={onAutoLayout} />
          <Sep />
          <ToolbarBtn icon={<Grid3x3 />} tip={isGridVisible ? '隐藏网格' : '显示网格'} onClick={onToggleGrid} active={isGridVisible} />
          <ToolbarBtn icon={<Map />} tip={isMinimapVisible ? '隐藏缩略图' : '显示缩略图'} onClick={onToggleMinimap} active={isMinimapVisible} />
          <Sep />
          <ToolbarBtn icon={<Download />} tip="导出 JSON" onClick={onExportJSON} />
          {onImportJSON && <ToolbarBtn icon={<Upload />} tip="导入 JSON" onClick={onImportJSON} />}
        </div>

        {/* Right: Stats + Run */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
            <span>节点 <b className="text-foreground">{nodeCount}</b></span>
            <span>连线 <b className="text-foreground">{edgeCount}</b></span>
          </div>

          {onRunPipeline && (
            <>
              <Sep />
              <Button size="sm" className="h-7 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={onRunPipeline}>
                <Play className="w-3.5 h-3.5" />
                运行
              </Button>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function Sep() {
  return <Separator orientation="vertical" className="mx-1 h-5" />;
}

function ToolbarBtn({
  icon,
  tip,
  onClick,
  disabled,
  active,
  highlight,
}: {
  icon: React.ReactNode;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`
            p-1.5 rounded-md transition-all duration-150 [&_svg]:w-4 [&_svg]:h-4
            ${disabled
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : active
                ? 'text-primary bg-primary/10'
                : highlight
                  ? 'text-amber-600 bg-amber-500/10 dark:text-amber-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }
          `}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}
