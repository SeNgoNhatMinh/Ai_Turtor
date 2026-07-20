const WINDOWS_1252_BYTES = new Map([
  ['€', 0x80], ['‚', 0x82], ['ƒ', 0x83], ['„', 0x84], ['…', 0x85],
  ['†', 0x86], ['‡', 0x87], ['ˆ', 0x88], ['‰', 0x89], ['Š', 0x8a],
  ['‹', 0x8b], ['Œ', 0x8c], ['Ž', 0x8e], ['‘', 0x91], ['’', 0x92],
  ['“', 0x93], ['”', 0x94], ['•', 0x95], ['–', 0x96], ['—', 0x97],
  ['˜', 0x98], ['™', 0x99], ['š', 0x9a], ['›', 0x9b], ['œ', 0x9c],
  ['ž', 0x9e], ['Ÿ', 0x9f],
]);

const MOJIBAKE_MARKERS = /(?:�|[ÂÃÄÆ]|[aá][º»]|á[º»]|â[-¿‘-™])/gu;

const countMojibakeMarkers = (value) => (
  String(value || '').match(MOJIBAKE_MARKERS)?.length || 0
);

const toLegacyBytes = (value) => {
  const bytes = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const mappedByte = WINDOWS_1252_BYTES.get(character);
    if (mappedByte == null) return null;
    bytes.push(mappedByte);
  }
  return Uint8Array.from(bytes);
};

const decodeLegacyUtf8 = (value) => {
  const bytes = toLegacyBytes(value);
  if (!bytes) return value;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
};

/** Repairs UTF-8 text that was accidentally decoded as Windows-1252/Latin-1. */
export function repairMojibake(value) {
  const original = String(value ?? '').normalize('NFC');
  let current = original;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const currentScore = countMojibakeMarkers(current);
    if (currentScore === 0) break;
    const candidate = decodeLegacyUtf8(current);
    if (candidate === current || candidate.includes('�')) break;
    if (countMojibakeMarkers(candidate) >= currentScore) break;
    current = candidate;
  }

  return current.normalize('NFC');
}

/** Keeps valid Vietnamese text in the canonical Unicode form used by the UI. */
export function normalizeUnicodeText(value) {
  return repairMojibake(value);
}

export function hasBrokenTextEncoding(value) {
  return countMojibakeMarkers(value) > 0;
}
