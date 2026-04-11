import React, { useRef, useEffect, useCallback } from "react";
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
 * Always-editable markdown editor.
 * Auto-growing textarea — Enter, undo, selection all work natively.
 * Cmd+B bold · Cmd+I italic · Cmd+E code · Cmd+Shift+X strike · Tab indent
 */
export function HybridMarkdownEditor({
  content,
  onChange,
  onBlur,
  placeholder,
  className,
  editable = true,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /* ── Auto-grow to fit content ── */
  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = Math.max(el.scrollHeight, 170) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [content, autoResize]);

  /* ── Keyboard shortcuts ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "b") { e.preventDefault(); wrap(el, "**"); onChange(el.value); return; }
        if (key === "i") { e.preventDefault(); wrap(el, "*"); onChange(el.value); return; }
        if (key === "e") { e.preventDefault(); wrap(el, "`"); onChange(el.value); return; }
        if (key === "x" && e.shiftKey) { e.preventDefault(); wrap(el, "~~"); onChange(el.value); return; }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const s = el.selectionStart;
        el.setRangeText("  ", s, el.selectionEnd, "end");
        onChange(el.value);
      }
    },
    [onChange],
  );

  return (
    <textarea
      ref={ref}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      onInput={autoResize}
      readOnly={!editable}
      placeholder={placeholder}
      spellCheck={false}
      className={clsx(
        "w-full resize-none overflow-hidden bg-transparent",
        "text-[0.9375rem] leading-[1.65] tracking-[-0.01em]",
        "text-[color:var(--text-0)] placeholder:text-[color:var(--text-2)]/40",
        "outline-none",
        className,
      )}
      style={{ minHeight: 170 }}
    />
  );
}

function wrap(el: HTMLTextAreaElement, m: string) {
  const s = el.selectionStart;
  const e = el.selectionEnd;
  const sel = el.value.slice(s, e);
  el.setRangeText(m + sel + m, s, e, "select");
  el.selectionStart = s + m.length;
  el.selectionEnd = e + m.length;
}
