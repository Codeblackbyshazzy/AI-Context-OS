import { useEffect, useState } from "react";
import {
  Shield,
  AlertTriangle,
  Clock,
  ArrowUpFromLine,
  BarChart3,
} from "lucide-react";
import { clsx } from "clsx";
import {
  getConflicts,
  getDecayCandidates,
  getConsolidationSuggestions,
} from "../lib/tauri";
import { useAppStore } from "../lib/store";
import type { Conflict, ConsolidationSuggestion, MemoryMeta } from "../lib/types";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../lib/types";

type Tab = "conflicts" | "decay" | "consolidation" | "stats";

export function GovernanceView() {
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [decayCandidates, setDecayCandidates] = useState<MemoryMeta[]>([]);
  const [consolidation, setConsolidation] = useState<ConsolidationSuggestion[]>([]);
  const { memories } = useAppStore();

  useEffect(() => {
    getConflicts().then(setConflicts).catch(console.error);
    getDecayCandidates().then(setDecayCandidates).catch(console.error);
    getConsolidationSuggestions().then(setConsolidation).catch(console.error);
  }, []);

  const tabs = [
    { id: "stats" as Tab, icon: BarChart3, label: "Stats" },
    { id: "conflicts" as Tab, icon: AlertTriangle, label: `Conflicts (${conflicts.length})` },
    { id: "decay" as Tab, icon: Clock, label: `Decay (${decayCandidates.length})` },
    { id: "consolidation" as Tab, icon: ArrowUpFromLine, label: `Consolidation (${consolidation.length})` },
  ];

  // Stats
  const typeGroups = memories.reduce(
    (acc, m) => {
      acc[m.memory_type] = (acc[m.memory_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const avgImportance =
    memories.length > 0
      ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
      : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="h-5 w-5 text-violet-400" />
          Governance Panel
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total Memories" value={memories.length.toString()} />
              <StatCard label="Avg Importance" value={avgImportance.toFixed(2)} />
              <StatCard label="Conflicts" value={conflicts.length.toString()} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-3">
                Memories by Type
              </h3>
              <div className="space-y-2">
                {Object.entries(typeGroups).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: MEMORY_TYPE_COLORS[type as keyof typeof MEMORY_TYPE_COLORS] }}
                    />
                    <span className="text-sm text-zinc-400 w-24">
                      {MEMORY_TYPE_LABELS[type as keyof typeof MEMORY_TYPE_LABELS]}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / Math.max(1, memories.length)) * 100}%`,
                          backgroundColor: MEMORY_TYPE_COLORS[type as keyof typeof MEMORY_TYPE_COLORS],
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-zinc-500 w-8 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "conflicts" && (
          <div className="space-y-3">
            {conflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-400">
                    {c.memory_a} ↔ {c.memory_b}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{c.description}</p>
              </div>
            ))}
            {conflicts.length === 0 && (
              <p className="text-center text-sm text-zinc-600 py-8">
                No conflicts detected
              </p>
            )}
          </div>
        )}

        {activeTab === "decay" && (
          <div className="space-y-2">
            {decayCandidates.map((m) => (
              <div key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex items-center gap-3">
                <Clock className="h-4 w-4 text-zinc-600" />
                <span className="text-sm text-zinc-300">{m.id}</span>
                <span className="text-xs text-zinc-500">{m.l0}</span>
                <span className="ml-auto text-xs text-zinc-600">
                  Last: {new Date(m.last_access).toLocaleDateString()}
                </span>
              </div>
            ))}
            {decayCandidates.length === 0 && (
              <p className="text-center text-sm text-zinc-600 py-8">
                No decay candidates
              </p>
            )}
          </div>
        )}

        {activeTab === "consolidation" && (
          <div className="space-y-3">
            {consolidation.map((s, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-sm text-zinc-300 mb-2">{s.summary}</p>
                <span className="text-xs text-zinc-500">
                  Suggested: {s.suggested_folder}
                </span>
              </div>
            ))}
            {consolidation.length === 0 && (
              <p className="text-center text-sm text-zinc-600 py-8">
                No consolidation suggestions
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
