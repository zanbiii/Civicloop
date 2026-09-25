/**
 * Agent 5 — CivicProof Verification & Closure.
 *
 * Signature feature: no complaint can be closed without verified proof. When
 * an authority submits an "after" photo, this agent compares it against the
 * original "before" photo with Mistral Vision to confirm the same landmarks
 * and a genuine repair, and rejects mismatched or fraudulent submissions.
 * Offline, it never fabricates a "verified" verdict — it holds the ticket for
 * manual review instead.
 */

import type { AgentAuditLog, CivicProofVerification, EvidencePhoto } from '@/types/civic';
import { VISION_MODEL, callVisionJson } from '@/lib/mistralClient';

const SYSTEM_PROMPT = `You are CivicProof, the before/after closure-verification agent for Civicloop.
You are shown a BEFORE photo of a civic issue and an AFTER photo an authority submitted as proof of repair.
Decide whether they show the SAME physical location (matching landmarks) AND whether the defect is genuinely fixed.
Respond with ONLY JSON of this exact shape, no prose, no markdown fences:
{
  "verdict": "verified" | "rejected" | "inconclusive",
  "confidence": <0-100>,
  "landmarkMatch": <0-100, confidence the two photos are the same place>,
  "repairEvidence": <0-100, confidence the defect is actually gone>,
  "landmarksMatched": ["<fixed landmark>", "..."],
  "discrepancies": ["<mismatch or concern>", "..."],
  "summary": "<two sentences for the citizen and the authority>"
}`;

export interface CivicProofInput {
  /** Null when the citizen filed a text/voice-only report, so there is nothing to compare against. */
  beforePhoto: EvidencePhoto | null;
  afterPhoto: EvidencePhoto;
  submittedBy: string;
}

function clamp(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Offline fallback: there is no pixel data to reason about without a live
 * vision model, so this stays deliberately conservative — it always returns
 * `inconclusive` and defers to a human rather than ever fabricating a
 * "verified" closure.
 */
function mockVerification(input: CivicProofInput, beforePhoto: EvidencePhoto): CivicProofVerification {
  const geoMatches =
    beforePhoto.geo && input.afterPhoto.geo
      ? Math.abs(beforePhoto.geo.lat - input.afterPhoto.geo.lat) < 0.001 &&
        Math.abs(beforePhoto.geo.lng - input.afterPhoto.geo.lng) < 0.001
      : false;

  return {
    verdict: 'inconclusive',
    confidence: geoMatches ? 55 : 30,
    landmarkMatch: geoMatches ? 60 : 25,
    repairEvidence: 40,
    landmarksMatched: geoMatches ? ['Geotag matches the original report location'] : [],
    discrepancies: geoMatches
      ? ['Offline mode cannot visually confirm the repair — flagged for manual review.']
      : ['No live vision model available and the after-photo has no matching geotag — flagged for manual review.'],
    summary: 'The vision model was unavailable, so this proof was held for manual authority/citizen review instead of being auto-verified.',
    beforePhotoId: beforePhoto.id,
    afterPhotoId: input.afterPhoto.id,
    submittedBy: input.submittedBy,
    model: VISION_MODEL,
    mode: 'mock',
    verifiedAt: new Date().toISOString(),
  };
}

function noBaselineVerification(input: CivicProofInput): CivicProofVerification {
  return {
    verdict: 'inconclusive',
    confidence: 0,
    landmarkMatch: 0,
    repairEvidence: 0,
    landmarksMatched: [],
    discrepancies: ['The original report had no photo, so there is no before frame to compare against.'],
    summary: 'No before photo is on file for this ticket, so the fix was handed to the citizen to confirm in person.',
    beforePhotoId: 'none',
    afterPhotoId: input.afterPhoto.id,
    submittedBy: input.submittedBy,
    model: VISION_MODEL,
    mode: 'mock',
    verifiedAt: new Date().toISOString(),
  };
}

export async function verifyProof(input: CivicProofInput): Promise<CivicProofVerification> {
  const { beforePhoto } = input;
  if (!beforePhoto) return noBaselineVerification(input);

  const result = await callVisionJson({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Before photo caption: "${beforePhoto.caption ?? 'none'}". After photo caption: "${
      input.afterPhoto.caption ?? 'none'
    }". Submitted by: ${input.submittedBy}.`,
    imageUrls: [beforePhoto.url, input.afterPhoto.url],
  });

  if (result.json) {
    const verdict = result.json.verdict;
    if (verdict === 'verified' || verdict === 'rejected' || verdict === 'inconclusive') {
      const json = result.json;
      return {
        verdict,
        confidence: clamp(json.confidence, 50),
        landmarkMatch: clamp(json.landmarkMatch, 50),
        repairEvidence: clamp(json.repairEvidence, 50),
        landmarksMatched: Array.isArray(json.landmarksMatched)
          ? json.landmarksMatched.filter((value): value is string => typeof value === 'string')
          : [],
        discrepancies: Array.isArray(json.discrepancies)
          ? json.discrepancies.filter((value): value is string => typeof value === 'string')
          : [],
        summary: typeof json.summary === 'string' ? json.summary : 'Vision model returned no summary.',
        beforePhotoId: beforePhoto.id,
        afterPhotoId: input.afterPhoto.id,
        submittedBy: input.submittedBy,
        model: VISION_MODEL,
        mode: 'live',
        verifiedAt: new Date().toISOString(),
      };
    }
  }

  return mockVerification(input, beforePhoto);
}

export function auditLogForProof(ticketId: string, verification: CivicProofVerification, latencyMs: number): AgentAuditLog {
  return {
    id: `log-proof-${ticketId}-${Date.now()}`,
    ticketId,
    agent: 'CivicProof',
    action: verification.verdict === 'verified' ? 'proof.verify' : verification.verdict === 'rejected' ? 'proof.reject' : 'proof.review',
    message: verification.summary,
    level: verification.verdict === 'verified' ? 'success' : verification.verdict === 'rejected' ? 'error' : 'warning',
    payload: { verdict: verification.verdict, landmarkMatch: verification.landmarkMatch, repairEvidence: verification.repairEvidence },
    confidence: verification.confidence,
    latencyMs,
    mode: verification.mode,
    createdAt: verification.verifiedAt,
  };
}
