const SOURCE_ID_RE = /(?:materialId|documentId|sourceMaterialId)\s*=\s*([^,\s;]+)/i;
const SOURCE_ID_GLOBAL_RE = /(?:materialId|documentId|sourceMaterialId)\s*=\s*([^,\s;]+)/gi;
const RAW_MONGO_ID_RE = /^[a-f0-9]{24}$/i;
const RAW_MONGO_ID_GLOBAL_RE = /\b[a-f0-9]{24}\b/gi;
const SOURCE_FILE_EXT_RE = /\.(?:pdf|docx?|pptx?|xlsx?|html?|md|txt)\b/i;
const GENERIC_SOURCE_LABEL_RE = /^(?:course material|source materials?|sources?|tài liệu môn học|nguồn tài liệu(?: đã dùng)?)$/i;

const cleanLabel = (value) => String(value || '').trim();

function stripSourcePrefix(value) {
  return cleanLabel(value)
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/^(?:course material|source materials?|sources?|tài liệu môn học|nguồn tài liệu(?: đã dùng)?)\s*[:,;-]?\s*/i, '')
    .replace(/^[,;:\-\s]+/, '')
    .trim();
}

export function extractSourceFileLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value.flatMap(extractSourceFileLabels))];
  if (typeof value === 'object') {
    const label = getMaterialDisplayName(value);
    return label ? [label] : [];
  }

  return [...new Set(
    String(value || '')
      .split(/[\n;]/)
      .flatMap((chunk) => chunk.split(/,\s+(?=[^,]+\.(?:pdf|docx?|pptx?|xlsx?|html?|md|txt)\b)/i))
      .map(stripSourcePrefix)
      .filter((item) => SOURCE_FILE_EXT_RE.test(item)),
  )];
}

export function extractSourceIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractSourceIds);
  if (typeof value === 'object') {
    return [getMaterialIdFromSource(value)].filter(Boolean);
  }

  const text = cleanLabel(value);
  const ids = [];

  for (const match of text.matchAll(SOURCE_ID_GLOBAL_RE)) {
    if (match?.[1]) ids.push(cleanLabel(match[1]));
  }

  for (const match of text.matchAll(RAW_MONGO_ID_GLOBAL_RE)) {
    if (match?.[0]) ids.push(cleanLabel(match[0]));
  }

  if (ids.length) return [...new Set(ids)];

  return text
    .split(/[,;\n]/)
    .map(cleanLabel)
    .filter(Boolean);
}

export function getMaterialIdFromSource(source) {
  if (!source) return '';
  if (typeof source === 'object') {
    return cleanLabel(source.materialId || source.documentId || source.sourceMaterialId || source.id || source._id);
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
  const fileLabel = stripSourcePrefix(raw);
  if (SOURCE_FILE_EXT_RE.test(fileLabel)) {
    return sourceMap[raw] || sourceMap[fileLabel] || fileLabel;
  }

  const materialId = getMaterialIdFromSource(source);
  return sourceMap[raw] || sourceMap[materialId] || sourceMap[`materialId=${materialId}`] || 'Course material';
}

export function formatSourceLabels(sources, sourceMap = {}) {
  const list = Array.isArray(sources) ? sources : [sources];
  return [...new Set(list.map((source) => formatSourceLabel(source, sourceMap)).filter(Boolean))];
}

export function formatSourceItems(sources, sourceMap = {}) {
  const list = (Array.isArray(sources) ? sources : [sources])
    .flatMap((source) => (
      typeof source === 'string'
        ? (extractSourceFileLabels(source).length ? extractSourceFileLabels(source) : extractSourceIds(source))
        : source
    ));
  const items = [];
  const seenLabels = new Set();
  
  list.forEach((source) => {
    const label = formatSourceLabel(source, sourceMap);
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    
    const rawId = getMaterialIdFromSource(source);
    let id = RAW_MONGO_ID_RE.test(rawId) ? rawId : '';
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
  
  const specificItems = items.filter((item) => !GENERIC_SOURCE_LABEL_RE.test(item.label));
  return specificItems.length ? specificItems : items;
}

export function isMaterialSourceText(value) {
  const text = cleanLabel(value);
  if (extractSourceFileLabels(text).length > 0) return true;
  if (SOURCE_ID_RE.test(text) || RAW_MONGO_ID_RE.test(text)) return true;
  const ids = extractSourceIds(text);
  return ids.length > 0 && ids.every((id) => RAW_MONGO_ID_RE.test(id));
}
