const SOURCE_ID_RE = /(?:materialId|documentId|sourceMaterialId)\s*=\s*([^,\s;]+)/i;
const SOURCE_ID_GLOBAL_RE = /(?:materialId|documentId|sourceMaterialId)\s*=\s*([^,\s;]+)/gi;
const RAW_MONGO_ID_RE = /^[a-f0-9]{24}$/i;
const RAW_MONGO_ID_GLOBAL_RE = /\b[a-f0-9]{24}\b/gi;
const SOURCE_FILE_EXT_RE = /\.(?:pdf|docx?|pptx?|xlsx?|html?|md|txt)\b/i;
const REPEATED_SOURCE_FILE_EXT_RE = /(\.(?:pdf|docx?|pptx?|xlsx?|html?|md|txt))(?:\1)+$/i;
const GENERIC_SOURCE_LABEL_RE = /^(?:course material|source materials?|sources?|tài liệu môn học|nguồn tài liệu(?: đã dùng)?)$/i;

const cleanLabel = (value) => String(value || '').trim();

export function normalizeSourceDisplayName(value) {
  let label = cleanLabel(value);
  const wrappers = [
    [/^\*\*([\s\S]+)\*\*$/, '$1'],
    [/^__([\s\S]+)__$/, '$1'],
    [/^`([\s\S]+)`$/, '$1'],
  ];

  wrappers.forEach(([pattern, replacement]) => {
    label = label.replace(pattern, replacement).trim();
  });

  return label
    .replace(/\\([_*`])/g, '$1')
    .replace(/^[*_`]+/, '')
    .replace(/[*_`]+$/, '')
    .replace(REPEATED_SOURCE_FILE_EXT_RE, '$1')
    .trim();
}

function stripSourcePrefix(value) {
  return normalizeSourceDisplayName(value)
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/^(?:course material|source materials?|sources?|tài liệu môn học|nguồn tài liệu(?: đã dùng)?)\s*[:,;-]?\s*/i, '')
    .replace(/^[,;:\-\s]+/, '')
    .trim()
    .replace(REPEATED_SOURCE_FILE_EXT_RE, '$1');
}

export function extractSourceFileLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value.flatMap(extractSourceFileLabels))];
  if (typeof value === 'object') {
    const label = getMaterialDisplayName(value);
    return label ? [label] : [];
  }

  const labels = String(value || '')
    .split(/[\n;]/)
    .flatMap((chunk) => chunk.split(/,\s+(?=[^,]+\.(?:pdf|docx?|pptx?|xlsx?|html?|md|txt)\b)/i))
    .map(stripSourcePrefix)
    .filter((item) => SOURCE_FILE_EXT_RE.test(item));

  return [...new Map(labels.map((label) => [label.toLowerCase(), label])).values()];
}

const toSourceSectionKey = (value) => normalizeSourceDisplayName(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const getSourceSectionLineBody = (line) => String(line || '')
  .trim()
  .replace(/^#{1,6}\s*/, '')
  .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
  .trim();

const isSourceSectionHeading = (line) => {
  const key = toSourceSectionKey(getSourceSectionLineBody(line)).replace(/\s*[:：]\s*$/, '');
  return key === 'nguon tai lieu' || key === 'nguon tai lieu da dung';
};

const isSourceSectionBoundary = (line) => {
  const trimmed = String(line || '').trim();
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  const key = toSourceSectionKey(getSourceSectionLineBody(line));
  return key.startsWith('loai cau tra loi')
    || key.startsWith('do tin cay')
    || key.startsWith('luu y de hoc tot hon');
};

export function extractAnswerSourceLabels(answer) {
  const lines = String(answer || '').replace(/\r\n?/g, '\n').split('\n');
  const labels = [];
  let inSourceSection = false;

  for (const line of lines) {
    if (isSourceSectionHeading(line)) {
      inSourceSection = true;
      continue;
    }
    if (!inSourceSection) continue;
    if (isSourceSectionBoundary(line)) break;
    labels.push(...extractSourceFileLabels(line));
  }

  return [...new Map(labels.map((label) => [label.toLowerCase(), label])).values()];
}

function extractSourceIds(value) {
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

function getMaterialIdFromSource(source) {
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
  return normalizeSourceDisplayName(
    material.fileName ||
    material.filename ||
    material.sourceFileName ||
    material.originalFileName ||
    material.title ||
    material.name ||
    material.label,
  );
}

export function buildMaterialSourceMap(materials = []) {
  const map = { _reverse: {} };

  (Array.isArray(materials) ? materials : []).forEach((material) => {
    const materialId = getMaterialIdFromSource(material);
    const displayName = getMaterialDisplayName(material);
    const rawDisplayName = cleanLabel(
      material.fileName
      || material.filename
      || material.sourceFileName
      || material.originalFileName
      || material.title
      || material.name,
    );
    if (!materialId || !displayName) return;

    map[materialId] = displayName;
    map[`materialId=${materialId}`] = displayName;
    map[`documentId=${materialId}`] = displayName;
    map._reverse[displayName] = materialId;
    if (rawDisplayName) {
      map[rawDisplayName] = displayName;
      map._reverse[rawDisplayName] = materialId;
    }
    map._reverse[materialId] = materialId;
  });

  return map;
}

function formatSourceLabel(source, sourceMap = {}) {
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

export function formatSourceItems(sources, sourceMap = {}) {
  const list = (Array.isArray(sources) ? sources : [sources])
    .flatMap((source) => (
      typeof source === 'string'
        ? (extractSourceFileLabels(source).length ? extractSourceFileLabels(source) : extractSourceIds(source))
        : source
    ));
  const items = [];
  const itemIndexes = new Map();

  list.forEach((source) => {
    const label = normalizeSourceDisplayName(formatSourceLabel(source, sourceMap));
    if (!label) return;

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

    const labelKey = label.toLowerCase();
    const existingIndex = itemIndexes.get(labelKey);
    if (existingIndex != null) {
      if (!items[existingIndex].id && id) items[existingIndex].id = id;
      return;
    }

    itemIndexes.set(labelKey, items.length);
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
