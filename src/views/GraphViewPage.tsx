import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as d3 from "d3-force";
import {
  AlertTriangle,
  ExternalLink,
  Network,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Layers,
  Link2,
} from "lucide-react";
import { clsx } from "clsx";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../lib/store";
import { saveMemory, getMemory } from "../lib/tauri";
import {
  MEMORY_ONTOLOGY_COLORS,
  MEMORY_ONTOLOGY_LABELS,
  type GraphNode as GNode,
  type GraphEdge,
  type MemoryOntology,
} from "../lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMUNITY_PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#0ea5e9", "#22c55e", "#f43f5e", "#a16207", "#0891b2",
  "#7c3aed", "#059669",
];

const EDGE_COLORS: Record<string, string> = {
  related: "#8a95a6",
  requires: "#9aa8c0",
  optional: "#9c9382",
  wikilink: "#6d9e6d",
  tag: "#7a6d9e",
};

function communityColor(community: number | null): string {
  if (community === null) return "#64748b";
  return COMMUNITY_PALETTE[community % COMMUNITY_PALETTE.length];
}

// Node size: base 160px wide, scales up with degree (max +80px)
function nodeWidth(degree: number): number {
  return 160 + Math.min(degree * 10, 80);
}

// ---------------------------------------------------------------------------
// Force-directed layout
// ---------------------------------------------------------------------------

function layoutWithForce(
  gnodes: GNode[],
  gedges: GraphEdge[],
): Promise<Record<string, { x: number; y: number }>> {
  return new Promise((resolve) => {
    if (gnodes.length === 0) {
      resolve({});
      return;
    }

    const simNodes = gnodes.map((n) => ({ id: n.id, x: 0, y: 0 }));
    const simLinks = gedges
      .filter((e) => gnodes.some((n) => n.id === e.source) && gnodes.some((n) => n.id === e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    const sim = d3
      .forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d) => (d as { id: string }).id).distance(140).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(0, 0))
      .force("collide", d3.forceCollide(90))
      .stop();

    // Run synchronously to avoid React render thrash
    sim.tick(300);

    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of simNodes) {
      positions[n.id] = { x: n.x ?? 0, y: n.y ?? 0 };
    }
    resolve(positions);
  });
}

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

interface NodeData extends Record<string, unknown> {
  node: GNode;
  colorByCommunity: boolean;
  godMode: boolean;
  godIds: Set<string>;
}

interface FlowNode {
  id: string;
  position: { x: number; y: number };
  data: NodeData;
  type?: string;
  style?: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: { stroke?: string; strokeWidth?: number };
  labelStyle?: { fill?: string; fontSize?: number };
  animated?: boolean;
}

function MemoryNodeComponent({ data }: { data: NodeData }) {
  const { node: gn, colorByCommunity, godMode, godIds } = data;
  const [hovered, setHovered] = useState(false);

  const isGod = godMode && godIds.has(gn.id);
  const color = isGod
    ? "#ef4444"
    : colorByCommunity
    ? communityColor(gn.community)
    : (MEMORY_ONTOLOGY_COLORS[gn.ontology] ?? "#64748b");

  const w = nodeWidth(gn.degree);

  return (
    <div
      style={{
        width: w,
        opacity: Math.max(0.4, gn.decay_score),
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="rounded border border-[var(--border)] bg-[color:var(--bg-1)] px-2.5 py-2"
        style={isGod ? { borderColor: "#ef4444", boxShadow: "0 0 0 1px #ef444440" } : {}}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="shrink-0 rounded-full"
            style={{
              backgroundColor: color,
              width: 6 + Math.min(gn.degree * 1.5, 8),
              height: 6 + Math.min(gn.degree * 1.5, 8),
            }}
          />
          <span className="truncate text-xs font-medium text-[color:var(--text-0)]">{gn.id}</span>
          {gn.degree > 0 && (
            <span className="ml-auto shrink-0 rounded bg-[color:var(--bg-2)] px-1 font-mono text-[9px] text-[color:var(--text-2)]">
              {gn.degree}
            </span>
          )}
        </div>
        <div className="mt-1 max-h-[2.2em] overflow-hidden text-[10px] leading-relaxed text-[color:var(--text-2)]">
          {gn.label}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-[color:var(--text-2)]">
            {MEMORY_ONTOLOGY_LABELS[gn.ontology]}
          </span>
          <span className="ml-auto font-mono text-[10px] text-[color:var(--text-2)]">
            {gn.importance.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Hover preview tooltip */}
      {hovered && gn.preview && (
        <div
          className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-64 rounded-md border border-[var(--border)] bg-[color:var(--bg-2)] px-3 py-2 shadow-lg"
          style={{ maxWidth: 260 }}
        >
          <p className="text-[11px] font-medium text-[color:var(--text-0)]">{gn.label}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[color:var(--text-2)]">
            {gn.preview}
            {gn.preview.length >= 160 ? "…" : ""}
          </p>
          {gn.degree > 0 && (
            <p className="mt-1.5 text-[9px] text-[color:var(--text-2)]">
              {gn.degree} connection{gn.degree !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { memory: MemoryNodeComponent };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GraphViewPage() {
  const navigate = useNavigate();
  const { graphData, loadGraph, selectFile, setError } = useAppStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [layouting, setLayouting] = useState(false);
  const [layoutSeed, setLayoutSeed] = useState(0);
  const [edgeMode, setEdgeMode] = useState<"related" | "requires" | "optional">("related");
  const [ontologyFilter, setOntologyFilter] = useState<MemoryOntology | "all">("all");
  const [minImportance, setMinImportance] = useState(0);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [colorByCommunity, setColorByCommunity] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const layoutingRef = useRef(false);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // God node IDs derived from graphData
  const godIds = useMemo<Set<string>>(() => {
    if (!graphData) return new Set();
    const degreeMap = new Map<string, number>();
    for (const n of graphData.nodes) {
      degreeMap.set(n.id, n.degree);
    }
    const maxDeg = Math.max(1, ...Array.from(degreeMap.values()));
    const ids = new Set<string>();
    for (const n of graphData.nodes) {
      const normDeg = (degreeMap.get(n.id) ?? 0) / maxDeg;
      if (normDeg - n.importance > 0.2 || (degreeMap.get(n.id) ?? 0) >= 2) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [graphData]);

  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [] as GNode[], edges: [] as GraphEdge[] };
    let filtered = graphData.nodes;
    if (ontologyFilter !== "all") filtered = filtered.filter((n) => n.ontology === ontologyFilter);
    if (minImportance > 0) filtered = filtered.filter((n) => n.importance >= minImportance);
    const nodeIds = new Set(filtered.map((n) => n.id));
    const edgesFiltered = graphData.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    return { nodes: filtered, edges: edgesFiltered };
  }, [graphData, ontologyFilter, minImportance]);

  // Keep selectedNode in sync when graphData refreshes
  useEffect(() => {
    if (!graphData || !selectedNode) return;
    setSelectedNode(graphData.nodes.find((n) => n.id === selectedNode.id) ?? null);
  }, [graphData, selectedNode]);

  // Build backlinks map
  const backlinksMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!graphData) return map;
    for (const e of graphData.edges) {
      const existing = map.get(e.target) ?? [];
      if (!existing.includes(e.source)) existing.push(e.source);
      map.set(e.target, existing);
      // undirected: also track reverse
      const rev = map.get(e.source) ?? [];
      if (!rev.includes(e.target)) rev.push(e.target);
      map.set(e.source, rev);
    }
    return map;
  }, [graphData]);

  useEffect(() => {
    if (filteredData.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      setLayouting(false);
      return;
    }
    if (layoutingRef.current) return;

    const doLayout = async () => {
      layoutingRef.current = true;
      setLayouting(true);

      const positions = await layoutWithForce(filteredData.nodes, filteredData.edges);

      const newNodes: FlowNode[] = filteredData.nodes.map((node) => ({
        id: node.id,
        type: "memory",
        position: positions[node.id] ?? { x: 0, y: 0 },
        style: { width: nodeWidth(node.degree) },
        data: { node, colorByCommunity, godMode, godIds },
      }));

      const newEdges: FlowEdge[] = filteredData.edges.map((edge, i) => ({
        id: `e-${edge.source}-${edge.target}-${i}`,
        source: edge.source,
        target: edge.target,
        label: edge.edge_type !== "tag" ? edge.edge_type : undefined,
        animated: edge.edge_type === "requires",
        style: {
          stroke: EDGE_COLORS[edge.edge_type] ?? "#6b7280",
          strokeWidth: edge.edge_type === "tag" ? 1 : 1.5,
          strokeDasharray: edge.edge_type === "tag" ? "4 3" : undefined,
        } as FlowEdge["style"],
        labelStyle: { fill: "#8b9cb4", fontSize: 9 },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      layoutingRef.current = false;
      setLayouting(false);
      requestAnimationFrame(() => flowInstance?.fitView({ padding: 0.2, duration: 350 }));
    };

    void doLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, layoutSeed, colorByCommunity, godMode, godIds, flowInstance]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const newEdge: FlowEdge = {
        id: `e-new-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        label: edgeMode,
        style: { stroke: EDGE_COLORS[edgeMode], strokeWidth: 1.5 },
        labelStyle: { fill: "#8b9cb4", fontSize: 9 },
      };
      setEdges((cur) => addEdge(newEdge, cur));
      try {
        const memory = await getMemory(connection.source);
        const push = (arr: string[], v: string) => { if (!arr.includes(v)) arr.push(v); };
        if (edgeMode === "related") push(memory.meta.related, connection.target);
        else if (memory.meta.system_role === "skill") {
          if (edgeMode === "requires") push(memory.meta.requires, connection.target);
          else push(memory.meta.optional, connection.target);
        } else {
          push(memory.meta.related, connection.target);
        }
        await saveMemory({ id: memory.meta.id, meta: memory.meta, l1_content: memory.l1_content, l2_content: memory.l2_content });
      } catch (e) {
        setError(`Failed to update relationship: ${String(e)}`);
      }
    },
    [edgeMode, setEdges, setError],
  );

  const onNodeClick = useCallback((_: unknown, node: { data: NodeData }) => {
    setSelectedNode(node.data.node);
  }, []);

  const onNodeDoubleClick = useCallback(
    async (_: unknown, node: { id: string; data: NodeData }) => {
      setSelectedNode(node.data.node);
      try {
        await selectFile(node.id);
        navigate("/");
      } catch (e) {
        setError(`Failed to open memory ${node.id}: ${String(e)}`);
      }
    },
    [navigate, selectFile, setError],
  );

  const godCount = godMode ? godIds.size : 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="text-[11px] text-[color:var(--text-2)]">
          {filteredData.nodes.length} nodes · {filteredData.edges.length} edges
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <select
            value={ontologyFilter}
            onChange={(e) => setOntologyFilter(e.target.value as MemoryOntology | "all")}
            className="rounded border border-[var(--border)] bg-[color:var(--bg-2)] px-2 py-1 text-[11px] text-[color:var(--text-1)]"
          >
            <option value="all">All types</option>
            {(Object.keys(MEMORY_ONTOLOGY_LABELS) as MemoryOntology[]).map((o) => (
              <option key={o} value={o}>{MEMORY_ONTOLOGY_LABELS[o]}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <label className="text-[10px] text-[color:var(--text-2)]">Imp ≥</label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={minImportance}
              onChange={(e) => setMinImportance(parseFloat(e.target.value))}
              className="h-1 w-16 accent-[color:var(--accent)]"
            />
            <span className="w-5 text-right font-mono text-[10px] text-[color:var(--text-2)]">
              {minImportance.toFixed(1)}
            </span>
          </div>

          <select
            value={edgeMode}
            onChange={(e) => setEdgeMode(e.target.value as "related" | "requires" | "optional")}
            className="rounded border border-[var(--border)] bg-[color:var(--bg-2)] px-2 py-1 text-[11px] text-[color:var(--text-1)]"
          >
            <option value="related">related</option>
            <option value="requires">requires</option>
            <option value="optional">optional</option>
          </select>

          {/* God mode toggle */}
          <button
            type="button"
            onClick={() => setGodMode((p) => !p)}
            className={clsx(
              "flex items-center gap-1 rounded px-1.5 py-1 text-[10px] transition-colors",
              godMode
                ? "bg-red-500/15 text-red-400"
                : "text-[color:var(--text-2)] hover:text-[color:var(--text-1)]",
            )}
            title="Highlight god nodes (high degree vs low importance)"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {godMode && godCount > 0 && <span>{godCount}</span>}
          </button>

          {/* Community/ontology color toggle */}
          <button
            type="button"
            onClick={() => setColorByCommunity((p) => !p)}
            className={clsx(
              "rounded p-1 transition-colors",
              colorByCommunity
                ? "bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                : "text-[color:var(--text-2)] hover:text-[color:var(--text-1)]",
            )}
            title={colorByCommunity ? "Color by ontology" : "Color by community"}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setLayoutSeed((p) => p + 1)}
            className="rounded p-1 text-[color:var(--text-2)] hover:text-[color:var(--text-1)]"
            title="Re-layout"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowInspector((p) => !p)}
            className="rounded p-1 text-[color:var(--text-2)] hover:text-[color:var(--text-1)]"
          >
            {showInspector ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Graph canvas */}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[color:var(--bg-0)]">
          {nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onInit={setFlowInstance}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(255,255,255,0.03)" gap={24} />
              <Controls />
              <MiniMap
                nodeColor="rgba(255,255,255,0.15)"
                style={{
                  backgroundColor: "var(--bg-1)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                }}
              />
            </ReactFlow>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-[color:var(--text-2)]">
              <Network className="mb-3 h-8 w-8" />
              <p className="text-xs">No nodes for current filter.</p>
            </div>
          )}
        </div>

        {/* Inspector panel */}
        <aside
          className={clsx(
            "obs-inspector min-h-0 transition-all",
            showInspector ? "w-[280px] opacity-100" : "pointer-events-none w-0 opacity-0",
          )}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[color:var(--bg-1)]">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {selectedNode ? (
                <InspectorPanel
                  node={selectedNode}
                  backlinks={backlinksMap.get(selectedNode.id) ?? []}
                  graphNodes={graphData?.nodes ?? []}
                  colorByCommunity={colorByCommunity}
                  onOpenNode={(id) => void onNodeDoubleClick(null, { id, data: { node: selectedNode, colorByCommunity, godMode, godIds } as NodeData })}
                  onSelectNode={(id) => {
                    const found = graphData?.nodes.find((n) => n.id === id) ?? null;
                    setSelectedNode(found);
                  }}
                />
              ) : (
                <p className="text-xs text-[color:var(--text-2)]">
                  Click a node to inspect. Double-click to open.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {layouting && (
        <div className="pointer-events-none absolute right-8 top-20 rounded-md border border-[var(--border)] bg-[color:var(--bg-2)] px-2.5 py-1 text-xs text-[color:var(--text-1)]">
          Calculating layout…
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector panel
// ---------------------------------------------------------------------------

function InspectorPanel({
  node,
  backlinks,
  graphNodes,
  colorByCommunity,
  onOpenNode,
  onSelectNode,
}: {
  node: GNode;
  backlinks: string[];
  graphNodes: GNode[];
  colorByCommunity: boolean;
  onOpenNode: (id: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const color = colorByCommunity
    ? communityColor(node.community)
    : (MEMORY_ONTOLOGY_COLORS[node.ontology] ?? "#64748b");

  const backlinkNodes = backlinks
    .map((id) => graphNodes.find((n) => n.id === id))
    .filter(Boolean) as GNode[];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[color:var(--text-0)]">{node.id}</p>
        <p className="mt-0.5 text-[11px] text-[color:var(--text-2)]">{node.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <NodeMetric label="Ontology" value={MEMORY_ONTOLOGY_LABELS[node.ontology]} />
        <NodeMetric label="Collection" value={node.folder_category ?? "—"} />
        <NodeMetric label="Importance" value={node.importance.toFixed(2)} />
        <NodeMetric label="Decay" value={node.decay_score.toFixed(2)} />
        <NodeMetric label="Connections" value={String(node.degree)} />
        <NodeMetric
          label="Community"
          value={node.community !== null ? `#${node.community}` : "—"}
          swatchColor={node.community !== null ? color : undefined}
        />
      </div>

      {node.preview && (
        <div className="rounded-md bg-[color:var(--bg-2)] px-2.5 py-2">
          <p className="text-[10px] leading-relaxed text-[color:var(--text-2)]">
            {node.preview}{node.preview.length >= 160 ? "…" : ""}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenNode(node.id)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in Explorer
      </button>

      {/* Backlinks */}
      {backlinkNodes.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] text-[color:var(--text-2)]">
            <Link2 className="h-3 w-3" />
            <span>Linked from ({backlinkNodes.length})</span>
          </div>
          <div className="space-y-1">
            {backlinkNodes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelectNode(n.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--bg-2)]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: MEMORY_ONTOLOGY_COLORS[n.ontology] ?? "#64748b" }}
                />
                <span className="truncate text-[10px] text-[color:var(--text-1)]">{n.id}</span>
                <span className="ml-auto shrink-0 text-[9px] text-[color:var(--text-2)]">
                  {n.degree}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NodeMetric({ label, value, swatchColor }: { label: string; value: string; swatchColor?: string }) {
  return (
    <div>
      <p className="text-[10px] text-[color:var(--text-2)]">{label}</p>
      <div className="flex items-center gap-1">
        {swatchColor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatchColor }} />}
        <p className="truncate text-xs text-[color:var(--text-1)]">{value}</p>
      </div>
    </div>
  );
}
