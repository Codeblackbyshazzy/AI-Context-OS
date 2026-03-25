import { useState } from "react";
import type { MemoryMeta, MemoryType } from "../../lib/types";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../../lib/types";

interface FrontmatterFormProps {
  meta: MemoryMeta;
  onChange: (meta: MemoryMeta) => void;
}

interface ChipEditorProps {
  label: string;
  values: string[];
  placeholder: string;
  color?: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

function ChipEditor({
  label,
  values,
  placeholder,
  color,
  onAdd,
  onRemove,
}: ChipEditorProps) {
  const [input, setInput] = useState("");

  const commit = () => {
    const value = input.trim();
    if (!value) return;
    onAdd(value);
    setInput("");
  };

  return (
    <div className="space-y-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 flex-wrap rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            style={{
              borderColor: color ?? "#3f3f46",
              color: color ?? "#d4d4d8",
              backgroundColor: `${color ?? "#27272a"}20`,
            }}
          >
            {value}
            <button
              type="button"
              onClick={() => onRemove(value)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="min-w-[100px] flex-1 bg-transparent px-1 py-0.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
    </div>
  );
}

const toMemoryRef = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

export function FrontmatterForm({ meta, onChange }: FrontmatterFormProps) {
  const update = (partial: Partial<MemoryMeta>) => {
    onChange({ ...meta, ...partial });
  };

  const addUnique = (list: string[], rawValue: string, normalize = true) => {
    const value = normalize ? toMemoryRef(rawValue) : rawValue.trim().toLowerCase();
    if (!value || list.includes(value)) return list;
    return [...list, value];
  };

  const typeColor = MEMORY_TYPE_COLORS[meta.memory_type];
  const isSkill = meta.memory_type === "skill";

  return (
    <div className="space-y-3 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr_1fr_auto]">
        <div className="space-y-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">ID</span>
          <input
            type="text"
            value={meta.id}
            onChange={(e) => update({ id: toMemoryRef(e.target.value) })}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm font-mono text-zinc-200 focus:border-violet-500 focus:outline-none"
            placeholder="memory-id"
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Type</span>
          <select
            value={meta.memory_type}
            onChange={(e) => update({ memory_type: e.target.value as MemoryType })}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-300"
            style={{ borderColor: typeColor }}
          >
            {(Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Importance ({meta.importance.toFixed(2)})
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={meta.importance}
            onChange={(e) => update({ importance: parseFloat(e.target.value) })}
            className="w-full accent-violet-500"
          />
        </div>

        <label className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={meta.always_load}
            onChange={(e) => update({ always_load: e.target.checked })}
            className="accent-violet-500"
          />
          Always load
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Decay Rate ({meta.decay_rate.toFixed(4)})
          </span>
          <input
            type="range"
            min="0.95"
            max="0.9999"
            step="0.0001"
            value={meta.decay_rate}
            onChange={(e) => update({ decay_rate: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Confidence ({meta.confidence.toFixed(2)})
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={meta.confidence}
            onChange={(e) => update({ confidence: parseFloat(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">L0 Summary</span>
        <input
          type="text"
          value={meta.l0}
          onChange={(e) => update({ l0: e.target.value })}
          placeholder="Resumen de una línea..."
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChipEditor
          label="Tags"
          values={meta.tags}
          placeholder="Añadir tag..."
          color="#a78bfa"
          onAdd={(value) =>
            update({
              tags: addUnique(meta.tags, value, false),
            })
          }
          onRemove={(value) => update({ tags: meta.tags.filter((tag) => tag !== value) })}
        />
        <ChipEditor
          label="Related"
          values={meta.related}
          placeholder="memory-id..."
          color="#60a5fa"
          onAdd={(value) =>
            update({
              related: addUnique(meta.related, value),
            })
          }
          onRemove={(value) =>
            update({ related: meta.related.filter((item) => item !== value) })
          }
        />
      </div>

      {isSkill && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ChipEditor
            label="Triggers"
            values={meta.triggers}
            placeholder="frase de activación..."
            color="#4ade80"
            onAdd={(value) =>
              update({
                triggers: addUnique(meta.triggers, value, false),
              })
            }
            onRemove={(value) =>
              update({ triggers: meta.triggers.filter((item) => item !== value) })
            }
          />
          <div className="space-y-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Output Format
            </span>
            <input
              type="text"
              value={meta.output_format ?? ""}
              onChange={(e) =>
                update({ output_format: e.target.value.trim() || null })
              }
              placeholder="markdown / json / text..."
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <ChipEditor
            label="Requires"
            values={meta.requires}
            placeholder="memory-id requerido..."
            color="#22c55e"
            onAdd={(value) =>
              update({
                requires: addUnique(meta.requires, value),
              })
            }
            onRemove={(value) =>
              update({ requires: meta.requires.filter((item) => item !== value) })
            }
          />
          <ChipEditor
            label="Optional"
            values={meta.optional}
            placeholder="memory-id opcional..."
            color="#f59e0b"
            onAdd={(value) =>
              update({
                optional: addUnique(meta.optional, value),
              })
            }
            onRemove={(value) =>
              update({ optional: meta.optional.filter((item) => item !== value) })
            }
          />
        </div>
      )}
    </div>
  );
}
