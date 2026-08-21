// Fuzzy party matching and grouping service

export function normalizePartyName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}\-_,.]/g, ' ')
    .replace(/\b(ltd|limited|pvt|private|llp|inc|corp|co|enterprises|traders|company|agency|and|&|a\/c|ac)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function getPartySimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const n1 = normalizePartyName(s1);
  const n2 = normalizePartyName(s2);
  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0;

  const words1 = n1.split(' ').filter(t => t.length > 0);
  const words2 = n2.split(' ').filter(t => t.length > 0);

  // 1. Primary / Anchor word match (e.g. "chambal" matching "chambal fertilisers")
  if (words1.length > 0 && words2.length > 0) {
    const first1 = words1[0];
    const first2 = words2[0];
    if (first1 === first2 && first1.length >= 4) {
      return 0.85 + 0.15 * (Math.min(words1.length, words2.length) / Math.max(words1.length, words2.length));
    }
    if (levenshteinDistance(first1, first2) <= 1 && Math.min(first1.length, first2.length) >= 5) {
      return 0.80 + 0.15 * (Math.min(words1.length, words2.length) / Math.max(words1.length, words2.length));
    }
  }

  // 2. Token overlap with fuzzy spelling tolerance
  let matchedWeight = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2) {
        matchedWeight += 1.0;
        break;
      } else if (levenshteinDistance(w1, w2) <= 1 && Math.min(w1.length, w2.length) >= 4) {
        matchedWeight += 0.85;
        break;
      } else if (levenshteinDistance(w1, w2) <= 2 && Math.min(w1.length, w2.length) >= 7) {
        matchedWeight += 0.75;
        break;
      }
    }
  }

  const tokenScore = (matchedWeight * 2) / (words1.length + words2.length);

  // 3. String containment
  let containmentScore = 0;
  if (n1.includes(n2) || n2.includes(n1)) {
    containmentScore = 0.75 + 0.2 * (Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length));
  }

  return Math.max(tokenScore, containmentScore);
}

/**
 * Given a raw extracted party name, find the best matching ledger from a list of known ledger names
 */
export function findBestPartyLedger(rawName: string, knownLedgers: string[], minScore = 0.55): { match: string; score: number } | null {
  if (!rawName || !knownLedgers || knownLedgers.length === 0) return null;

  const trimmedRaw = rawName.trim();
  let best: string | null = null;
  let maxScore = 0;

  for (const ledger of knownLedgers) {
    if (!ledger) continue;
    const trimmedLedger = ledger.trim();
    if (trimmedRaw.toLowerCase() === trimmedLedger.toLowerCase()) {
      return { match: trimmedLedger, score: 1.0 };
    }
    const score = getPartySimilarity(trimmedRaw, trimmedLedger);
    if (score > maxScore) {
      maxScore = score;
      best = trimmedLedger;
    }
  }

  if (best && maxScore >= minScore) {
    return { match: best, score: maxScore };
  }
  return null;
}

/**
 * Group a list of extracted transactions/items so that name variations map to the single best canonical name
 */
export function groupPartyNamesInTransactions(transactions: any[], existingLedgers: string[] = []): any[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return transactions;

  // Track discovered canonical names within the batch
  const batchCanonicMap = new Map<string, string>();

  return transactions.map(txn => {
    const rawParty = (txn.partyName || txn.bankPartyName || '').trim();
    if (!rawParty || rawParty.toLowerCase() === 'upi' || rawParty.toLowerCase() === 'suspense') {
      return txn;
    }

    // 1. Try matching against existing company ledgers in Tally/DB
    const existingMatch = findBestPartyLedger(rawParty, existingLedgers, 0.55);
    if (existingMatch) {
      return {
        ...txn,
        rawExtractedParty: rawParty,
        partyName: existingMatch.match
      };
    }

    // 2. Try matching against other party names in this batch
    for (const [canonical, target] of batchCanonicMap.entries()) {
      const sim = getPartySimilarity(rawParty, canonical);
      if (sim >= 0.60) {
        return {
          ...txn,
          rawExtractedParty: rawParty,
          partyName: target
        };
      }
    }

    // If new, use the most descriptive version as canonical
    batchCanonicMap.set(rawParty, rawParty);
    return txn;
  });
}
