const SOURCE_ID_RE = /(?:materialId|documentId|sourceMaterialId)\s*=\s*([^,\s;]+)/i;
const RAW_MONGO_ID_RE = /^[a-f0-9]{24}$/i;

const cleanLabel = (value) => String(value || '').trim();

export function getMaterialIdFromSource(source) {
  if (!source) return '';
  if (typeof source === 'object') {
    return cleanLabel(source.materialId || source.documentId || source.sourceMaterialId || source.id);
  }

  const text = cleanLabel(source);
  const match = text.match(SOURCE_ID_RE);
  if (!match && RAW_MONGO_ID_RE.test(text)) return text;
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
  const map = { _reverse: {} };

  (Array.isArray(materials) ? materials : []).forEach((material) => {
    const materialId = getMaterialIdFromSource(material);
    const displayName = getMaterialDisplayName(material);
    if (!materialId || !displayName) return;

    map[materialId] = displayName;
    map[`materialId=${materialId}`] = displayName;
    map[`documentId=${materialId}`] = displayName;
    map._reverse[displayName] = materialId;
    map._reverse[materialId] = materialId;
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

export function formatSourceItems(sources, sourceMap = {}) {
  const list = Array.isArray(sources) ? sources : [sources];
  const items = [];
  const seenLabels = new Set();
  
  list.forEach((source) => {
    const label = formatSourceLabel(source, sourceMap);
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    
    let id = getMaterialIdFromSource(source);
    // Try to get real MongoDB ID from reverse map if id is just a string filename
    if (sourceMap._reverse && sourceMap._reverse[label]) {
      id = sourceMap._reverse[label];
    } else if (sourceMap._reverse && sourceMap._reverse[id]) {
      id = sourceMap._reverse[id];
    }
    
    // Fallback if source is an object
    if (!id && typeof source === 'object' && source?.id) {
      id = source.id;
    }
    
    items.push({ id, label });
  });
  
  return items;
}

export function isMaterialSourceText(value) {
  const text = cleanLabel(value);
  return SOURCE_ID_RE.test(text) || RAW_MONGO_ID_RE.test(text);
}
