import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { PipelineNodeData } from '../types';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

export function autoLayout(
  nodes: Node<PipelineNodeData>[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): Node<PipelineNodeData>[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: direction,
    nodesep: 70,
    ranksep: 120,
    edgesep: 40,
    marginx: 50,
    marginy: 50,
    acyclicer: 'greedy',
    ranker: 'network-simplex',
  });

  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    // Give start/end nodes smaller dimensions
    const isSmall = node.type === 'start' || node.type === 'end';
    g.setNode(node.id, {
      width: isSmall ? 160 : NODE_WIDTH,
      height: isSmall ? 70 : NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;

    const isSmall = node.type === 'start' || node.type === 'end';
    const w = isSmall ? 160 : NODE_WIDTH;
    const h = isSmall ? 70 : NODE_HEIGHT;

    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });
}
