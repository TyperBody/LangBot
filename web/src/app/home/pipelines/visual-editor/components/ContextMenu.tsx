import { useCallback, useRef, useState, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { PipelineNodeData } from '../types';
import {
  Copy, Trash2, AlignCenter, Eye, EyeOff, Lock, Unlock,
  Clipboard, Plus, GitBranch, ArrowRight,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  targetNodeId?: string;
  targetEdgeId?: string;
  nodes: Node<PipelineNodeData>[];
  onClose: () => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onToggleEnable: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onSelectAll: () => void;
  onPasteNode?: (x: number, y: number) => void;
}

export default function ContextMenu({
  x,
  y,
  targetNodeId,
  targetEdgeId,
  nodes,
  onClose,
  onDeleteNode,
  onDuplicateNode,
  onToggleEnable,
  onDeleteEdge,
  onAutoLayout,
  onFitView,
  onSelectAll,
  onPasteNode,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newX = x + rect.width > window.innerWidth ? x - rect.width : x;
      const newY = y + rect.height > window.innerHeight ? y - rect.height : y;
      setAdjustedPos({ x: Math.max(0, newX), y: Math.max(0, newY) });
    }
  }, [x, y]);

  const targetNode = targetNodeId ? nodes.find((n) => n.id === targetNodeId) : null;
  const isStart = targetNode?.type === 'start';
  const isEnabled = targetNode?.data.isEnabled !== false;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] bg-popover text-popover-foreground rounded-xl border border-border shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {/* Node context */}
      {targetNodeId && targetNode && (
        <>
          <MenuLabel>{targetNode.data.label}</MenuLabel>
          <MenuItem icon={<Copy />} label="复制节点" shortcut="Ctrl+D" onClick={() => { onDuplicateNode(targetNodeId); onClose(); }} disabled={isStart} />
          <MenuItem
            icon={isEnabled ? <EyeOff /> : <Eye />}
            label={isEnabled ? '禁用节点' : '启用节点'}
            onClick={() => { onToggleEnable(targetNodeId); onClose(); }}
            disabled={isStart}
          />
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} label="删除节点" shortcut="Delete" onClick={() => { onDeleteNode(targetNodeId); onClose(); }} danger disabled={isStart} />
        </>
      )}

      {/* Edge context */}
      {targetEdgeId && !targetNodeId && (
        <>
          <MenuLabel>连线</MenuLabel>
          <MenuItem icon={<Trash2 />} label="删除连线" onClick={() => { onDeleteEdge(targetEdgeId); onClose(); }} danger />
        </>
      )}

      {/* Canvas context (no target) */}
      {!targetNodeId && !targetEdgeId && (
        <>
          <MenuItem icon={<AlignCenter />} label="自动布局" onClick={() => { onAutoLayout(); onClose(); }} />
          <MenuItem icon={<ArrowRight />} label="适应画布" onClick={() => { onFitView(); onClose(); }} />
          <MenuSeparator />
          <MenuItem icon={<GitBranch />} label="全选" shortcut="Ctrl+A" onClick={() => { onSelectAll(); onClose(); }} />
          {onPasteNode && (
            <MenuItem icon={<Clipboard />} label="粘贴节点" shortcut="Ctrl+V" onClick={() => { onPasteNode(x, y); onClose(); }} />
          )}
        </>
      )}
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
      {children}
    </div>
  );
}

function MenuSeparator() {
  return <div className="h-px bg-border my-1 mx-2" />;
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`
        w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors
        ${disabled
          ? 'text-muted-foreground/40 cursor-not-allowed'
          : danger
            ? 'text-destructive hover:bg-destructive/10'
            : 'text-popover-foreground hover:bg-muted'
        }
        [&_svg]:w-3.5 [&_svg]:h-3.5
      `}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-[10px] text-muted-foreground font-mono">{shortcut}</span>
      )}
    </button>
  );
}
