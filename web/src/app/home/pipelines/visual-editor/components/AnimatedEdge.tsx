import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { X } from 'lucide-react';

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style = {},
  markerEnd,
}: EdgeProps<Edge>) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onDelete = () => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
  };

  return (
    <>
      {/* Invisible fat path for easier clicking */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={24} className="react-flow__edge-interaction" />

      {/* Glow when selected */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={6}
          strokeOpacity={0.12}
          className="pointer-events-none"
          style={{ filter: 'blur(3px)' }}
        />
      )}

      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#3b82f6' : '#cbd5e1',
          strokeWidth: selected ? 2 : 1.5,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          ...style,
        }}
      />

      {/* Animated flowing dot */}
      <circle r={selected ? 3 : 2} fill={selected ? '#3b82f6' : '#94a3b8'} opacity={0.7}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>

      {/* Delete button on hover/select */}
      <EdgeLabelRenderer>
        <div
          className={`
            absolute pointer-events-auto
            flex items-center justify-center
            w-5 h-5 rounded-full
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600
            shadow-sm cursor-pointer
            transition-colors duration-150
            hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/30
            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onClick={onDelete}
          title="删除连线"
        >
          <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(AnimatedEdge);
