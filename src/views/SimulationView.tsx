import { useState } from "react";
import { Search, Zap } from "lucide-react";
import { simulateContext } from "../lib/tauri";
import type { ScoredMemory } from "../lib/types";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../lib/types";

export function SimulationView() {
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState(4000);
  const [results, setResults] = useState<ScoredMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const scored = await simulateContext(query, budget);
      setResults(scored);
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalTokens = results.reduce((acc, r) => acc + r.token_estimate, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--border)] p-4">
        <h1 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[color:var(--text-0)]">
          <Zap className="h-5 w-5 text-sky-300" />
          Context Simulation
        </h1>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
            placeholder="Write a query to test context loading..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[color:var(--bg-2)] px-4 py-2 text-sm text-[color:var(--text-0)] placeholder:text-[color:var(--text-2)] focus:border-sky-500/50 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-[color:var(--text-2)]">Budget:</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value) || 4000)}
              className="w-20 rounded border border-[var(--border)] bg-[color:var(--bg-2)] px-2 py-2 text-center text-sm text-[color:var(--text-1)]"
            />
          </div>
          <button
            onClick={handleSimulate}
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-[color:var(--bg-3)] disabled:text-[color:var(--text-2)]"
          >
            <Search className="h-4 w-4" />
            Simulate
          </button>
        </div>
      </div>

      {/* Token budget bar */}
      {results.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[color:var(--bg-2)]/30 px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[color:var(--text-2)]">
              Token Budget: {totalTokens} / {budget}
            </span>
            <span className="text-xs text-[color:var(--text-2)]">
              {results.length} memories loaded
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--bg-3)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (totalTokens / budget) * 100)}%`,
                backgroundColor:
                  totalTokens > budget * 0.9
                    ? "#ef4444"
                    : totalTokens > budget * 0.7
                      ? "#f59e0b"
                      : "#22c55e",
              }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {results.map((r, idx) => (
          <div
            key={r.memory_id}
            className="rounded-lg border border-[var(--border)] bg-[color:var(--bg-1)]/65 p-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 text-xs font-mono text-[color:var(--text-2)]">
                #{idx + 1}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: MEMORY_TYPE_COLORS[r.memory_type] + "20",
                  color: MEMORY_TYPE_COLORS[r.memory_type],
                }}
              >
                {MEMORY_TYPE_LABELS[r.memory_type]}
              </span>
              <span className="rounded border border-[var(--border)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-xs font-mono text-[color:var(--text-2)]">
                {r.load_level.toUpperCase()}
              </span>
              <span className="flex-1 truncate text-sm text-[color:var(--text-1)]">
                {r.l0}
              </span>
              <span className="text-xs text-[color:var(--text-2)]">
                {r.token_estimate} tokens
              </span>
              <span className="text-sm font-mono text-sky-300">
                {r.score.final_score.toFixed(3)}
              </span>
            </div>
            {/* Score breakdown bars */}
            <div className="flex gap-1 h-1.5">
              <ScoreBar
                value={r.score.semantic}
                color="#8b5cf6"
                label="Semantic"
                weight={0.3}
              />
              <ScoreBar
                value={r.score.bm25}
                color="#3b82f6"
                label="BM25"
                weight={0.15}
              />
              <ScoreBar
                value={r.score.recency}
                color="#22c55e"
                label="Recency"
                weight={0.15}
              />
              <ScoreBar
                value={r.score.importance}
                color="#f59e0b"
                label="Importance"
                weight={0.2}
              />
              <ScoreBar
                value={r.score.access_frequency}
                color="#ec4899"
                label="Frequency"
                weight={0.1}
              />
              <ScoreBar
                value={r.score.graph_proximity}
                color="#06b6d4"
                label="Graph"
                weight={0.1}
              />
            </div>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[color:var(--text-2)]">
            <Zap className="mb-4 h-12 w-12 text-[color:var(--text-2)]" />
            <p className="text-sm">
              Type a query and click Simulate to see which memories would be loaded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({
  value,
  color,
  label,
  weight,
}: {
  value: number;
  color: string;
  label: string;
  weight: number;
}) {
  const widthPercent = weight * 100;
  return (
    <div
      className="overflow-hidden rounded-full bg-[color:var(--bg-3)]"
      style={{ flex: widthPercent }}
      title={`${label}: ${value.toFixed(3)} (×${weight})`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${value * 100}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
