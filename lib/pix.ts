/**
 * Parses a small subset of ISO 8601 durations (`P[nD]T[nH][nM][nS]`) into
 * milliseconds. Covers everything Mercado Pago accepts for Pix
 * `expiration_time` (30 minutes to 30 days) without pulling in a date library.
 */
export function isoDurationToMs(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!match) {
    throw new Error(`Duração ISO 8601 inválida: ${duration}`);
  }
  const [, days, hours, minutes, seconds] = match;
  const ms =
    (Number(days ?? 0) * 24 * 60 * 60 +
      Number(hours ?? 0) * 60 * 60 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)) *
    1000;
  return ms;
}
