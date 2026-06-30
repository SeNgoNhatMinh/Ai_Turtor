const SOURCE_ID_RE = /(?:materialId|documentId|sourceMaterialId)\s*=\s*([^,\s;]+)/i;

const cleanLabel = (value) => String(value || '').trim();

export function getMaterialIdFromSource(source) {
  if (!source) return '';
  if (typeof source === 'object') {
    return cleanLabel(source.materialId || source.documentId || source.sourceMaterialId || source.id);
  }

  const text = cleanLabel(source);
  const match = text.match(SOURCE_ID_RE);
  return match?.[1] || text;
}

export function getMaterialDisplayName(material) {
  if (!material) return '';
  return cleanLabel(
    material.fileName ||
    material.filename ||
    material.sourceFileName ||
    material.originalFileName ||
    material.title ||
    material.name,
  );
}

export function buildMaterialSourceMap(materials = []) {
  const map = {};

  (Array.isArray(materials) ? materials : []).forEach((material) => {
    const materialId = getMaterialIdFromSource(material);
    const displayName = getMaterialDisplayName(material);
    if (!materialId || !displayName) return;

    map[materialId] = displayName;
    map[`materialId=${materialId}`] = displayName;
    map[`documentId=${materialId}`] = displayName;
  });

  return map;
}

export function formatSourceLabel(source, sourceMap = {}) {
  if (!source) return '';

  if (typeof source === 'object') {
    const directName = getMaterialDisplayName(source);
    if (directName) return directName;
  }

  const raw = cleanLabel(source);
  const materialId = getMaterialIdFromSource(source);
  return sourceMap[raw] || sourceMap[materialId] || sourceMap[`materialId=${materialId}`] || 'Course material';
}

export function formatSourceLabels(sources, sourceMap = {}) {
  const list = Array.isArray(sources) ? sources : [sources];
  return [...new Set(list.map((source) => formatSourceLabel(source, sourceMap)).filter(Boolean))];
}

export function isMaterialSourceText(value) {
  return SOURCE_ID_RE.test(cleanLabel(value));
}
