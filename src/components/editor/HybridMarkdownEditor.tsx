import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { clsx } from "clsx";

interface Props {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Hybrid Markdown editor — Logseq-style seamless block editing.
 * Blocks render as formatted markdown. Click to edit in-place (no borders).
 * Raw markdown syntax appears in a contentEditable div styled identically.
 */
export function HybridMarkdownEditor({
  content,
  onChange,
  placeholder,
  className,
}: Props) {
  const blocks = useMemo(() => splitIntoBlocks(content), [content]);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const commitAndUpdate = useCallback(
    (newBlocks: string[]) => {
      onChange(newBlocks.join("\n"));
    },
    [onChange],
  );

  const commitEdit = useCallback(
    (idx: number, newText: string) => {
      const updated = blocks.map((b, i) => (i === idx ? newText : b));
      commitAndUpdate(updated);
    },
    [blocks, commitAndUpdate],
  );

  const handleBlockFocus = useCallback(
    (idx: number) => {
      if (focusedIdx === idx) return;
      if (focusedIdx !== null) {
        commitEdit(focusedIdx, editValue);
      }
      setFocusedIdx(idx);
      setEditValue(blocks[idx] ?? "");
    },
    [focusedIdx, editValue, blocks, commitEdit],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't blur if focus is moving to another block in this editor
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest("[data-hybrid-editor]")) return;

      if (focusedIdx !== null) {
        commitEdit(focusedIdx, editValue);
        setFocusedIdx(null);
      }
    },
    [focusedIdx, editValue, commitEdit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
      const el = e.currentTarget;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Split block at cursor position
        const sel = window.getSelection();
        const cursorPos = sel ? getCaretOffset(el) : editValue.length;
        const before = editValue.slice(0, cursorPos);
        const after = editValue.slice(cursorPos);

        const newBlocks = [...blocks];
        newBlocks[idx] = before;
        newBlocks.splice(idx + 1, 0, after);
        commitAndUpdate(newBlocks);
        setFocusedIdx(idx + 1);
        setEditValue(after);
      }

      if (e.key === "Backspace") {
        const cursorPos = getCaretOffset(el);
        if (cursorPos === 0 && idx > 0) {
          e.preventDefault();
          // Merge with previous block
          const prevText = blocks[idx - 1] ?? "";
          const merged = prevText + editValue;
          const newBlocks = blocks.filter((_, i) => i !== idx);
          newBlocks[idx - 1] = merged;
          commitAndUpdate(newBlocks);
          setFocusedIdx(idx - 1);
          setEditValue(merged);
          // We'll set cursor to prevText.length after render
          requestAnimationFrame(() => {
            const activeEl = document.querySelector(
              "[data-hybrid-editor] [data-block-active]",
            ) as HTMLElement | null;
            if (activeEl) setCaretOffset(activeEl, prevText.length);
          });
        }
      }

      if (e.key === "ArrowUp" && idx > 0) {
        const cursorPos = getCaretOffset(el);
        if (cursorPos === 0) {
          e.preventDefault();
          commitEdit(idx, editValue);
          const prevIdx = idx - 1;
          setFocusedIdx(prevIdx);
          setEditValue(blocks[prevIdx] ?? "");
        }
      }

      if (e.key === "ArrowDown" && idx < blocks.length - 1) {
        const cursorPos = getCaretOffset(el);
        if (cursorPos >= editValue.length) {
          e.preventDefault();
          commitEdit(idx, editValue);
          const nextIdx = idx + 1;
          setFocusedIdx(nextIdx);
          setEditValue(blocks[nextIdx] ?? "");
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (focusedIdx !== null) {
          commitEdit(focusedIdx, editValue);
          setFocusedIdx(null);
        }
      }
    },
    [editValue, blocks, commitAndUpdate, commitEdit, focusedIdx],
  );

  // Empty state
  if (blocks.length === 0 || (blocks.length === 1 && blocks[0] === "")) {
    return (
      <div
        data-hybrid-editor
        className={clsx("min-h-[170px] cursor-text", className)}
        onClick={() => {
          setFocusedIdx(0);
          setEditValue("");
        }}
      >
        {focusedIdx === 0 ? (
          <EditableBlock
            value={editValue}
            onChange={setEditValue}
            onBlur={handleBlur}
            onKeyDown={(e) => handleKeyDown(e, 0)}
          />
        ) : (
          <p className="px-1 py-0.5 text-sm text-[color:var(--text-2)]/40">
            {placeholder ?? "Escribe aquí..."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-hybrid-editor className={clsx("min-h-[170px]", className)}>
      {blocks.map((block, idx) => (
        <div key={`block-${idx}`}>
          {focusedIdx === idx ? (
            <EditableBlock
              value={editValue}
              onChange={setEditValue}
              onBlur={handleBlur}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            />
          ) : (
            <RenderedBlock
              markdown={block}
              onClick={() => handleBlockFocus(idx)}
              isFocusedNeighbor={
                focusedIdx !== null &&
                Math.abs(focusedIdx - idx) === 1
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Editable block (contentEditable, no borders) ─── */

function EditableBlock({
  value,
  onChange,
  onBlur,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Set initial content and focus
  useEffect(() => {
    if (ref.current && isInitialMount.current) {
      isInitialMount.current = false;
      ref.current.textContent = value;
      ref.current.focus();
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      if (ref.current.childNodes.length > 0) {
        const lastNode = ref.current.childNodes[ref.current.childNodes.length - 1];
        range.setStartAfter(lastNode);
      } else {
        range.setStart(ref.current, 0);
      }
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onChange(ref.current.textContent ?? "");
    }
  }, [onChange]);

  // Prevent default paste — insert plain text only
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      if (ref.current) {
        onChange(ref.current.textContent ?? "");
      }
    },
    [onChange],
  );

  return (
    <div
      ref={ref}
      data-block-active
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPaste={handlePaste}
      spellCheck={false}
      className="rounded-sm bg-[color:var(--bg-1)]/60 px-1 py-0.5 font-mono text-sm leading-relaxed text-[color:var(--text-2)] outline-none"
    />
  );
}

/* ─── Rendered block (click to edit) ─── */

function RenderedBlock({
  markdown,
  onClick,
  isFocusedNeighbor: _isFocusedNeighbor,
}: {
  markdown: string;
  onClick: () => void;
  isFocusedNeighbor: boolean;
}) {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return (
      <div
        className="min-h-[1.4em] cursor-text px-1 py-0.5"
        onClick={onClick}
      />
    );
  }

  return (
    <div
      className="cursor-text rounded-sm px-1 py-0.5 transition-colors hover:bg-[color:var(--bg-1)]/40"
      onClick={onClick}
    >
      <BlockContent markdown={trimmed} />
    </div>
  );
}

/* ─── Markdown block rendering ─── */

function BlockContent({ markdown }: { markdown: string }) {
  const h3 = markdown.match(/^###\s+(.*)/);
  if (h3)
    return (
      <h3 className="text-base font-semibold text-[color:var(--text-0)]">
        {renderInline(h3[1])}
      </h3>
    );

  const h2 = markdown.match(/^##\s+(.*)/);
  if (h2)
    return (
      <h2 className="text-lg font-semibold text-[color:var(--text-0)]">
        {renderInline(h2[1])}
      </h2>
    );

  const h1 = markdown.match(/^#\s+(.*)/);
  if (h1)
    return (
      <h1 className="text-xl font-bold text-[color:var(--text-0)]">
        {renderInline(h1[1])}
      </h1>
    );

  const bq = markdown.match(/^>\s?(.*)/);
  if (bq) {
    return (
      <blockquote className="border-l-2 border-[color:var(--accent)] pl-3 text-sm italic text-[color:var(--text-1)]">
        {renderInline(bq[1])}
      </blockquote>
    );
  }

  // Task checkbox
  const task = markdown.match(/^-\s*\[([ xX])\]\s+(.*)/);
  if (task) {
    const checked = task[1] !== " ";
    return (
      <div className="flex items-start gap-2 text-sm text-[color:var(--text-1)]">
        <span
          className={clsx(
            "mt-0.5",
            checked
              ? "text-[color:var(--success)]"
              : "text-[color:var(--text-2)]",
          )}
        >
          {checked ? "☑" : "☐"}
        </span>
        <span
          className={clsx(
            checked && "line-through text-[color:var(--text-2)]",
          )}
        >
          {renderInline(task[2])}
        </span>
      </div>
    );
  }

  // Unordered list
  const ul = markdown.match(/^[-*]\s+(.*)/);
  if (ul) {
    return (
      <div className="flex gap-2 text-sm text-[color:var(--text-1)]">
        <span className="text-[color:var(--text-2)]">•</span>
        <span>{renderInline(ul[1])}</span>
      </div>
    );
  }

  // Ordered list
  const ol = markdown.match(/^(\d+)\.\s+(.*)/);
  if (ol) {
    return (
      <div className="flex gap-2 text-sm text-[color:var(--text-1)]">
        <span className="text-[color:var(--text-2)]">{ol[1]}.</span>
        <span>{renderInline(ol[2])}</span>
      </div>
    );
  }

  // Code block
  if (markdown.startsWith("```")) {
    const code = markdown
      .replace(/^```\w*\n?/, "")
      .replace(/\n?```$/, "");
    return (
      <pre className="rounded bg-[color:var(--bg-2)] px-3 py-2 font-mono text-xs text-[color:var(--text-1)]">
        <code>{code}</code>
      </pre>
    );
  }

  // Horizontal rule
  if (/^---+$/.test(markdown) || /^\*\*\*+$/.test(markdown)) {
    return <hr className="my-1 border-[color:var(--border)]" />;
  }

  // Paragraph
  return (
    <p className="text-sm leading-relaxed text-[color:var(--text-1)]">
      {renderInline(markdown)}
    </p>
  );
}

/* ─── Inline markdown rendering ─── */

function renderInline(
  text: string,
): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex =
    /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|~~(.+?)~~|`(.+?)`)/g;
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    if (match[2] || match[3]) {
      parts.push(
        <strong
          key={key++}
          className="font-semibold text-[color:var(--text-0)]"
        >
          {match[2] || match[3]}
        </strong>,
      );
    } else if (match[4] || match[5]) {
      parts.push(
        <em key={key++} className="italic">
          {match[4] || match[5]}
        </em>,
      );
    } else if (match[6]) {
      parts.push(
        <s key={key++} className="text-[color:var(--text-2)]">
          {match[6]}
        </s>,
      );
    } else if (match[7]) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-[color:var(--bg-2)] px-1 py-0.5 font-mono text-[12px] text-[color:var(--accent)]"
        >
          {match[7]}
        </code>,
      );
    }

    cursor = regex.lastIndex;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  if (parts.length === 0) return [text];
  return parts;
}

/* ─── Block splitting ─── */

function splitIntoBlocks(content: string): string[] {
  if (!content) return [""];
  const lines = content.split("\n");
  const blocks: string[] = [];
  let buffer = "";

  for (const line of lines) {
    const trimmed = line.trim();

    const isBlockStart =
      trimmed.startsWith("#") ||
      trimmed.startsWith("-") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("```") ||
      /^\d+\.\s/.test(trimmed) ||
      trimmed === "---" ||
      trimmed === "***";

    if (isBlockStart) {
      if (buffer.trim()) blocks.push(buffer.trim());
      blocks.push(line);
      buffer = "";
    } else if (trimmed === "") {
      if (buffer.trim()) blocks.push(buffer.trim());
      buffer = "";
    } else {
      buffer += (buffer ? "\n" : "") + line;
    }
  }

  if (buffer.trim()) blocks.push(buffer.trim());
  if (blocks.length === 0) return [""];
  return blocks;
}

/* ─── Cursor helpers for contentEditable ─── */

function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
  return range.toString().length;
}

function setCaretOffset(el: HTMLElement, offset: number) {
  const textNode = el.firstChild;
  if (!textNode) return;
  const range = document.createRange();
  const sel = window.getSelection();
  const pos = Math.min(offset, (textNode.textContent ?? "").length);
  range.setStart(textNode, pos);
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
}
