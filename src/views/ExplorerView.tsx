import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { FileExplorer } from "../components/explorer/FileExplorer";
import { MemoryEditor } from "../components/editor/MemoryEditor";
import { useAppStore } from "../lib/store";
import { createMemory } from "../lib/tauri";
import type { MemoryType } from "../lib/types";

export function ExplorerView() {
  const {
    initialized,
    initialize,
    loadFileTree,
    loadMemories,
    regenerateRouter,
    memories,
    explorerOpen,
  } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState("");
  const [newType, setNewType] = useState<MemoryType>("context");
  const [newL0, setNewL0] = useState("");

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setShowCreate(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleCreate = async () => {
    if (!newId.trim() || !newL0.trim()) return;
    try {
      await createMemory({
        id: newId.trim().toLowerCase().replace(/\s+/g, "-"),
        memory_type: newType,
        l0: newL0.trim(),
        importance: 0.5,
        tags: [],
        l1_content: "",
        l2_content: "",
      });
      await regenerateRouter();
      setShowCreate(false);
      setNewId("");
      setNewL0("");
    } catch (e) {
      console.error("Failed to create memory:", e);
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateRouter();
      await loadFileTree();
      await loadMemories();
    } catch (e) {
      console.error("Failed to regenerate:", e);
    }
  };

  return (
    <div className="flex h-full">
      {explorerOpen && (
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--border)] bg-[color:var(--bg-0)] transition-all duration-300">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--text-2)]">
            Memories
            <span className="ml-1.5 font-normal tabular-nums">{memories.length}</span>
          </span>
          <div className="flex gap-0.5">
            <button
              onClick={() => setShowCreate((prev) => !prev)}
              className="rounded p-1 text-[color:var(--text-2)] transition-colors hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-1)]"
              title="New memory (Cmd+N)"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRegenerate}
              className="rounded p-1 text-[color:var(--text-2)] transition-colors hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-1)]"
              title="Regenerate router"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="space-y-2 border-t border-[var(--border)] px-3 py-2.5">
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="memory-id"
              className="w-full rounded-md border border-[var(--border)] bg-[color:var(--bg-2)] px-2.5 py-1.5 text-xs text-[color:var(--text-0)] placeholder:text-[color:var(--text-2)]"
            />
            <input
              type="text"
              value={newL0}
              onChange={(e) => setNewL0(e.target.value)}
              placeholder="Summary (L0)"
              className="w-full rounded-md border border-[var(--border)] bg-[color:var(--bg-2)] px-2.5 py-1.5 text-xs text-[color:var(--text-0)] placeholder:text-[color:var(--text-2)]"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as MemoryType)}
              className="w-full rounded-md border border-[var(--border)] bg-[color:var(--bg-2)] px-2.5 py-1.5 text-xs text-[color:var(--text-1)]"
            >
              <option value="context">Context</option>
              <option value="intelligence">Intelligence</option>
              <option value="project">Project</option>
              <option value="resource">Resource</option>
              <option value="skill">Skill</option>
              <option value="daily">Daily</option>
              <option value="task">Task</option>
              <option value="rule">Rule</option>
              <option value="scratch">Scratch</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-md border border-[var(--border)] py-1.5 text-xs text-[color:var(--text-2)] transition-colors hover:text-[color:var(--text-1)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newId.trim() || !newL0.trim()}
                className={clsx(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity",
                  newId.trim() && newL0.trim()
                    ? "bg-[color:var(--accent)] text-white hover:opacity-90"
                    : "bg-[color:var(--bg-3)] text-[color:var(--text-2)] opacity-50",
                )}
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <FileExplorer />
        </div>
      </aside>
      )}

      <section className="min-w-0 flex-1 bg-[color:var(--bg-1)]">
        <MemoryEditor />
      </section>
    </div>
  );
}
