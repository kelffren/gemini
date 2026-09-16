/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY QA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET BIT RATCHET LOSSLESS RGBA HASH REGRESSION MONOTONIC BYTES
 * purpose: compare two asset budget snapshots and forbid larger encodings when decoded RGBA information is unchanged
 * public-api: compareAssetBitSnapshots()
 * state-owned: none; pure report comparison
 * online: N/A; build/publish-time QA only
 * do-not: mutate, delete, alias or rewrite assets
 */

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function byFile(report) {
  const map = new Map();
  for (const item of Array.isArray(report?.files) ? report.files : []) {
    if (!item?.file) continue;
    map.set(String(item.file), item);
  }
  return map;
}

function duplicatePotential(report, kind = 'rgbaExact') {
  const groups = report?.duplicates?.[kind];
  if (!Array.isArray(groups)) return 0;
  return groups.reduce((sum, group) => sum + number(group?.potentialStoredSavingBytes), 0);
}

export function compareAssetBitSnapshots(baseReport, headReport, options = {}) {
  if (!baseReport || !headReport) throw new Error('ASSET_BIT_RATCHET_REPORTS_REQUIRED');
  const base = byFile(baseReport);
  const head = byFile(headReport);
  const toleranceBytes = Math.max(0, Math.trunc(number(options.toleranceBytes)));
  const regressions = [];
  const improvements = [];
  const unchanged = [];
  const informationChanged = [];
  const added = [];
  const removed = [];
  let comparableBytesBefore = 0;
  let comparableBytesAfter = 0;

  for (const [file, next] of head) {
    const previous = base.get(file);
    if (!previous) {
      added.push({ file, bytes: number(next.storedBytes) });
      continue;
    }

    const previousRgba = String(previous.rgbaSha256 || '');
    const nextRgba = String(next.rgbaSha256 || '');
    const previousBytes = number(previous.storedBytes);
    const nextBytes = number(next.storedBytes);

    if (!previousRgba || !nextRgba || previousRgba !== nextRgba) {
      informationChanged.push({
        file,
        beforeBytes: previousBytes,
        afterBytes: nextBytes,
        beforeRgbaSha256: previousRgba || null,
        afterRgbaSha256: nextRgba || null,
        sameRenderHash: Boolean(previous.renderSha256 && previous.renderSha256 === next.renderSha256)
      });
      continue;
    }

    comparableBytesBefore += previousBytes;
    comparableBytesAfter += nextBytes;
    const deltaBytes = nextBytes - previousBytes;
    const record = { file, beforeBytes: previousBytes, afterBytes: nextBytes, deltaBytes, rgbaSha256: nextRgba };
    if (deltaBytes > toleranceBytes) regressions.push(record);
    else if (deltaBytes < 0) improvements.push({ ...record, savedBytes: -deltaBytes });
    else unchanged.push(record);
  }

  for (const [file, previous] of base) {
    if (!head.has(file)) removed.push({ file, bytes: number(previous.storedBytes) });
  }

  const baseStoredBytes = number(baseReport?.totals?.storedBytes);
  const headStoredBytes = number(headReport?.totals?.storedBytes);
  const baseDecodedBytes = number(baseReport?.totals?.decodedRgbaBytes);
  const headDecodedBytes = number(headReport?.totals?.decodedRgbaBytes);
  const comparableSavedBytes = Math.max(0, comparableBytesBefore - comparableBytesAfter);
  const comparableRegressionBytes = Math.max(0, comparableBytesAfter - comparableBytesBefore);

  return {
    schema: 'kelo-asset-bit-ratchet-v1',
    pass: regressions.length === 0,
    toleranceBytes,
    summary: {
      baseFiles: base.size,
      headFiles: head.size,
      comparableFiles: improvements.length + unchanged.length + regressions.length,
      improvedFiles: improvements.length,
      regressedFiles: regressions.length,
      unchangedFiles: unchanged.length,
      informationChangedFiles: informationChanged.length,
      addedFiles: added.length,
      removedFiles: removed.length,
      comparableBytesBefore,
      comparableBytesAfter,
      comparableSavedBytes,
      comparableRegressionBytes,
      totalStoredBytesBefore: baseStoredBytes,
      totalStoredBytesAfter: headStoredBytes,
      totalStoredDeltaBytes: headStoredBytes - baseStoredBytes,
      decodedRgbaBytesBefore: baseDecodedBytes,
      decodedRgbaBytesAfter: headDecodedBytes,
      decodedRgbaDeltaBytes: headDecodedBytes - baseDecodedBytes,
      rgbaDuplicatePotentialBefore: duplicatePotential(baseReport, 'rgbaExact'),
      rgbaDuplicatePotentialAfter: duplicatePotential(headReport, 'rgbaExact'),
      renderDuplicatePotentialBefore: duplicatePotential(baseReport, 'renderExact'),
      renderDuplicatePotentialAfter: duplicatePotential(headReport, 'renderExact')
    },
    regressions,
    improvements,
    unchanged,
    informationChanged,
    added,
    removed,
    rule: 'When file path and decoded RGBA SHA-256 are unchanged, stored bytes may only stay equal or decrease.'
  };
}
