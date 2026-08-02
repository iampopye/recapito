/**
 * Subject handling for thread matching.
 *
 * Kept in one place so the IDLE path and the polling path cannot drift apart —
 * if they normalised subjects differently, the same conversation would be
 * threaded two different ways depending on which sync mechanism happened to
 * pick the message up.
 */

/**
 * Strip reply/forward prefixes so "Re: Re: Fwd: Invoice" matches "Invoice".
 *
 * Loops rather than applying a fixed number of passes: mail that has been
 * round-tripped through several clients routinely accumulates more than two
 * prefixes, and localised clients add their own ("AW:" in German, "SV:" in
 * Swedish, "VS:" in Finnish). The bracketed-number form ("Re[2]:") is what
 * some older clients emit.
 */
export function normalizeSubject(subject: string): string {
  let out = (subject || '').trim();
  const prefix = /^\s*(re|fwd?|aw|sv|vs|antw|rif|res)\s*(\[\d+\])?\s*:\s*/i;

  // Bounded so a pathological subject of nothing but prefixes cannot spin.
  for (let i = 0; i < 10; i++) {
    const next = out.replace(prefix, '');
    if (next === out) break;
    out = next;
  }

  return out.trim();
}

/**
 * Whether a subject is distinctive enough to thread on.
 *
 * Matching on an empty subject grouped every unrelated subject-less email in
 * the mailbox into one thread — automated notifications, blank replies and
 * bounces all landed together. When a subject carries no information, a new
 * thread is the honest answer.
 */
export function isMeaningfulSubject(normalized: string): boolean {
  if (!normalized) return false;
  const lowered = normalized.toLowerCase();
  return lowered !== '(no subject)' && lowered !== 'no subject' && normalized.length > 1;
}
