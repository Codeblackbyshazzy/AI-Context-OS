import { useState, useEffect, useCallback } from "react";
import { Save, Trash2 } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { FrontmatterForm } from "./FrontmatterForm";
import { TipTapEditor } from "./TipTapEditor";
import type { MemoryMeta } from "../../lib/types";

export function MemoryEditor() {
  const { activeMemory, saveActiveMemory, deleteMemory, loading } = useAppStore();
  const [meta, setMeta] = useState<MemoryMeta | null>(null);
  const [l1, setL1] = useState("");
  const [l2, setL2] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (activeMemory) {
      setMeta(activeMemory.meta);
      setL1(activeMemory.l1_content);
      setL2(activeMemory.l2_content);
      setDirty(false);
    }
  }, [activeMemory]);

  const handleMetaChange = (updated: MemoryMeta) => {
    setMeta(updated);
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    if (meta && dirty) {
      await saveActiveMemory(l1, l2, meta);
      setDirty(false);
    }
  }, [meta, l1, l2, dirty, saveActiveMemory]);

  // Keyboard shortcut: Cmd/Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleDelete = useCallback(async () => {
    if (!meta) return;
    const ok = window.confirm(
      `Delete memory "${meta.id}"?\n\nThis will permanently remove the file.`,
    );
    if (!ok) return;
    await deleteMemory(meta.id);
  }, [deleteMemory, meta]);

  if (!activeMemory || !meta) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-600">
        <p>Select a memory to edit</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Frontmatter form */}
      <FrontmatterForm meta={meta} onChange={handleMetaChange} />

      {/* Save button bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-1.5">
        <span className="text-xs text-zinc-500">
          v{meta.version} · {new Date(meta.modified).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-900/40 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || loading}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
              dirty
                ? "bg-violet-600 text-white hover:bg-violet-500"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            <Save className="h-3 w-3" />
            {dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      {/* Content areas with TipTap */}
      <div className="flex-1 overflow-y-auto">
        {/* L1 Section */}
        <div className="border-b border-zinc-800">
          <div className="flex items-center gap-2 bg-zinc-900/30 px-4 py-1.5">
            <div className="h-px flex-1 bg-blue-500/30" />
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">
              L1 — Summary
            </span>
            <div className="h-px flex-1 bg-blue-500/30" />
          </div>
          <TipTapEditor
            content={l1}
            onChange={(val) => {
              setL1(val);
              setDirty(true);
            }}
            placeholder="L1 summary content..."
          />
        </div>

        {/* L2 Section */}
        <div>
          <div className="flex items-center gap-2 bg-zinc-900/30 px-4 py-1.5">
            <div className="h-px flex-1 bg-emerald-500/30" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              L2 — Full Content
            </span>
            <div className="h-px flex-1 bg-emerald-500/30" />
          </div>
          <TipTapEditor
            content={l2}
            onChange={(val) => {
              setL2(val);
              setDirty(true);
            }}
            placeholder="L2 full content (Markdown)..."
          />
        </div>
      </div>
    </div>
  );
}
