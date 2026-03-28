import Link from "next/link";
import type { ReactNode } from "react";

type PolicyMarkdownProps = {
  source: string;
  directives?: Record<string, ReactNode>;
};

type MarkdownBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "directive"; name: string };

const parseBlocks = (source: string): MarkdownBlock[] => {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({
        type: "heading",
        text: trimmed.slice(3).trim()
      });
      index += 1;
      continue;
    }

    if (/^\[\[[A-Z0-9_]+\]\]$/.test(trimmed)) {
      blocks.push({
        type: "directive",
        name: trimmed.slice(2, -2)
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!current.startsWith("- ")) {
          break;
        }

        items.push(current.slice(2).trim());
        index += 1;
      }

      blocks.push({
        type: "list",
        items
      });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || current.startsWith("## ") || current.startsWith("- ")) {
        break;
      }

      paragraphLines.push(current);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ")
    });
  }

  return blocks;
};

const renderInline = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const label = match[1];
    const href = match[2];
    if (href.startsWith("/")) {
      nodes.push(
        <Link key={`${href}-${match.index}`} href={href}>
          {label}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={`${href}-${match.index}`}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
        >
          {label}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export function PolicyMarkdown({ source, directives = {} }: PolicyMarkdownProps) {
  const blocks = parseBlocks(source);

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h2 key={`heading-${index}`}>{renderInline(block.text)}</h2>;
        }

        if (block.type === "list") {
          return (
            <ul key={`list-${index}`} className="legal-list">
              {block.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "directive") {
          return <div key={`directive-${index}`}>{directives[block.name] ?? null}</div>;
        }

        return <p key={`paragraph-${index}`}>{renderInline(block.text)}</p>;
      })}
    </>
  );
}
