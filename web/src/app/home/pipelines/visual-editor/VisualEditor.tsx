import { useState, useCallback, useRef, useEffect, useMemo, type DragEvent } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  MarkerType,
  type Connection,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './editor.css';

import { nodeTypes } from './components/nodeTypes';
import { edgeTypes } from './components/edgeTypes';
import NodePanel from './components/NodePanel';
import ConfigPanel from './components/ConfigPanel';
import EditorToolbar from './components/EditorToolbar';
import ContextMenu from './components/ContextMenu';
import { autoLayout } from './utils/autoLayout';
import { validatePipeline, isValidConnection } from './utils/validation';
import { configToNodes, nodesToConfig, type PipelineConfig } from './utils/configMapping';
import {
  DEFAULT_PIPELINE_NODES,
  DEFAULT_PIPELINE_EDGES,
  getNodeDefinition,
  NODE_COLORS,
} from './constants';
import type {
  PipelineNodeData,
  PipelineNodeType,
  VisualPipelineData,
  HistoryEntry,
} from './types';
import type { PipelineConfigTab } from '@/app/infra/entities/pipeline';

import { httpClient } from '@/app/infra/http/HttpClient';
import { toast } from 'sonner';

// ======================== History Hook ========================
function useHistory(maxHistory = 50) {
  const historyRef = useRef<HistoryEntry[]>([]);
  const indexRef = useRef(-1);

  const push = useCallback((nodes: Node<PipelineNodeData>[], edges: Edge[]) => {
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
    });
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    } else {
      indexRef.current++;
    }
  }, [maxHistory]);

  const undo = useCallback((): HistoryEntry | null => {
    if (indexRef.current > 0) { indexRef.current--; return historyRef.current[indexRef.current]; }
    return null;
  }, []);

  const redo = useCallback((): HistoryEntry | null => {
    if (indexRef.current < historyRef.current.length - 1) { indexRef.current++; return historyRef.current[indexRef.current]; }
    return null;
  }, []);

  return {
    push, undo, redo,
    canUndo: () => indexRef.current > 0,
    canRedo: () => indexRef.current < historyRef.current.length - 1,
  };
}

// ======================== Context Menu State ========================
interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
}

// ======================== Inner Editor ========================
function VisualEditorInner({ pipelineId }: { pipelineId?: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, getZoom, getViewport } = useReactFlow();

  // Pipeline data from API
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig | null>(null);
  const [isLoading, setIsLoading] = useState(!!pipelineId);
  const [configMetadata, setConfigMetadata] = useState<PipelineConfigTab[]>([]);

  // Persistent storage for visual layout only
  const storageKey = `visual-pipeline-${pipelineId || 'new'}`;

  const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_PIPELINE_NODES as unknown as Node<PipelineNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_PIPELINE_EDGES as Edge[]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  const [nodePanelCollapsed, setNodePanelCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const history = useHistory();
  const nodeIdCounter = useRef(Date.now());

  // Load pipeline from API
  useEffect(() => {
    // Always fetch config metadata for dynamic form rendering
    httpClient.getGeneralPipelineMetadata()
      .then((resp) => setConfigMetadata(resp.configs))
      .catch((err) => console.warn('Failed to load pipeline metadata:', err));

    if (!pipelineId) {
      setIsLoading(false);
      history.push(DEFAULT_PIPELINE_NODES, DEFAULT_PIPELINE_EDGES);
      return;
    }

    // Try to restore saved visual layout first
    const savedLayout = (() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw) as VisualPipelineData;
      } catch { /* ignore */ }
      return null;
    })();

    httpClient
      .getPipeline(pipelineId)
      .then((resp) => {
        setPipelineName(resp.pipeline.name);
        const config = (resp.pipeline.config || {}) as PipelineConfig;
        setPipelineConfig(config);

        if (savedLayout?.nodes?.length) {
          // Restore saved visual layout, but sync config data from API
          const restoredNodes = savedLayout.nodes.map((n) => {
            const nodeType = n.type as PipelineNodeType;
            // For core nodes, inject latest config from API
            if (nodeType === 'trigger') {
              return { ...n, data: { ...n.data, config: config.trigger || {} } };
            } else if (nodeType === 'ai-process') {
              const runner = ((config.ai?.runner as Record<string, unknown>)?.runner as string) || 'local-agent';
              return { ...n, data: { ...n.data, config: config.ai || {}, runner } };
            } else if (nodeType === 'safety') {
              return { ...n, data: { ...n.data, config: config.safety || {} } };
            } else if (nodeType === 'output-node') {
              return { ...n, data: { ...n.data, config: config.output || {} } };
            }
            return n;
          });
          setNodes(restoredNodes);
          setEdges(savedLayout.edges);
          history.push(restoredNodes, savedLayout.edges);
        } else {
          // First time: generate nodes from config
          const { nodes: generated, edges: generatedEdges } = configToNodes(config);
          setNodes(generated);
          setEdges(generatedEdges);
          history.push(generated, generatedEdges);
          setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
        }
      })
      .catch((err) => {
        console.error('Failed to load pipeline:', err);
        toast.error('加载流水线失败');
        history.push(DEFAULT_PIPELINE_NODES, DEFAULT_PIPELINE_EDGES);
      })
      .finally(() => setIsLoading(false));
  }, [pipelineId]);

  // Zoom tracking
  const handleMoveEnd = useCallback(() => setZoom(getZoom()), [getZoom]);

  // Selected node object
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // Debounced history push
  const pushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushHistory = useCallback(() => {
    if (pushTimeout.current) clearTimeout(pushTimeout.current);
    pushTimeout.current = setTimeout(() => {
      history.push(nodes, edges);
      setCanUndoState(history.canUndo());
      setCanRedoState(history.canRedo());
      setIsDirty(true);
    }, 250);
  }, [nodes, edges, history]);

  // ======================== Selections ========================
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setContextMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  // ======================== Connections ========================
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const src = nodes.find((n) => n.id === params.source);
      const tgt = nodes.find((n) => n.id === params.target);
      if (src && tgt && params.source && params.target) {
        if (!isValidConnection(src.type || '', tgt.type || '', edges, params.source, params.target)) return;
      }

      setEdges((eds) =>
        addEdge({
          ...params,
          type: 'animated',
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
        }, eds)
      );
      pushHistory();
    },
    [nodes, edges, setEdges, pushHistory]
  );

  // ======================== Node/Edge Changes ========================
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      const hasDragEnd = changes.some(
        (c: { type: string; dragging?: boolean }) => c.type === 'position' && 'dragging' in c && !c.dragging
      );
      if (hasDragEnd) pushHistory();
    },
    [onNodesChange, pushHistory]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (changes.some((c: { type: string }) => c.type === 'remove')) pushHistory();
    },
    [onEdgesChange, pushHistory]
  );

  // ======================== Drag & Drop ========================
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const type = event.dataTransfer.getData('application/reactflow-type') as PipelineNodeType;
      if (!type) return;

      const label = event.dataTransfer.getData('application/reactflow-label');
      const description = event.dataTransfer.getData('application/reactflow-description');
      const definition = getNodeDefinition(type);
      if (!definition) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      nodeIdCounter.current++;

      const newNode: Node<PipelineNodeData> = {
        id: `${type}-${nodeIdCounter.current}`,
        type,
        position,
        data: {
          label: label || definition.label,
          description: description || definition.description,
          nodeType: type,
          config: {},
          ...definition.defaultConfig,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNode.id);
      pushHistory();
    },
    [screenToFlowPosition, setNodes, pushHistory]
  );

  // ======================== Node CRUD ========================
  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<PipelineNodeData>) => {
      setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
      pushHistory();
    },
    [setNodes, pushHistory]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node?.type === 'start') { toast.error('无法删除开始节点'); return; }
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      pushHistory();
    },
    [nodes, setNodes, setEdges, selectedNodeId, pushHistory]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type === 'start') return;

      nodeIdCounter.current++;
      const newNode: Node<PipelineNodeData> = {
        ...JSON.parse(JSON.stringify(node)),
        id: `${node.type}-${nodeIdCounter.current}`,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: false,
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNode.id);
      pushHistory();
      toast.success('节点已复制');
    },
    [nodes, setNodes, pushHistory]
  );

  const handleToggleEnable = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, isEnabled: n.data.isEnabled === false ? true : false } } : n)
      );
      pushHistory();
    },
    [setNodes, pushHistory]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      pushHistory();
    },
    [setEdges, pushHistory]
  );

  // ======================== Context Menu ========================
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({ x: (event as React.MouseEvent).clientX, y: (event as React.MouseEvent).clientY });
    },
    []
  );

  // ======================== Toolbar Actions ========================
  const handleSave = useCallback(async () => {
    // 1. Save visual layout to localStorage
    const layoutData: VisualPipelineData = {
      version: '1.0',
      nodes, edges,
      viewport: getViewport(),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
    localStorage.setItem(storageKey, JSON.stringify(layoutData));

    // 2. Validate
    const errors = validatePipeline(nodes, edges);
    const errCount = errors.filter((e) => e.type === 'error').length;
    const warnCount = errors.filter((e) => e.type === 'warning').length;

    const errorNodeIds = new Set(errors.filter((e) => e.nodeId).map((e) => e.nodeId));
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          hasError: errorNodeIds.has(n.id),
          errorMessage: errors.find((e) => e.nodeId === n.id)?.message,
        },
      }))
    );

    // 3. Sync config back to API if we have a pipeline ID
    if (pipelineId && pipelineConfig) {
      try {
        const updatedConfig = nodesToConfig(nodes, pipelineConfig);
        await httpClient.updatePipeline(pipelineId, {
          name: pipelineName,
          description: '',
          config: updatedConfig,
        });
        setPipelineConfig(updatedConfig);
        setIsDirty(false);

        if (errCount > 0) toast.error(`已保存到服务器，有 ${errCount} 个错误需要修复`);
        else if (warnCount > 0) toast.warning(`已保存，有 ${warnCount} 个警告`);
        else toast.success('流水线已保存到服务器');
      } catch (err) {
        console.error('Failed to save pipeline:', err);
        toast.error('保存到服务器失败，仅本地保存');
        setIsDirty(false);
      }
    } else {
      setIsDirty(false);
      if (errCount > 0) toast.error(`本地保存成功，有 ${errCount} 个错误`);
      else toast.success('流水线已本地保存');
    }
  }, [nodes, edges, getViewport, storageKey, pipelineId, pipelineConfig, pipelineName, setNodes]);

  const handleUndo = useCallback(() => {
    const entry = history.undo();
    if (entry) {
      setNodes(entry.nodes);
      setEdges(entry.edges);
      setCanUndoState(history.canUndo());
      setCanRedoState(history.canRedo());
      setIsDirty(true);
    }
  }, [history, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const entry = history.redo();
    if (entry) {
      setNodes(entry.nodes);
      setEdges(entry.edges);
      setCanUndoState(history.canUndo());
      setCanRedoState(history.canRedo());
      setIsDirty(true);
    }
  }, [history, setNodes, setEdges]);

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges, 'LR');
    setNodes(laid);
    pushHistory();
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60);
  }, [nodes, edges, setNodes, fitView, pushHistory]);

  const handleFitView = useCallback(() => fitView({ padding: 0.15, duration: 400 }), [fitView]);
  const handleZoomIn = useCallback(() => zoomIn({ duration: 200 }), [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut({ duration: 200 }), [zoomOut]);

  const handleExportJSON = useCallback(() => {
    const data: VisualPipelineData = {
      version: '1.0',
      nodes, edges,
      viewport: getViewport(),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${pipelineId || 'new'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('流水线已导出');
  }, [nodes, edges, getViewport, pipelineId]);

  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as VisualPipelineData;
          if (data.nodes && data.edges) {
            setNodes(data.nodes);
            setEdges(data.edges);
            pushHistory();
            toast.success('流水线已导入');
            setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
          } else {
            toast.error('无效的流水线文件');
          }
        } catch {
          toast.error('文件解析失败');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, pushHistory, fitView]);

  const handleClearCanvas = useCallback(() => {
    if (!confirm('确定要清空画布吗？将恢复为默认布局。')) return;
    if (pipelineConfig) {
      const { nodes: generated, edges: generatedEdges } = configToNodes(pipelineConfig);
      setNodes(generated);
      setEdges(generatedEdges);
    } else {
      setNodes(DEFAULT_PIPELINE_NODES);
      setEdges(DEFAULT_PIPELINE_EDGES);
    }
    setSelectedNodeId(null);
    pushHistory();
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
    toast.success('画布已重置');
  }, [setNodes, setEdges, pushHistory, fitView, pipelineConfig]);

  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, [setNodes]);

  // ======================== Keyboard Shortcuts ========================
  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      // Ignore when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;

      const ctrl = event.metaKey || event.ctrlKey;

      if (ctrl && event.key === 's') { event.preventDefault(); handleSave(); }
      if (ctrl && event.key === 'z' && !event.shiftKey) { event.preventDefault(); handleUndo(); }
      if (ctrl && event.key === 'z' && event.shiftKey) { event.preventDefault(); handleRedo(); }
      if (ctrl && event.key === 'a') { event.preventDefault(); handleSelectAll(); }
      if (ctrl && event.key === 'd' && selectedNodeId) { event.preventDefault(); handleDuplicateNode(selectedNodeId); }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
        handleDeleteNode(selectedNodeId);
      }

      if (event.key === 'Escape') {
        setSelectedNodeId(null);
        setContextMenu(null);
      }
    },
    [handleSave, handleUndo, handleRedo, handleDeleteNode, handleDuplicateNode, handleSelectAll, selectedNodeId]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ======================== Minimap ========================
  const minimapNodeColor = useCallback((node: Node) => {
    const c = NODE_COLORS[node.type as PipelineNodeType];
    return c?.hex || '#94a3b8';
  }, []);

  return (
    <div className="flex h-full w-full bg-background" ref={reactFlowWrapper}>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">加载流水线配置...</div>
        </div>
      ) : (
        <>
          {/* Left: Node Panel */}
          <NodePanel
            collapsed={nodePanelCollapsed}
            onToggleCollapse={() => setNodePanelCollapsed((v) => !v)}
          />

          {/* Center: Canvas */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            <EditorToolbar
              onSave={handleSave}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitView={handleFitView}
              onAutoLayout={handleAutoLayout}
              onToggleGrid={() => setIsGridVisible((v) => !v)}
              onToggleMinimap={() => setIsMinimapVisible((v) => !v)}
              onExportJSON={handleExportJSON}
              onImportJSON={handleImportJSON}
              onClearCanvas={handleClearCanvas}
              onDuplicateSelected={selectedNodeId ? () => handleDuplicateNode(selectedNodeId) : undefined}
              canUndo={canUndoState}
              canRedo={canRedoState}
              isGridVisible={isGridVisible}
              isMinimapVisible={isMinimapVisible}
              isDirty={isDirty}
              nodeCount={nodes.length}
              edgeCount={edges.length}
              zoom={zoom}
              hasSelection={!!selectedNodeId}
            />

            <div className="flex-1 relative">
              {/* Drop zone indicator */}
              {isDragOver && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute inset-2 border-2 border-dashed border-blue-400/40 rounded-2xl bg-blue-50/10 dark:bg-blue-900/5" />
                </div>
              )}

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onMoveEnd={handleMoveEnd}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{
                  type: 'animated',
                  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
                }}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                snapToGrid={isGridVisible}
                snapGrid={[16, 16]}
                deleteKeyCode={null}
                multiSelectionKeyCode="Shift"
                selectionOnDrag
                panOnScroll
                proOptions={{ hideAttribution: true }}
                className="bg-background"
              >
                {isGridVisible && (
                  <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" className="dark:opacity-15" />
                )}

                {isMinimapVisible && (
                  <MiniMap
                    nodeColor={minimapNodeColor}
                    maskColor="rgba(0,0,0,0.06)"
                    className="!bg-background/90 !border !border-border !rounded-xl !shadow-lg"
                    style={{ width: 160, height: 100 }}
                    pannable
                    zoomable
                  />
                )}

                {/* Bottom hint bar */}
                <Panel position="bottom-center" className="!mb-2">
                  <div className="bg-background/90 backdrop-blur-sm border border-border/80 rounded-full px-4 py-1 shadow-sm">
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                      <span>拖拽 → 添加节点</span>
                      <Dot />
                      <span>连接端口 → 连线</span>
                      <Dot />
                      <span>右键 → 菜单</span>
                      <Dot />
                      <span>Ctrl+S → 保存</span>
                    </div>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          </div>

          {/* Right: Config Panel */}
          {selectedNode && (
            <ConfigPanel
              node={selectedNode}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onClose={() => setSelectedNodeId(null)}
              configMetadata={configMetadata}
            />
          )}

          {/* Context Menu */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              targetNodeId={contextMenu.nodeId}
              targetEdgeId={contextMenu.edgeId}
              nodes={nodes}
              onClose={() => setContextMenu(null)}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onToggleEnable={handleToggleEnable}
              onDeleteEdge={handleDeleteEdge}
              onAutoLayout={handleAutoLayout}
              onFitView={handleFitView}
              onSelectAll={handleSelectAll}
            />
          )}
        </>
      )}
    </div>
  );
}

function Dot() {
  return <span className="w-0.5 h-0.5 rounded-full bg-border" />;
}

// ======================== Exported Component ========================
export default function VisualEditor({ pipelineId }: { pipelineId?: string }) {
  return (
    <ReactFlowProvider>
      <VisualEditorInner pipelineId={pipelineId} />
    </ReactFlowProvider>
  );
}
