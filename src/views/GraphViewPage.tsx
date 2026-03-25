import { useEffect, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import { Network } from "lucide-react";
import { useAppStore } from "../lib/store";
import { MEMORY_TYPE_COLORS } from "../lib/types";
import { saveMemory, getMemory } from "../lib/tauri";
import type { GraphNode as GNode } from "../lib/types";

const elk = new ELK();

function MemoryNodeComponent({ data }: { data: Record<string, unknown> }) {
  const gn = data as unknown as GNode;
  const color = MEMORY_TYPE_COLORS[gn.memory_type] ?? "#71717a";
  return (
    <div
      className="rounded-lg border-2 bg-zinc-900 px-3 py-2 shadow-lg min-w-[120px]"
      style={{
        borderColor: color,
        opacity: Math.max(0.4, gn.decay_score),
      }}
    >
      <div className="text-xs font-medium text-zinc-300 truncate max-w-[180px]">
        {gn.id}
      </div>
      <div className="text-[10px] text-zinc-500 truncate max-w-[180px] mt-0.5">
        {gn.label}
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span
          className="rounded px-1 py-0.5 text-[9px] font-medium"
          style={{ backgroundColor: color + "30", color }}
        >
          {gn.memory_type}
        </span>
        <span className="text-[9px] text-zinc-600">
          imp:{gn.importance.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { memory: MemoryNodeComponent };

async function layoutWithElk(
  graphNodes: GNode[],
  graphEdges: { source: string; target: string; edge_type: string }[],
) {
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
    },
    children: graphNodes.map((n) => ({
      id: n.id,
      width: 200,
      height: 80,
    })),
    edges: graphEdges.map((e, i) => ({
      id: `elk-e-${i}`,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(elkGraph);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const child of layout.children ?? []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }
  return positions;
}

export function GraphViewPage() {
  const { graphData, loadGraph } = useAppStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<{
    id: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
    type?: string;
  }>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<{
    id: string;
    source: string;
    target: string;
  }>([]);
  const [layouting, setLayouting] = useState(false);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    const doLayout = async () => {
      setLayouting(true);

      let positions: Record<string, { x: number; y: number }>;
      try {
        positions = await layoutWithElk(graphData.nodes, graphData.edges);
      } catch {
        // Fallback to grid layout
        const cols = Math.max(1, Math.ceil(Math.sqrt(graphData.nodes.length)));
        positions = {};
        graphData.nodes.forEach((n, i) => {
          positions[n.id] = {
            x: (i % cols) * 250 + 50,
            y: Math.floor(i / cols) * 130 + 50,
          };
        });
      }

      const newNodes = graphData.nodes.map((n) => ({
        id: n.id,
        type: "memory" as const,
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: n as unknown as Record<string, unknown>,
      }));

      const edgeColors: Record<string, string> = {
        related: "#6366f1",
        requires: "#22c55e",
        optional: "#f59e0b",
      };

      const newEdges = graphData.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.edge_type,
        style: { stroke: edgeColors[e.edge_type] ?? "#52525b" },
        labelStyle: { fill: "#a1a1aa", fontSize: 10 },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setLayouting(false);
    };

    doLayout();
  }, [graphData, setNodes, setEdges]);

  // Drag & drop to create new "related" edges
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Add edge visually
      const newEdge = {
        id: `e-new-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        label: "related",
        style: { stroke: "#6366f1" },
        labelStyle: { fill: "#a1a1aa", fontSize: 10 },
      };
      setEdges((eds) => addEdge(newEdge, eds));

      // Update the source memory's `related` field
      try {
        const memory = await getMemory(connection.source);
        if (!memory.meta.related.includes(connection.target)) {
          memory.meta.related.push(connection.target);
          await saveMemory({
            id: memory.meta.id,
            meta: memory.meta,
            l1_content: memory.l1_content,
            l2_content: memory.l2_content,
          });
        }
      } catch (e) {
        console.error("Failed to update relationship:", e);
      }
    },
    [setEdges],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <Network className="h-5 w-5 text-violet-400" />
        <h1 className="text-lg font-semibold text-zinc-100">Memory Graph</h1>
        <span className="text-xs text-zinc-500 ml-2">
          {graphData?.nodes.length ?? 0} nodes · {graphData?.edges.length ?? 0}{" "}
          edges
        </span>
        {layouting && (
          <span className="text-xs text-violet-400 ml-2">Layouting...</span>
        )}
      </div>
      <div className="flex-1">
        {nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#27272a" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={() => "#6366f1"}
              style={{ backgroundColor: "#18181b" }}
            />
          </ReactFlow>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Network className="h-12 w-12 mb-4 text-zinc-700" />
            <p className="text-sm">
              No memories with relationships yet. Add{" "}
              <code>related</code> fields to see the graph.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
