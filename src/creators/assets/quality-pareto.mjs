/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PARETO FRONTIER SIZE QUALITY TRADEOFF CANDIDATE
 * purpose: expose the non-dominated size/quality frontier instead of hiding every tradeoff behind one winner
 * public-api: buildQualityParetoFrontier()
 * state-owned: none
 * online: N/A; build-time analysis
 */

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildQualityParetoFrontier(candidates = []) {
  const valid = candidates
    .filter(candidate => candidate && candidate.pass !== false && Number.isFinite(Number(candidate.bytes)))
    .map(candidate => ({
      label:String(candidate.label || 'candidate'),
      format:String(candidate.format || candidate.kind || 'png'),
      bytes:Number(candidate.bytes),
      score:number(candidate.score ?? candidate.qualityScore, candidate.metrics?.exactPixels ? 1 : 0),
      exactPixels:Boolean(candidate.metrics?.exactPixels ?? candidate.exactPixels),
      track:candidate.track || null
    }));

  const frontier = valid.filter(candidate => !valid.some(other => {
    if (other === candidate) return false;
    const noLarger = other.bytes <= candidate.bytes;
    const noWorseQuality = other.score >= candidate.score;
    const strictlyBetter = other.bytes < candidate.bytes || other.score > candidate.score;
    return noLarger && noWorseQuality && strictlyBetter;
  }));

  frontier.sort((a, b) => a.bytes - b.bytes || b.score - a.score);
  if (!frontier.length) return [];
  const largest = Math.max(...frontier.map(item => item.bytes));
  return frontier.map((item, index) => ({
    ...item,
    order:index + 1,
    relativeBytes:Number((item.bytes / Math.max(1, largest)).toFixed(6))
  }));
}
