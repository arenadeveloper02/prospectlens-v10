"use client"

import { useState } from 'react';
import type { ReactNode } from 'react';

interface MarkdownProps {
  content: string;
}

type Segment =
  | { kind: 'code'; lang: string; body: string }
  | { kind: 'text'; body: string };

function splitFences(content: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', body: content.slice(lastIndex, match.index) });
    }
    segments.push({
      kind: 'code',
      lang: (match[1] ?? '').toLowerCase(),
      body: (match[2] ?? '').replace(/\s+$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ kind: 'text', body: content.slice(lastIndex) });
  }
  return segments;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const parts = text.split(pattern);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(
        <code key={key} className="md-inline-code">
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part.startsWith('[')) {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        nodes.push(
          <a key={key} href={linkMatch[2]} target="_blank" rel="noreferrer" className="md-link">
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(<span key={key}>{part}</span>);
      }
    } else {
      nodes.push(<span key={key}>{part}</span>);
    }
  });
  return nodes;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderTextBlock(body: string, keyPrefix: string): ReactNode[] {
  const lines = body.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;
  let block = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const nextLine = lines[i + 1] ?? '';

    // Markdown table
    if (
      line.trim().startsWith('|') &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(nextLine) &&
      nextLine.includes('-')
    ) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(splitRow(lines[i] ?? ''));
        i += 1;
      }
      nodes.push(
        <div key={`${keyPrefix}-t${block}`} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi}>{renderInline(h, `${keyPrefix}-th${block}-${hi}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell, `${keyPrefix}-td${block}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      block += 1;
      continue;
    }

    // Numbered candidate card
    const numMatch = line.match(/^\s{0,3}(\d{1,2})[.)]\s+(.*)$/);
    if (numMatch && numMatch[1] !== undefined && numMatch[2] !== undefined) {
      const itemLines: string[] = [numMatch[2]];
      i += 1;
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (!next.trim()) break;
        if (/^\s{0,3}\d{1,2}[.)]\s+/.test(next)) break;
        if (next.trim().startsWith('|')) break;
        if (next.trim().startsWith('#')) break;
        itemLines.push(next.trim());
        i += 1;
      }
      nodes.push(
        <div key={`${keyPrefix}-c${block}`} className="md-card">
          <span className="md-card-num">{numMatch[1]}</span>
          <div className="md-card-body">
            {itemLines.map((itemLine, li) => (
              <p key={li} className="md-card-line">
                {renderInline(itemLine, `${keyPrefix}-cl${block}-${li}`)}
              </p>
            ))}
          </div>
        </div>,
      );
      block += 1;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      nodes.push(
        <ul key={`${keyPrefix}-u${block}`} className="md-list">
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `${keyPrefix}-li${block}-${ii}`)}</li>
          ))}
        </ul>,
      );
      block += 1;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch && headingMatch[2] !== undefined) {
      nodes.push(
        <p key={`${keyPrefix}-h${block}`} className="md-heading">
          {renderInline(headingMatch[2], `${keyPrefix}-hh${block}`)}
        </p>,
      );
      block += 1;
      i += 1;
      continue;
    }

    // Paragraph
    if (line.trim()) {
      nodes.push(
        <p key={`${keyPrefix}-p${block}`} className="md-para">
          {renderInline(line, `${keyPrefix}-pp${block}`)}
        </p>,
      );
      block += 1;
    }
    i += 1;
  }

  return nodes;
}

function looksLikeCsv(body: string): boolean {
  const lines = body.split('\n').filter((l) => l.trim());
  return lines.length >= 2 && lines.every((l) => l.includes(','));
}

function CsvBlock({ csv }: { csv: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  const download = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'prospect-lens-contacts.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="md-csv">
      <div className="md-csv-head">
        <span className="md-csv-title">CSV export</span>
        <div className="md-csv-actions">
          <button type="button" className="md-btn" onClick={() => void copy()}>
            {copied ? 'Copied!' : 'Copy CSV'}
          </button>
          <button type="button" className="md-btn md-btn-primary" onClick={download}>
            Download .csv
          </button>
        </div>
      </div>
      <pre className="md-pre">{csv}</pre>
    </div>
  );
}

export function Markdown({ content }: MarkdownProps) {
  const segments = splitFences(content);
  return (
    <div className="md-root">
      {segments.map((segment, si) => {
        if (segment.kind === 'code') {
          const isCsv = segment.lang === 'csv' || (!segment.lang && looksLikeCsv(segment.body));
          if (isCsv) {
            return <CsvBlock key={si} csv={segment.body} />;
          }
          return (
            <pre key={si} className="md-pre">
              {segment.body}
            </pre>
          );
        }
        return <div key={si} className="md-root">{renderTextBlock(segment.body, `s${si}`)}</div>;
      })}
    </div>
  );
}
