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
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

/**
 * Obsidian-style hybrid Markdown editor.
 *
 * - Blocks render as formatted markdown when unfocused.
 * - Click a block → raw markdown source appears in-place.
 * - Leave the block → formatted rendering resumes.
 *
 * Keyboard: Cmd+B bold, Cmd+I italic, Cmd+E code, Cmd+Shift+X strike.
 */
export function HybridMarkdownEditor({
  content,
  onChange,
  onBlur,
  placeholder,
  className,
  editable = true,
}: Props) {
  const blocks = useMemo(() => splitIntoBlocks(content), [content]);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const skipNextBlurCommitRef = useRef(false);

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
      if (!editable) return;
      if (focusedIdx === idx) return;
      if (focusedIdx !== null) {
        commitEdit(focusedIdx, editValue);
      }
      setFocusedIdx(idx);
      setEditValue(blocks[idx] ?? "");
    },
    [editable, focusedIdx, editValue, blocks, commitEdit],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (skipNextBlurCommitRef.current) {
        skipNextBlurCommitRef.current = false;
        return;
      }

      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest("[data-hybrid-editor]")) return;

      if (focusedIdx !== null) {
        commitEdit(focusedIdx, editValue);
        setFocusedIdx(null);
      }
      onBlur?.();
    },
    [focusedIdx, editValue, commitEdit, onBlur],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
      const el = e.currentTarget;
      const isMod = e.metaKey || e.ctrlKey;

      /* ── Inline formatting shortcuts ── */
      if (isMod && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "b") {
          e.preventDefault();
          e.stopPropagation();
          applyInlineMarker(el, editValue, setEditValue, "**");
          return;
        }
        if (key === "i") {
          e.preventDefault();
          e.stopPropagation();
          applyInlineMarker(el, editValue, setEditValue, "*");
          return;
        }
        if (key === "e") {
          e.preventDefault();
          e.stopPropagation();
          applyInlineMarker(el, editValue, setEditValue, "`");
          return;
        }
        if (key === "x" && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          applyInlineMarker(el, editValue, setEditValue, "~~");
          return;
        }
      }

      /* ── Enter: split block ── */
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const cursorPos = getCaretOffset(el);
        const before = editValue.slice(0, cursorPos);
        const after = editValue.slice(cursorPos);
        const newBlocks = [...blocks];
        newBlocks[idx] = before;
        newBlocks.splice(idx + 1, 0, after);
        skipNextBlurCommitRef.current = true;
        commitAndUpdate(newBlocks);
        setFocusedIdx(idx + 1);
        setEditValue(after);
      }

      /* ── Backspace at start: merge with previous ── */
      if (e.key === "Backspace") {
        const cursorPos = getCaretOffset(el);
        if (cursorPos === 0 && idx > 0) {
          e.preventDefault();
          const prevText = blocks[idx - 1] ?? "";
          const merged = prevText + editValue;
          const newBlocks = blocks.filter((_, i) => i !== idx);
          newBlocks[idx - 1] = merged;
          skipNextBlurCommitRef.current = true;
          commitAndUpdate(newBlocks);
          setFocusedIdx(idx - 1);
          setEditValue(merged);
          requestAnimationFrame(() => {
            const activeEl = document.querySelector(
              "[data-hybrid-editor] [data-block-active]",
            ) as HTMLElement | null;
            if (activeEl) setCaretOffset(activeEl, prevText.length);
          });
        }
      }

      /* ── Arrow up at start ── */
      if (e.key === "ArrowUp" && idx > 0) {
        const cursorPos = getCaretOffset(el);
        if (cursorPos === 0) {
          e.preventDefault();
          skipNextBlurCommitRef.current = true;
          commitEdit(idx, editValue);
          setFocusedIdx(idx - 1);
          setEditValue(blocks[idx - 1] ?? "");
        }
      }

      /* ── Arrow down at end ── */
      if (e.key === "ArrowDown" && idx < blocks.length - 1) {
        const cursorPos = getCaretOffset(el);
        if (cursorPos >= editValue.length) {
          e.preventDefault();
          skipNextBlurCommitRef.current = true;
          commitEdit(idx, editValue);
          setFocusedIdx(idx + 1);
          setEditValue(blocks[idx + 1] ?? "");
        }
      }

      /* ── Escape: deselect ── */
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

  /* ── Empty state ── */
  if (blocks.length === 0 || (blocks.length === 1 && blocks[0] === "")) {
    return (
      <div
        data-hybrid-editor
        className={clsx("tiptap min-h-[170px] cursor-text", className)}
        onClick={() => {
          if (!editable) return;
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
            {placeholder ?? "Type here..."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      data-hybrid-editor
      className={clsx("tiptap min-h-[170px]", className)}
    >
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
              editable={editable}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Editable block — raw markdown in a contentEditable div (no chrome)
   ═══════════════════════════════════════════════════════════════════════════ */

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

  useEffect(() => {
    if (ref.current && isInitialMount.current) {
      isInitialMount.current = false;
      ref.current.textContent = value;
      ref.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (ref.current.childNodes.length > 0) {
        const lastNode =
          ref.current.childNodes[ref.current.childNodes.length - 1];
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
      className={clsx(
        "rounded-sm px-1 py-0.5 font-mono text-sm leading-relaxed",
        "whitespace-pre-wrap break-words outline-none",
        "text-[color:var(--text-1)]",
        "bg-[color:var(--bg-2)]/40",
      )}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rendered block — formatted markdown (click to edit)
   ═══════════════════════════════════════════════════════════════════════════ */

function RenderedBlock({
  markdown,
  onClick,
  editable,
}: {
  markdown: string;
  onClick: () => void;
  editable: boolean;
}) {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return (
      <div
        className={clsx(
          "min-h-[1.4em] px-1 py-0.5",
          editable && "cursor-text",
        )}
        onClick={onClick}
      />
    );
  }

  return (
    <div
      className={clsx("px-1 py-0.5", editable && "cursor-text")}
      onClick={onClick}
    >
      <BlockContent markdown={trimmed} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Block content renderer — inherits .tiptap CSS for consistent styling
   ═══════════════════════════════════════════════════════════════════════════ */

function BlockContent({ markdown }: { markdown: string }) {
  /* ── Horizontal rule ── */
  if (/^---+$/.test(markdown) || /^\*\*\*+$/.test(markdown)) {
    return <hr className="my-2 border-[color:var(--border)]" />;
  }

  /* ── Code block (multi-line) ── */
  if (markdown.startsWith("```")) {
    const lines = markdown.split("\n");
    const hasClose = lines.length > 1 && lines[lines.length - 1].startsWith("```");
    const inner = lines.slice(1, hasClose ? -1 : undefined);
    return (
      <pre>
        <code>{inner.join("\n")}</code>
      </pre>
    );
  }

  /* ── Headings ── */
  const h3 = markdown.match(/^###\s+(.*)/);
  if (h3) return <h3>{renderInline(h3[1])}</h3>;

  const h2 = markdown.match(/^##\s+(.*)/);
  if (h2) return <h2>{renderInline(h2[1])}</h2>;

  const h1 = markdown.match(/^#\s+(.*)/);
  if (h1) return <h1>{renderInline(h1[1])}</h1>;

  /* ── Blockquote ── */
  const bq = markdown.match(/^>\s?(.*)/);
  if (bq) {
    return (
      <blockquote>
        <p>{renderInline(bq[1])}</p>
      </blockquote>
    );
  }

  /* ── Task checkbox ── */
  const task = markdown.match(/^-\s*\[([ xX])\]\s+(.*)/);
  if (task) {
    const checked = task[1] !== " ";
    return (
      <div className="flex items-start gap-2">
        <span
          className={clsx(
            "mt-0.5 text-sm",
            checked
              ? "text-[color:var(--success)]"
              : "text-[color:var(--text-2)]",
          )}
        >
          {checked ? "☑" : "☐"}
        </span>
        <span
          className={clsx(
            "text-sm",
            checked && "line-through text-[color:var(--text-2)]",
          )}
        >
          {renderInline(task[2])}
        </span>
      </div>
    );
  }

  /* ── Unordered list item ── */
  const ul = markdown.match(/^[-*]\s+(.*)/);
  if (ul) {
    return (
      <ul>
        <li>{renderInline(ul[1])}</li>
      </ul>
    );
  }

  /* ── Ordered list item ── */
  const ol = markdown.match(/^(\d+)\.\s+(.*)/);
  if (ol) {
    return (
      <ol start={Number(ol[1])}>
        <li>{renderInline(ol[2])}</li>
      </ol>
    );
  }

  /* ── Paragraph (default) ── */
  return <p>{renderInline(markdown)}</p>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Inline markdown rendering
   ═══════════════════════════════════════════════════════════════════════════ */

function renderInline(
  text: string,
): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  // Bold before italic to avoid conflicts; strikethrough before italic
  const regex =
    /(\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*(.+?)\*|_(.+?)_|`(.+?)`)/g;
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    if (match[2] || match[3]) {
      parts.push(<strong key={key++}>{match[2] || match[3]}</strong>);
    } else if (match[4]) {
      parts.push(
        <s key={key++} className="text-[color:var(--text-2)]">
          {match[4]}
        </s>,
      );
    } else if (match[5] || match[6]) {
      parts.push(<em key={key++}>{match[5] || match[6]}</em>);
    } else if (match[7]) {
      parts.push(<code key={key++}>{match[7]}</code>);
    }

    cursor = regex.lastIndex;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  if (parts.length === 0) return [text];
  return parts;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Block splitting — markdown → blocks
   ═══════════════════════════════════════════════════════════════════════════ */

function splitIntoBlocks(content: string): string[] {
  if (!content) return [""];
  const lines = content.split("\n");
  const blocks: string[] = [];
  let buffer = "";
  let inCodeBlock = false;
  let codeBuffer = "";

  const flushBuffer = () => {
    if (buffer.length > 0) {
      blocks.push(buffer);
      buffer = "";
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    /* ── Code fences: keep entire block together ── */
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        codeBuffer += "\n" + line;
        blocks.push(codeBuffer);
        codeBuffer = "";
        inCodeBlock = false;
      } else {
        flushBuffer();
        inCodeBlock = true;
        codeBuffer = line;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer += "\n" + line;
      continue;
    }

    /* ── Block-level elements ── */
    const isBlockStart =
      /^#{1,6}\s/.test(trimmed) ||    // headings
      /^[-*]\s/.test(trimmed) ||       // unordered list / task
      /^>\s?/.test(trimmed) ||         // blockquote
      /^\d+\.\s/.test(trimmed) ||      // ordered list
      /^---+$/.test(trimmed) ||        // horizontal rule
      /^\*\*\*+$/.test(trimmed);       // horizontal rule alt

    if (isBlockStart) {
      flushBuffer();
      blocks.push(line);
    } else if (trimmed === "") {
      flushBuffer();
      blocks.push("");
    } else {
      buffer += (buffer ? "\n" : "") + line;
    }
  }

  flushBuffer();
  if (inCodeBlock && codeBuffer) {
    blocks.push(codeBuffer);
  }
  if (blocks.length === 0) return [""];
  return blocks;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Cursor helpers for contentEditable
   ═══════════════════════════════════════════════════════════════════════════ */

function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(
    sel.getRangeAt(0).startContainer,
    sel.getRangeAt(0).startOffset,
  );
  return range.toString().length;
}

function getSelectionOffsets(el: HTMLElement): { start: number; end: number } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };

  const range = sel.getRangeAt(0);
  const startRange = range.cloneRange();
  startRange.selectNodeContents(el);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(el);
  endRange.setEnd(range.endContainer, range.endOffset);

  const start = startRange.toString().length;
  const end = endRange.toString().length;

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function applyInlineMarker(
  el: HTMLElement,
  currentValue: string,
  setValue: (next: string) => void,
  marker: string,
) {
  const { start, end } = getSelectionOffsets(el);
  const before = currentValue.slice(0, start);
  const selected = currentValue.slice(start, end);
  const after = currentValue.slice(end);
  const wrapped = `${before}${marker}${selected}${marker}${after}`;
  const nextSelectionStart = start + marker.length;
  const nextSelectionEnd = nextSelectionStart + selected.length;

  setValue(wrapped);
  el.textContent = wrapped;

  requestAnimationFrame(() => {
    setSelectionOffsets(el, nextSelectionStart, nextSelectionEnd);
  });
}

function setCaretOffset(el: HTMLElement, offset: number) {
  setSelectionOffsets(el, offset, offset);
}

function setSelectionOffsets(el: HTMLElement, start: number, end: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  const startPoint = resolveTextNodeOffset(el, start);
  const endPoint = resolveTextNodeOffset(el, end);
  if (!startPoint || !endPoint) return;

  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

function resolveTextNodeOffset(
  root: HTMLElement,
  targetOffset: number,
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  let consumed = 0;

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (consumed + length >= targetOffset) {
      return { node, offset: targetOffset - consumed };
    }
    consumed += length;
    node = walker.nextNode() as Text | null;
  }

  const fallback = root.lastChild;
  if (fallback && fallback.nodeType === Node.TEXT_NODE) {
    const textNode = fallback as Text;
    return { node: textNode, offset: textNode.textContent?.length ?? 0 };
  }

  if (!root.firstChild) {
    const textNode = document.createTextNode("");
    root.appendChild(textNode);
    return { node: textNode, offset: 0 };
  }

  return null;
}
