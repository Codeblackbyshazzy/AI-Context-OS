import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface Props {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A Markdown-oriented TipTap editor.
 * Stores content as plain text (Markdown), not HTML.
 * Uses TipTap for the editing experience but serializes back to text.
 */
export function TipTapEditor({ content, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "bg-zinc-800 rounded-lg p-3 font-mono text-sm" } },
        code: { HTMLAttributes: { class: "bg-zinc-800 rounded px-1 py-0.5 font-mono text-sm" } },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing...",
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    editorProps: {
      attributes: {
        class: `prose prose-sm prose-invert max-w-none focus:outline-none px-4 py-3 min-h-[80px] ${className ?? ""}`,
      },
    },
    content: markdownToHtml(content),
    onUpdate: ({ editor }) => {
      // Serialize editor content to plain text / markdown
      const text = editorToMarkdown(editor);
      onChange(text);
    },
  });

  // Sync external content changes (e.g. loading a different memory)
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentText = editorToMarkdown(editor);
      if (currentText !== content) {
        editor.commands.setContent(markdownToHtml(content));
      }
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
}

/**
 * Extract markdown from the TipTap editor using its JSON document structure.
 * This avoids innerHTML/XSS concerns by using TipTap's typed API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editorToMarkdown(editor: any): string {
  const json = editor.getJSON();
  return jsonToMarkdown(json).trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonToMarkdown(node: any): string {
  if (!node) return "";

  if (node.type === "text") {
    let text = node.text ?? "";
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "bold") text = `**${text}**`;
        if (mark.type === "italic") text = `*${text}*`;
        if (mark.type === "code") text = `\`${text}\``;
      }
    }
    return text;
  }

  const children = (node.content ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((child: any) => jsonToMarkdown(child))
    .join("");

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `${children}\n\n`;
    case "heading": {
      const level = node.attrs?.level ?? 1;
      const prefix = "#".repeat(level);
      return `${prefix} ${children}\n\n`;
    }
    case "bulletList":
      return (node.content ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((li: any) => `- ${jsonToMarkdown(li).trim()}`)
        .join("\n") + "\n\n";
    case "orderedList":
      return (node.content ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((li: any, i: number) => `${i + 1}. ${jsonToMarkdown(li).trim()}`)
        .join("\n") + "\n\n";
    case "listItem":
      return children;
    case "codeBlock":
      return `\`\`\`\n${children}\n\`\`\`\n\n`;
    case "blockquote":
      return children
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n") + "\n\n";
    case "hardBreak":
      return "\n";
    default:
      return children;
  }
}

/**
 * Basic Markdown to HTML conversion for TipTap initialization.
 * Handles headings, bold, italic, code blocks, inline code, lists, and paragraphs.
 */
function markdownToHtml(md: string): string {
  if (!md.trim()) return "";

  const lines = md.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inList = false;
  let listType = "";

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        result.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        if (inList) { result.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const h3 = line.match(/^###\s+(.*)/);
    if (h3) {
      if (inList) { result.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
      result.push(`<h3>${inlineFormat(h3[1])}</h3>`);
      continue;
    }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) {
      if (inList) { result.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
      result.push(`<h2>${inlineFormat(h2[1])}</h2>`);
      continue;
    }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) {
      if (inList) { result.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
      result.push(`<h1>${inlineFormat(h1[1])}</h1>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)/);
    if (ul) {
      if (!inList || listType !== "ul") {
        if (inList) result.push(listType === "ul" ? "</ul>" : "</ol>");
        result.push("<ul>");
        inList = true;
        listType = "ul";
      }
      result.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) {
      if (!inList || listType !== "ol") {
        if (inList) result.push(listType === "ul" ? "</ul>" : "</ol>");
        result.push("<ol>");
        inList = true;
        listType = "ol";
      }
      result.push(`<li>${inlineFormat(ol[1])}</li>`);
      continue;
    }

    if (inList) { result.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }

    if (!line.trim()) continue;

    result.push(`<p>${inlineFormat(line)}</p>`);
  }

  if (inList) result.push(listType === "ul" ? "</ul>" : "</ol>");
  if (inCodeBlock) {
    result.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
  }

  return result.join("");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
