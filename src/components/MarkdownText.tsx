import type { ReactNode } from 'react';

function inlineContent(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+)/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (markdownLink) {
      return <a key={index} href={markdownLink[2]} target="_blank" rel="noopener noreferrer">{markdownLink[1]}</a>;
    }

    if (/^https?:\/\//.test(part)) {
      return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all">{part}</a>;
    }

    return part;
  });
}

export default function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  if (!text.trim()) return null;

  return (
    <div className={`rich-text ${className}`}>
      {text.split(/\n{2,}/).map((paragraph, paragraphIndex) => {
        const lines = paragraph.split('\n');
        const isList = lines.every((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line));

        if (isList) {
          return (
            <ul key={paragraphIndex}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{inlineContent(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={paragraphIndex}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>{lineIndex > 0 && <br />}{inlineContent(line)}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
