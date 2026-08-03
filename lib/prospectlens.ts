const DEFAULT_API_URL =
  'https://agent.thearena.ai/api/workflows/65d2b97b-19d6-4621-95d7-6ffe2400c90d/execute';
const DEFAULT_API_KEY = 'sk-sim-aqTqmPYK2VyFoSQGH5uHTOGsr-eiY2kD';

export const SELECTED_OUTPUTS: string[] = [
  'loadcandidates.success',
  'loadcandidates.rows',
  'serializecandidates.result',
  'serializeenriched.result',
  'saveenriched.success',
  'saveenriched.row',
  'loadallcontacts.success',
  'loadallcontacts.rows',
  'savecandidates.success',
  'savecandidates.row',
  'identify.candidates',
  'identify.message',
  'apollocontactfinder.content',
  'presentcards.content',
  'formatexport.content',
];

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

const PRIORITY_OUTPUT_KEYS = [
  'presentcards.content',
  'formatexport.content',
  'apollocontactfinder.content',
  'identify.message',
  'serializeenriched.result',
  'serializecandidates.result',
];

const REPLY_KEYS = [
  'reply',
  'content',
  'text',
  'message',
  'output',
  'result',
  'response',
  'answer',
  'chunk',
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
    for (const key of PRIORITY_OUTPUT_KEYS) {
      if (key in record) {
        const found = extractReply(record[key], depth + 1);
        if (found) return found;
      }
    }
    for (const key of Object.keys(record)) {
      if (
        key.endsWith('.content') ||
        key.endsWith('.message') ||
        key.endsWith('.result') ||
        key.endsWith('.text') ||
        key.endsWith('.reply')
      ) {
        const found = extractReply(record[key], depth + 1);
        if (found) return found;
      }
    }
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

export function parseWorkflowResponse(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes('data:')) {
    const chunks: unknown[] = [];
    let streamedText = '';
    for (const line of trimmed.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean.startsWith('data:')) continue;
      const payload = clean.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed: unknown = JSON.parse(payload);
        chunks.push(parsed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          if (typeof record.chunk === 'string') {
            streamedText += record.chunk;
          } else if (typeof record.delta === 'string') {
            streamedText += record.delta;
          }
        }
      } catch {
        streamedText += payload;
      }
    }

    for (let i = chunks.length - 1; i >= 0; i--) {
      const found = extractReply(chunks[i]);
      if (found) return found;
    }
    if (streamedText.trim()) return streamedText.trim();
    return null;
  }

  return extractReply(trimmed);
}

export function redactPhones(text: string): string {
  return text
    .replace(/\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}/g, '[number withheld]')
    .replace(/\+\d{1,3}[\s.-]\d{3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '[number withheld]');
}
