const DEFAULT_API_URL =
  'https://agent.thearena.ai/api/workflows/93554407-b92d-4ec6-ba3c-be07be4c153b/execute';
const DEFAULT_API_KEY = 'sk-sim-W5XWd6ZvGvHrB4qoYLMw_JCEgy_i6YPr';

export interface WorkflowConfig {
  url: string;
  key: string;
}

export function getWorkflowConfig(): WorkflowConfig {
  const envUrl = process.env.PROSPECTLENS_API_URL;
  const envKey = process.env.PROSPECTLENS_API_KEY;
  return {
    url: envUrl && envUrl.trim() ? envUrl.trim() : DEFAULT_API_URL,
    key: envKey && envKey.trim() ? envKey.trim() : DEFAULT_API_KEY,
  };
}

const REPLY_KEYS = [
  'reply',
  'content',
  'text',
  'message',
  'output',
  'result',
  'response',
  'answer',
  'data',
];

export function extractReply(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const nested = extractReply(parsed, depth + 1);
        if (nested) return nested;
      } catch {
        // not JSON — treat as plain text
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractReply(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of REPLY_KEYS) {
      if (key in record) {
        const found = extractReply(record[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return null;
}

export function redactPhones(text: string): string {
  return text
    .replace(/\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g, '[number withheld]')
    .replace(/\+\d{1,3}[\s.-]\d{3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '[number withheld]');
}
