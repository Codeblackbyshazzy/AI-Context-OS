import { useState } from "react";
import type { MemoryMeta, MemoryType } from "../../lib/types";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../../lib/types";

interface FrontmatterFormProps {
  meta: MemoryMeta;
  onChange: (meta: MemoryMeta) => void;
}

export function FrontmatterForm({ meta, onChange }: FrontmatterFormProps) {
  const [tagInput, setTagInput] = useState("");

  const update = (partial: Partial<MemoryMeta>) => {
    onChange({ ...meta, ...partial });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !meta.tags.includes(tag)) {
      update({ tags: [...meta.tags, tag] });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    update({ tags: meta.tags.filter((t) => t !== tag) });
  };

  const typeColor = MEMORY_TYPE_COLORS[meta.memory_type];

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
      {/* Row 1: ID, Type, Importance */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">ID</span>
          <span className="text-sm font-mono text-zinc-300">{meta.id}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Type</span>
          <select
            value={meta.memory_type}
            onChange={(e) => update({ memory_type: e.target.value as MemoryType })}
            className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-sm text-zinc-300"
            style={{ borderColor: typeColor }}
          >
            {(Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Importance</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={meta.importance}
            onChange={(e) => update({ importance: parseFloat(e.target.value) })}
            className="flex-1 max-w-32 accent-violet-500"
          />
          <span className="text-sm text-zinc-400 w-8">{meta.importance.toFixed(2)}</span>
        </div>

        <label className="flex items-center gap-1.5 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={meta.always_load}
            onChange={(e) => update({ always_load: e.target.checked })}
            className="accent-violet-500"
          />
          Always Load
        </label>
      </div>

      {/* Row 2: L0 summary */}
      <div className="mb-3">
        <input
          type="text"
          value={meta.l0}
          onChange={(e) => update({ l0: e.target.value })}
          placeholder="L0 summary (one line)..."
          className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* Row 3: Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">Tags</span>
        {meta.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add tag..."
          className="rounded bg-transparent border-none px-1 py-0.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none w-24"
        />
      </div>
    </div>
  );
}
