import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { FileExplorer } from "../components/explorer/FileExplorer";
import { MemoryEditor } from "../components/editor/MemoryEditor";
import { useAppStore } from "../lib/store";
import { createMemory, regenerateRouter } from "../lib/tauri";
import type { MemoryType } from "../lib/types";

export function ExplorerView() {
  const { initialized, initialize, loadFileTree, loadMemories } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState("");
  const [newType, setNewType] = useState<MemoryType>("context");
  const [newL0, setNewL0] = useState("");

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // Keyboard shortcut: Cmd/Ctrl+N for new memory
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
      await loadFileTree();
      await loadMemories();
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
      {/* Left panel: File Explorer */}
      <div className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Explorer
          </span>
          <div className="flex gap-1">
            <button
              onClick={handleRegenerate}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="Regenerate router"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="New memory"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Create memory form */}
        {showCreate && (
          <div className="border-b border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="memory-id"
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
            <input
              type="text"
              value={newL0}
              onChange={(e) => setNewL0(e.target.value)}
              placeholder="L0 summary..."
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as MemoryType)}
              className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              <option value="context">Context</option>
              <option value="intelligence">Intelligence</option>
              <option value="project">Project</option>
              <option value="resource">Resource</option>
              <option value="skill">Skill</option>
              <option value="rule">Rule</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={!newId.trim() || !newL0.trim()}
              className="w-full rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              Create Memory
            </button>
          </div>
        )}

        <FileExplorer />
      </div>

      {/* Right panel: Editor */}
      <div className="flex-1">
        <MemoryEditor />
      </div>
    </div>
  );
}
