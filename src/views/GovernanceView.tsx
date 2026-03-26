import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  ArrowUpFromLine,
  BarChart3,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import {
  getConflicts,
  getDecayCandidates,
  getConsolidationSuggestions,
  getScratchCandidates,
} from "../lib/tauri";
import { useAppStore } from "../lib/store";
import type { Conflict, ConsolidationSuggestion, MemoryMeta } from "../lib/types";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../lib/types";

type Tab = "stats" | "conflicts" | "decay" | "consolidation" | "scratch";

export function GovernanceView() {
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [decayCandidates, setDecayCandidates] = useState<MemoryMeta[]>([]);
  const [consolidation, setConsolidation] = useState<ConsolidationSuggestion[]>([]);
  const [scratchFiles, setScratchFiles] = useState<string[]>([]);
  const { memories } = useAppStore();

  useEffect(() => {
    getConflicts().then(setConflicts).catch(console.error);
    getDecayCandidates().then(setDecayCandidates).catch(console.error);
    getConsolidationSuggestions().then(setConsolidation).catch(console.error);
    getScratchCandidates().then(setScratchFiles).catch(console.error);
  }, []);

  const tabs: { id: Tab; icon: typeof BarChart3; label: string }[] = [
    { id: "stats", icon: BarChart3, label: "Stats" },
    { id: "conflicts", icon: AlertTriangle, label: `Conflicts ${conflicts.length}` },
    { id: "decay", icon: Clock, label: `Decay ${decayCandidates.length}` },
    { id: "consolidation", icon: ArrowUpFromLine, label: `Consolidation ${consolidation.length}` },
    { id: "scratch", icon: Trash2, label: `Scratch TTL ${scratchFiles.length}` },
  ];

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
    <div className="flex h-full min-h-0 flex-col">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex items-center gap-1.5 border-b-2 px-4 py-2 text-[11px] font-medium transition-colors",
              activeTab === tab.id
                ? "border-[color:var(--accent)] text-[color:var(--text-0)]"
                : "border-transparent text-[color:var(--text-2)] hover:text-[color:var(--text-1)]",
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "stats" && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total" value={memories.length.toString()} />
              <StatCard label="Avg Importance" value={avgImportance.toFixed(2)} />
              <StatCard label="Conflicts" value={conflicts.length.toString()} />
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-2)]">
                By Type
              </h3>
              <div className="space-y-1.5">
                {Object.entries(typeGroups).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: MEMORY_TYPE_COLORS[type as keyof typeof MEMORY_TYPE_COLORS] }}
                    />
                    <span className="w-20 text-xs text-[color:var(--text-1)]">
                      {MEMORY_TYPE_LABELS[type as keyof typeof MEMORY_TYPE_LABELS]}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--bg-3)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / Math.max(1, memories.length)) * 100}%`,
                          backgroundColor: MEMORY_TYPE_COLORS[type as keyof typeof MEMORY_TYPE_COLORS],
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-[11px] text-[color:var(--text-2)]">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "conflicts" && (
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="rounded-md border border-[color:var(--warning)]/20 bg-[color:var(--warning)]/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--warning)]" />
                  <span className="font-mono text-xs text-[color:var(--warning)]">
                    {c.memory_a} ↔ {c.memory_b}
                  </span>
                </div>
                <p className="text-xs text-[color:var(--text-1)]">{c.description}</p>
              </div>
            ))}
            {conflicts.length === 0 && (
              <Empty text="No conflicts detected" />
            )}
          </div>
        )}

        {activeTab === "decay" && (
          <div className="space-y-1.5">
            {decayCandidates.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[color:var(--bg-0)] px-3 py-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-2)]" />
                <span className="text-xs font-medium text-[color:var(--text-1)]">{m.id}</span>
                <span className="flex-1 truncate text-[11px] text-[color:var(--text-2)]">{m.l0}</span>
                <span className="shrink-0 font-mono text-[10px] text-[color:var(--text-2)]">
                  {new Date(m.last_access).toLocaleDateString()}
                </span>
              </div>
            ))}
            {decayCandidates.length === 0 && (
              <Empty text="No decay candidates" />
            )}
          </div>
        )}

        {activeTab === "consolidation" && (
          <div className="space-y-2">
            {consolidation.map((s, i) => (
              <div key={i} className="rounded-md border border-[var(--border)] bg-[color:var(--bg-0)] p-3">
                <p className="mb-1 text-xs text-[color:var(--text-1)]">{s.summary}</p>
                <span className="font-mono text-[10px] text-[color:var(--text-2)]">
                  → {s.suggested_folder}
                </span>
              </div>
            ))}
            {consolidation.length === 0 && (
              <Empty text="No consolidation suggestions" />
            )}
          </div>
        )}

        {activeTab === "scratch" && (
          <div className="space-y-1.5">
            {scratchFiles.map((file) => {
              const name = file.split("/").pop() || file;
              return (
                <div key={file} className="flex items-center gap-2 rounded-md border border-[color:var(--warning)]/20 bg-[color:var(--warning)]/5 px-3 py-2">
                  <Trash2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
                  <span className="text-xs font-medium text-[color:var(--text-1)]">{name}</span>
                  <span className="flex-1 truncate font-mono text-[10px] text-[color:var(--text-2)]">{file}</span>
                </div>
              );
            })}
            {scratchFiles.length === 0 && (
              <Empty text="No hay archivos scratch expirados" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[color:var(--bg-0)] p-3">
      <p className="text-xl font-semibold tabular-nums text-[color:var(--text-0)]">{value}</p>
      <p className="mt-0.5 text-[10px] text-[color:var(--text-2)]">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-12 text-center text-xs text-[color:var(--text-2)]">{text}</p>
  );
}
