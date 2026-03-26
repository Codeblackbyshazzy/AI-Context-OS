import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  AlertTriangle,
  Trash2,
  Pencil,
  Copy,
} from "lucide-react";
import { clsx } from "clsx";
import { useAppStore } from "../../lib/store";
import { getConflicts, deleteMemory, getMemory, createMemory } from "../../lib/tauri";
import type { FileNode, MemoryType, Conflict } from "../../lib/types";
import { MEMORY_TYPE_COLORS } from "../../lib/types";

/* ─── Context Menu ─── */
interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode;
}

function ContextMenu({
  menu,
  onClose,
  onDelete,
  onRename,
  onDuplicate,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onDelete: () => void;
  onRename: () => void;
  onDuplicate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const isMemory = menu.node.name.endsWith(".md") && !menu.node.is_dir;

  if (!isMemory) return null;

  const items = [
    { label: "Renombrar", icon: Pencil, action: onRename },
    { label: "Duplicar", icon: Copy, action: onDuplicate },
    { label: "Eliminar", icon: Trash2, action: onDelete, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded-md border border-[color:var(--border)] bg-[color:var(--bg-1)] py-1 shadow-lg"
      style={{ top: menu.y, left: menu.x }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className={clsx(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[color:var(--bg-2)]",
            (item as { danger?: boolean }).danger
              ? "text-[color:var(--danger)]"
              : "text-[color:var(--text-1)]",
          )}
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function getTypeColor(node: FileNode): string | undefined {
  if (node.memory_type) {
    return MEMORY_TYPE_COLORS[node.memory_type];
  }
  const parts = node.path.split("/");
  for (const part of parts) {
    const folderType = folderToType(part);
    if (folderType) return MEMORY_TYPE_COLORS[folderType];
  }
  return undefined;
}

function folderToType(folder: string): MemoryType | null {
  const map: Record<string, MemoryType> = {
    "01-context": "context",
    "02-daily": "daily",
    "03-intelligence": "intelligence",
    "04-projects": "project",
    "05-resources": "resource",
    "06-skills": "skill",
    "07-tasks": "task",
    "08-rules": "rule",
    "09-scratch": "scratch",
  };
  return map[folder] ?? null;
}

function computeDecayOpacity(meta: {
  last_access: string;
  decay_rate: number;
  access_count: number;
}): number {
  const now = Date.now();
  const lastAccess = new Date(meta.last_access).getTime();
  const daysSince = (now - lastAccess) / (1000 * 60 * 60 * 24);
  const effectiveDecay = Math.pow(
    meta.decay_rate,
    1 / (1 + 0.1 * meta.access_count),
  );
  const score = Math.pow(effectiveDecay, daysSince);
  return Math.max(0.35, Math.min(1, score));
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (path: string) => void;
  conflictIds: Set<string>;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  renamingPath: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

function TreeNode({
  node,
  depth,
  expanded,
  toggleExpand,
  conflictIds,
  onContextMenu,
  renamingPath,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: TreeNodeProps) {
  const { selectedPath, selectFile, selectRawFile, memories } = useAppStore();
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;
  const color = getTypeColor(node);

  const isMarkdown = node.name.endsWith(".md");
  const memoryId = isMarkdown ? node.name.replace(".md", "") : "";
  const memoryMeta = isMarkdown ? memories.find((m) => m.id === memoryId) : null;

  const hasConflict = conflictIds.has(memoryId);
  const isRawSupported = isRawViewerSupported(node.name);

  const opacity = memoryMeta
    ? computeDecayOpacity(memoryMeta)
    : 1;

  const handleClick = () => {
    if (node.is_dir) {
      toggleExpand(node.path);
    } else if (isMarkdown && memoryMeta) {
      selectFile(memoryMeta.id);
    } else if (isRawSupported) {
      selectRawFile(node.path);
    }
  };

  return (
    <>
      <div
        className={clsx(
          "flex cursor-pointer items-center gap-1.5 rounded px-2 py-[5px] text-[13px] transition-colors",
          isSelected
            ? "bg-[color:var(--accent-muted)] text-[color:var(--text-0)]"
            : "text-[color:var(--text-1)] hover:bg-[color:var(--bg-2)]",
        )}
        style={{
          paddingLeft: `${depth * 12 + 8}px`,
          opacity: node.is_dir ? 1 : opacity,
        }}
        onClick={handleClick}
      >
        {node.is_dir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-[color:var(--text-2)]" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-[color:var(--text-2)]" />
            )}
            <Folder
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: color ?? "var(--text-2)" }}
            />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileText
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: color ?? "var(--text-2)" }}
            />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {hasConflict && (
          <span title="Conflict detected">
            <AlertTriangle className="ml-auto h-3 w-3 shrink-0 text-[color:var(--warning)]" />
          </span>
        )}
        {memoryMeta && (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-[color:var(--text-2)]">
            {memoryMeta.importance.toFixed(1)}
          </span>
        )}
      </div>
      {node.is_dir && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              conflictIds={conflictIds}
            />
          ))}
        </div>
      )}
    </>
  );
}

function isRawViewerSupported(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.endsWith(".jsonl") ||
    lowerName.endsWith(".yaml") ||
    lowerName.endsWith(".yml")
  );
}

export function FileExplorer() {
  const { fileTree, loadFileTree } = useAppStore();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  useEffect(() => {
    getConflicts()
      .then((conflicts: Conflict[]) => {
        const ids = new Set<string>();
        for (const c of conflicts) {
          ids.add(c.memory_a);
          ids.add(c.memory_b);
        }
        setConflictIds(ids);
      })
      .catch(() => {});
  }, [fileTree]);

  useEffect(() => {
    if (fileTree.length > 0 && expanded.size === 0) {
      const topLevel = new Set(
        fileTree.filter((n) => n.is_dir).map((n) => n.path),
      );
      setExpanded(topLevel);
    }
  }, [fileTree, expanded.size]);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="px-1 py-1">
      {fileTree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          expanded={expanded}
          toggleExpand={toggleExpand}
          conflictIds={conflictIds}
        />
      ))}
      {fileTree.length === 0 && (
        <p className="px-3 py-8 text-center text-xs text-[color:var(--text-2)]">
          No files yet.
        </p>
      )}
    </div>
  );
}
