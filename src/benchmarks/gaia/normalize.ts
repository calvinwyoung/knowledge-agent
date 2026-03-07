/**
 * Normalize an answer string for GAIA-style comparison.
 * Each step targets common surface-level variations (articles, punctuation, whitespace) that shouldn't count as wrong answers.
 */
export function normalizeAnswer(answer: string): string {
  let s = answer.trim().toLowerCase();

  // Strip leading articles
  s = s.replace(/^(the|a|an)\s+/i, '');

  // Strip trailing punctuation
  s = s.replace(/[.,;:!?]+$/, '');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ');

  return s.trim();
}

/**
 * Parse a string as a number, stripping locale-style formatting like commas and spaces (e.g. "1,000" vs "1000").
 */
function parseNumeric(s: string): number | null {
  const cleaned = s.replace(/,/g, '').replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * GAIA-specific answer comparison using a lenient fallback chain: exact match, then
 * numeric equivalence, then substring containment. This follows GAIA's evaluation spec,
 * which accepts answers that are semantically correct even if formatting differs.
 */
export function gaiaAnswersMatch(modelAnswer: string, expectedAnswer: string): boolean {
  const normModel = normalizeAnswer(modelAnswer);
  const normExpected = normalizeAnswer(expectedAnswer);

  if (normModel === normExpected) {
    return true;
  }

  // Try numeric comparison.
  const numModel = parseNumeric(normModel);
  const numExpected = parseNumeric(normExpected);
  if (numModel !== null && numExpected !== null) {
    return numModel === numExpected;
  }

  // Check if model answer contains the expected answer as a whole token, so
  // "the answer is 17" matches "17" but "17000" does not.
  const escaped = normExpected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(normModel);
}
