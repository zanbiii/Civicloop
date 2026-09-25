/**
 * Civicloop — Mistral client wrapper.
 *
 * Every agent call goes through here so there is exactly one place that
 * decides "live" vs "mock": no `MISTRAL_API_KEY`, a network failure, a rate
 * limit, or a non-JSON response all fall back to `{ json: null }` instead of
 * throwing. Callers always get a value back and apply their own offline
 * heuristic when `json` is null — the app never crashes on a missing key.
 */

import { Mistral } from '@mistralai/mistralai';
import type { AgentRunMode } from '@/types/civic';

export const VISION_MODEL = 'pixtral-12b-2409';
export const REASONING_MODEL = 'mistral-large-latest';

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; imageUrl: string };

let cachedClient: Mistral | null | undefined;

function getClient(): Mistral | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return cachedClient;
  }
  try {
    cachedClient = new Mistral({ apiKey });
  } catch {
    cachedClient = null;
  }
  return cachedClient;
}

export function isMistralLive(): boolean {
  return getClient() !== null;
}

export interface AgentCallResult {
  mode: AgentRunMode;
  json: Record<string, unknown> | null;
  errorMessage: string | null;
  model: string;
  latencyMs: number;
}

function extractText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    for (const chunk of content) {
      if (chunk && typeof chunk === 'object' && typeof (chunk as { text?: unknown }).text === 'string') {
        return (chunk as { text: string }).text;
      }
    }
  }
  return null;
}

function extractJsonBlock(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function runJsonCompletion(params: {
  model: string;
  systemPrompt: string;
  userContent: string | ContentPart[];
}): Promise<AgentCallResult> {
  const startedAt = Date.now();
  const client = getClient();

  if (!client) {
    return {
      mode: 'mock',
      json: null,
      errorMessage: 'MISTRAL_API_KEY not configured — running the offline mock agent.',
      model: params.model,
      latencyMs: Date.now() - startedAt,
    };
  }

  try {
    const response = await client.chat.complete({
      model: params.model,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userContent as never },
      ],
    });

    const text = extractText(response.choices?.[0]?.message?.content);
    const json = text ? extractJsonBlock(text) : null;

    return {
      mode: json ? 'live' : 'mock',
      json,
      errorMessage: json ? null : 'Mistral response was not valid JSON — falling back to the offline heuristic.',
      model: params.model,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      mode: 'mock',
      json: null,
      errorMessage: error instanceof Error ? error.message : 'Unknown Mistral API error.',
      model: params.model,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function callVisionJson(params: {
  systemPrompt: string;
  userPrompt: string;
  imageUrls: string[];
}): Promise<AgentCallResult> {
  const content: ContentPart[] = [
    { type: 'text', text: params.userPrompt },
    ...params.imageUrls.filter(Boolean).map((url): ContentPart => ({ type: 'image_url', imageUrl: url })),
  ];
  return runJsonCompletion({ model: VISION_MODEL, systemPrompt: params.systemPrompt, userContent: content });
}

export async function callReasoningJson(params: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<AgentCallResult> {
  return runJsonCompletion({ model: REASONING_MODEL, systemPrompt: params.systemPrompt, userContent: params.userPrompt });
}
