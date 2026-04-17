import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Search,
  Strikethrough,
  Type,
} from "lucide-react";
import { clsx } from "clsx";

interface Props {
  viewRef: React.MutableRefObject<EditorView | null>;
  disabled?: boolean;
}

function wrapSelection(view: EditorView, mark: string, placeholder = "") {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to) || placeholder;
    const inserted = `${mark}${text}${mark}`;
    return {
      changes: [{ from: range.from, to: range.to, insert: inserted }],
      range: EditorSelection.range(
        range.from + mark.length,
        range.from + mark.length + text.length,
      ),
    };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
}

function toggleLinePrefix(view: EditorView, prefix: string) {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    const nextChanges: { from: number; to: number; insert: string }[] = [];

    for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
      const line = state.doc.line(lineNumber);
      const headingMatch = line.text.match(/^#{1,6}\s+/);
      const bulletMatch = line.text.match(/^(\s*)([-*+])\s+/);
      const orderedMatch = line.text.match(/^(\s*)\d+\.\s+/);
      const taskMatch = line.text.match(/^(\s*)-\s\[[ xX]\]\s+/);
      const quoteMatch = line.text.match(/^>\s?/);

      if (prefix.startsWith("#")) {
        if (headingMatch && line.text.startsWith(prefix)) {
          nextChanges.push({ from: line.from, to: line.from + prefix.length, insert: "" });
        } else if (headingMatch) {
          nextChanges.push({
            from: line.from,
            to: line.from + headingMatch[0].length,
            insert: prefix,
          });
        } else {
          nextChanges.push({ from: line.from, to: line.from, insert: prefix });
        }
        continue;
      }

      if (prefix === "> ") {
        if (quoteMatch) {
          nextChanges.push({ from: line.from, to: line.from + quoteMatch[0].length, insert: "" });
        } else {
          nextChanges.push({ from: line.from, to: line.from, insert: prefix });
        }
        continue;
      }

      if (prefix === "- ") {
        if (taskMatch) {
          nextChanges.push({ from: line.from, to: line.from + taskMatch[0].length, insert: prefix });
        } else if (bulletMatch) {
          nextChanges.push({ from: line.from, to: line.from + bulletMatch[0].length, insert: "" });
        } else if (orderedMatch) {
          nextChanges.push({ from: line.from, to: line.from + orderedMatch[0].length, insert: prefix });
        } else {
          nextChanges.push({ from: line.from, to: line.from, insert: prefix });
        }
        continue;
      }

      if (prefix === "1. ") {
        if (orderedMatch) {
          nextChanges.push({ from: line.from, to: line.from + orderedMatch[0].length, insert: "" });
        } else if (bulletMatch) {
          nextChanges.push({ from: line.from, to: line.from + bulletMatch[0].length, insert: prefix });
        } else {
          nextChanges.push({ from: line.from, to: line.from, insert: prefix });
        }
        continue;
      }

      if (prefix === "- [ ] ") {
        if (taskMatch) {
          nextChanges.push({ from: line.from, to: line.from + taskMatch[0].length, insert: "" });
        } else if (bulletMatch) {
          nextChanges.push({ from: line.from, to: line.from + bulletMatch[0].length, insert: prefix });
        } else {
          nextChanges.push({ from: line.from, to: line.from, insert: prefix });
        }
      }
    }

    const delta = nextChanges.reduce((acc, change) => acc + (change.insert.length - (change.to - change.from)), 0);
    return {
      changes: nextChanges,
      range: EditorSelection.range(range.from, range.to + delta),
    };
  });

  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
}

function insertBlock(view: EditorView, text: string, cursorOffset?: number) {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  const atLineStart = range.from === line.from;
  const prefix = atLineStart ? "" : "\n";
  const insert = `${prefix}${text}`;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.single(
      range.from + prefix.length + (cursorOffset ?? insert.length - prefix.length),
    ),
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
}

function insertLink(view: EditorView) {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to) || "texto";
  const insert = `[${selected}](url)`;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(
      range.from + selected.length + 3,
      range.from + selected.length + 6,
    ),
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
}

function insertImage(view: EditorView) {
  const { state } = view;
  const range = state.selection.main;
  const insert = "![alt](url)";

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(range.from + 7, range.from + 10),
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
}

function insertCodeBlock(view: EditorView) {
  insertBlock(view, "```\n\n```", 4);
}

function insertHorizontalRule(view: EditorView) {
  insertBlock(view, "---\n");
}

type ToolbarItem = {
  key: string;
  label: string;
  section: string;
  shortcut?: string;
  keywords?: string[];
  icon: React.ReactNode;
  run: (view: EditorView) => void;
};

const items: ToolbarItem[] = [
  {
    key: "bold",
    label: "Negrita",
    section: "Texto",
    shortcut: "Cmd+B",
    keywords: ["strong", "bold"],
    icon: <Bold className="h-3.5 w-3.5" />,
    run: (view) => wrapSelection(view, "**", "texto"),
  },
  {
    key: "italic",
    label: "Cursiva",
    section: "Texto",
    shortcut: "Cmd+I",
    keywords: ["italic", "emphasis"],
    icon: <Type className="h-3.5 w-3.5 italic" />,
    run: (view) => wrapSelection(view, "*", "texto"),
  },
  {
    key: "strike",
    label: "Tachado",
    section: "Texto",
    shortcut: "Cmd+Shift+X",
    keywords: ["strike", "tachar"],
    icon: <Strikethrough className="h-3.5 w-3.5" />,
    run: (view) => wrapSelection(view, "~~", "texto"),
  },
  {
    key: "code",
    label: "Codigo inline",
    section: "Texto",
    shortcut: "Cmd+E",
    keywords: ["inline code", "backticks"],
    icon: <Code className="h-3.5 w-3.5" />,
    run: (view) => wrapSelection(view, "`", "codigo"),
  },
  {
    key: "link",
    label: "Enlace",
    section: "Insertar",
    shortcut: "Cmd+K",
    keywords: ["url", "link"],
    icon: <LinkIcon className="h-3.5 w-3.5" />,
    run: insertLink,
  },
  {
    key: "image",
    label: "Imagen",
    section: "Insertar",
    keywords: ["image", "media"],
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    run: insertImage,
  },
  {
    key: "ul",
    label: "Lista",
    section: "Bloques",
    keywords: ["unordered", "bullet"],
    icon: <List className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "- "),
  },
  {
    key: "ol",
    label: "Lista numerada",
    section: "Bloques",
    keywords: ["ordered", "numbered"],
    icon: <ListOrdered className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "1. "),
  },
  {
    key: "task",
    label: "Lista de tareas",
    section: "Bloques",
    keywords: ["checkbox", "task"],
    icon: <ListChecks className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "- [ ] "),
  },
  {
    key: "quote",
    label: "Cita",
    section: "Bloques",
    keywords: ["blockquote", "quote"],
    icon: <Quote className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "> "),
  },
  {
    key: "codeblock",
    label: "Bloque de codigo",
    section: "Insertar",
    keywords: ["fenced", "snippet"],
    icon: <Code className="h-3.5 w-3.5" />,
    run: insertCodeBlock,
  },
  {
    key: "h1",
    label: "Heading 1",
    section: "Titulos",
    shortcut: "Cmd+1",
    keywords: ["title", "h1"],
    icon: <Heading1 className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "# "),
  },
  {
    key: "h2",
    label: "Heading 2",
    section: "Titulos",
    shortcut: "Cmd+2",
    keywords: ["subtitle", "h2"],
    icon: <Heading2 className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "## "),
  },
  {
    key: "h3",
    label: "Heading 3",
    section: "Titulos",
    shortcut: "Cmd+3",
    keywords: ["section", "h3"],
    icon: <Heading3 className="h-3.5 w-3.5" />,
    run: (view) => toggleLinePrefix(view, "### "),
  },
  {
    key: "hr",
    label: "Separador",
    section: "Insertar",
    keywords: ["horizontal rule", "divider"],
    icon: <Minus className="h-3.5 w-3.5" />,
    run: insertHorizontalRule,
  },
];

const quickActionKeys = ["bold", "italic", "link", "ul", "quote"];

export function FormatToolbar({ viewRef, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const quickActions = useMemo(
    () => items.filter((item) => quickActionKeys.includes(item.key)),
    [],
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? items.filter((item) =>
          [item.label, item.section, item.shortcut, ...(item.keywords ?? [])]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedQuery)),
        )
      : items;

    return filtered.reduce<Record<string, ToolbarItem[]>>((acc, item) => {
      if (!acc[item.section]) {
        acc[item.section] = [];
      }
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [query]);

  useLayoutEffect(() => {
    if (!open || !menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    const width = 320;
    const left = Math.min(rect.right - width, window.innerWidth - width - 12);
    setCoords({
      top: rect.bottom + 8,
      left: Math.max(12, left),
      width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    searchInputRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuButtonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const handleLayoutChange = () => setOpen(false);

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [open]);

  const run = (item: ToolbarItem) => {
    const view = viewRef.current;
    if (!view) return;
    item.run(view);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[color:var(--bg-1)]/90 px-1 py-1 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur">
        {quickActions.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            onClick={() => run(item)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--text-2)] transition-all hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-0)] disabled:opacity-50"
            title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ""}`}
          >
            {item.icon}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          className={clsx(
            "flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[color:var(--text-2)] transition-all hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-0)] disabled:opacity-50",
            open && "bg-[color:var(--bg-2)] text-[color:var(--text-0)]",
          )}
          title="Mas formato Markdown"
        >
          <span className="text-[13px] font-semibold tracking-[0.02em]">Aa</span>
          <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[color:var(--bg-1)]/95 shadow-[0_26px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl"
        >
          <div className="border-b border-[var(--border)] px-3 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[color:var(--bg-0)] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[color:var(--text-2)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar formato, lista, titulo..."
                className="w-full bg-transparent text-sm text-[color:var(--text-0)] placeholder:text-[color:var(--text-2)] focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[min(68vh,540px)] overflow-y-auto px-2 py-2">
            {Object.entries(filteredGroups).length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--text-2)]">
                No hay coincidencias para esa busqueda.
              </div>
            ) : (
              Object.entries(filteredGroups).map(([section, sectionItems]) => (
                <div key={section} className="mb-1 last:mb-0">
                  <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-2)]">
                    {section}
                  </div>
                  {sectionItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => run(item)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-[color:var(--text-1)] transition-colors hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-0)]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[color:var(--bg-0)] text-[color:var(--text-2)]">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[color:var(--text-0)]">{item.label}</span>
                        <span className="block truncate text-xs text-[color:var(--text-2)]">
                          {item.shortcut ?? "Sin atajo"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
