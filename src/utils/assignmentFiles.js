export const ASSIGNMENT_MAX_FILE_BYTES = 50 * 1024 * 1024;

const ASSIGNMENT_FILE_EXTENSIONS = Object.freeze([
  'zip',
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'md',
  'java',
  'py',
  'js',
  'ts',
  'html',
  'css',
]);

const ANSWER_KEY_FILE_EXTENSIONS = Object.freeze(['docx', 'pdf', 'txt']);

export const ASSIGNMENT_FILE_ACCEPT = ASSIGNMENT_FILE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(',');

export const ANSWER_KEY_FILE_ACCEPT = ANSWER_KEY_FILE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(',');

export function getFileExtension(fileName) {
  const name = String(fileName || '').trim();
  const dotIndex = name.lastIndexOf('.');
  return dotIndex < 0 ? '' : name.slice(dotIndex + 1).toLowerCase();
}

function validateFile(file, allowedExtensions, label) {
  if (!file) return { ok: false, message: `Please choose ${label} first.` };
  if (file.size > ASSIGNMENT_MAX_FILE_BYTES) {
    return { ok: false, message: 'File is too large. Maximum size is 50 MB.' };
  }

  const extension = getFileExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    return {
      ok: false,
      message: `Unsupported file type. Allowed: ${allowedExtensions.map((item) => item.toUpperCase()).join(', ')}.`,
    };
  }

  return { ok: true, value: file, extension };
}

export function validateAssignmentFile(file) {
  return validateFile(file, ASSIGNMENT_FILE_EXTENSIONS, 'an assignment file');
}

export function validateAnswerKeyFile(file) {
  return validateFile(file, ANSWER_KEY_FILE_EXTENSIONS, 'an answer key file');
}
