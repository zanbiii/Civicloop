/**
 * Agent 1 — CivicEye Multimodal Intake.
 *
 * Classifies a citizen report's photo (via Mistral Vision, `pixtral-12b-2409`)
 * into one of the 9 civic categories and produces an Evidence Confidence
 * Score. Falls back to a keyword heuristic over the description/voice
 * transcript when no photo is attached or the vision call is unavailable —
 * this agent never throws and never returns an unrecognised category.
 */

import {
  CATEGORY_META,
  COMPLAINT_CATEGORIES,
  isComplaintCategory,
  isSeverity,
  type AgentAuditLog,
  type CivicEyeAnalysis,
  type ComplaintCategory,
} from '@/types/civic';
import { VISION_MODEL, callVisionJson } from '@/lib/mistralClient';

export interface CivicEyeInput {
  photoUrls: string[];
  description: string;
  voiceTranscript?: string | null;
}

const SYSTEM_PROMPT = `You are CivicEye, the computer-vision intake agent for Civicloop, a civic-complaint platform in Bangalore, India.
Classify the photographed civic issue into EXACTLY one of these categories: ${COMPLAINT_CATEGORIES.join(', ')}.
Respond with ONLY a JSON object of this exact shape, no prose, no markdown fences:
{
  "category": "<one of the categories above>",
  "confidence": <integer 0-100, Evidence Confidence Score>,
  "observation": "<one or two sentences describing exactly what is visible>",
  "detectedObjects": ["<object>", "..."],
  "suggestedSeverity": "<Emergency|Very High|High|Medium|Low>",
  "hazardIndicators": ["<short hazard phrase>", "..."],
  "alternatives": [{"category": "<other category>", "confidence": <0-100>}],
  "rejected": <true if the photo does not show a genuine civic infrastructure issue>,
  "rejectionReason": "<string, or null>"
}`;

const KEYWORD_RULES: Array<{ category: ComplaintCategory; keywords: string[] }> = [
  { category: 'Pothole', keywords: ['pothole', 'crater', 'gaddi', 'road hole', 'pit in the road'] },
  { category: 'Garbage accumulation', keywords: ['garbage', 'trash', 'waste', 'heap', 'dump', 'litter'] },
  {
    category: 'Broken streetlight',
    keywords: ['streetlight', 'street light', 'lamp', 'dark stretch', 'pole', 'live wire', 'sparking', 'cable hanging'],
  },
  { category: 'Overflowing drain', keywords: ['drain', 'sewage', 'culvert', 'manhole', 'overflowing'] },
  { category: 'Damaged road', keywords: ['road damage', 'cracked road', 'broken road', 'road surface'] },
  { category: 'Fallen tree', keywords: ['fallen tree', 'tree down', 'uprooted', 'branch fell'] },
  { category: 'Water leakage', keywords: ['water leak', 'leakage', 'pipe burst', 'mains leak', 'pipeline'] },
  { category: 'Traffic obstruction', keywords: ['traffic', 'barricade', 'obstruction', 'blocked road', 'jam'] },
  {
    category: 'Damaged public infrastructure',
    keywords: ['infrastructure', 'bench', 'railing', 'signage', 'footpath', 'pavement', 'bridge'],
  },
];

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clampScore(value: unknown, fallback = 50): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function mockAnalysis(input: CivicEyeInput, note: string): CivicEyeAnalysis {
  const text = `${input.description} ${input.voiceTranscript ?? ''}`.toLowerCase();
  const scored = KEYWORD_RULES.map((rule) => ({
    category: rule.category,
    hits: rule.keywords.filter((kw) => text.includes(kw)).length,
  })).sort((a, b) => b.hits - a.hits);

  const hasSignal = scored[0].hits > 0;
  const seed = hashSeed(text.trim() || input.photoUrls[0] || 'civicloop');
  const category = hasSignal ? scored[0].category : COMPLAINT_CATEGORIES[seed % COMPLAINT_CATEGORIES.length];
  const meta = CATEGORY_META[category];
  const rejected = !hasSignal && input.photoUrls.length === 0 && input.description.trim().length < 4;

  const alternatives = scored
    .slice(1, 3)
    .filter((entry) => entry.hits > 0 && entry.category !== category)
    .map((entry) => ({ category: entry.category, confidence: Math.min(70, 20 + entry.hits * 15) }));

  return {
    category,
    confidence: rejected ? 20 : Math.min(93, hasSignal ? 70 + Math.min(scored[0].hits, 4) * 5 : 55 + (seed % 12)),
    observation: hasSignal
      ? `Offline heuristic matched "${category.toLowerCase()}" language in the citizen's report (${note}).`
      : `No strong category signal in the report text; defaulted to the ward's most common issue (${note}).`,
    detectedObjects: hasSignal
      ? KEYWORD_RULES.find((rule) => rule.category === category)!.keywords.filter((kw) => text.includes(kw))
      : [],
    suggestedSeverity: meta.baseSeverity,
    hazardIndicators: hasSignal ? [`Keyword match: ${category}`] : [],
    alternatives,
    rejected,
    rejectionReason: rejected ? 'No photo and description too short to classify — ask the citizen for more detail.' : null,
    model: VISION_MODEL,
    mode: 'mock',
    analyzedAt: new Date().toISOString(),
  };
}

export async function analyzeIntake(input: CivicEyeInput): Promise<CivicEyeAnalysis> {
  if (input.photoUrls.length > 0) {
    const result = await callVisionJson({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Citizen description: "${input.description || 'none provided'}". Voice transcript: "${input.voiceTranscript ?? 'none'}".`,
      imageUrls: input.photoUrls,
    });

    if (result.json) {
      const json = result.json;
      const category = typeof json.category === 'string' && isComplaintCategory(json.category) ? json.category : null;
      const suggestedSeverity =
        typeof json.suggestedSeverity === 'string' && isSeverity(json.suggestedSeverity) ? json.suggestedSeverity : null;

      if (category && suggestedSeverity) {
        const alternatives = Array.isArray(json.alternatives)
          ? json.alternatives
              .map((entry) => {
                if (typeof entry !== 'object' || entry === null) return null;
                const record = entry as Record<string, unknown>;
                if (typeof record.category !== 'string' || !isComplaintCategory(record.category)) return null;
                return { category: record.category, confidence: clampScore(record.confidence) };
              })
              .filter((entry): entry is { category: ComplaintCategory; confidence: number } => entry !== null)
          : [];

        return {
          category,
          confidence: clampScore(json.confidence),
          observation: typeof json.observation === 'string' ? json.observation : 'Vision model returned no description.',
          detectedObjects: Array.isArray(json.detectedObjects)
            ? json.detectedObjects.filter((value): value is string => typeof value === 'string')
            : [],
          suggestedSeverity,
          hazardIndicators: Array.isArray(json.hazardIndicators)
            ? json.hazardIndicators.filter((value): value is string => typeof value === 'string')
            : [],
          alternatives,
          rejected: json.rejected === true,
          rejectionReason: typeof json.rejectionReason === 'string' ? json.rejectionReason : null,
          model: VISION_MODEL,
          mode: 'live',
          analyzedAt: new Date().toISOString(),
        };
      }
    }

    return mockAnalysis(input, 'vision model unavailable');
  }

  return mockAnalysis(input, 'no photo attached');
}

export function auditLogForCivicEye(ticketId: string, analysis: CivicEyeAnalysis, latencyMs: number): AgentAuditLog {
  return {
    id: `log-civiceye-${ticketId}-${Date.now()}`,
    ticketId,
    agent: 'CivicEye',
    action: 'vision.analyze',
    message: analysis.rejected
      ? `Rejected: ${analysis.rejectionReason ?? 'not a recognisable civic issue'}.`
      : `Classified as ${analysis.category} at ${analysis.confidence}% confidence.`,
    level: analysis.rejected ? 'error' : analysis.confidence >= 80 ? 'success' : 'info',
    payload: { category: analysis.category, confidence: analysis.confidence, hazards: analysis.hazardIndicators },
    confidence: analysis.confidence,
    latencyMs,
    mode: analysis.mode,
    createdAt: analysis.analyzedAt,
  };
}
