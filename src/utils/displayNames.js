const PERSON_NAME_FIELDS = [
  'fullName',
  'name',
  'studentName',
  'studentFullName',
  'teacherName',
  'mentorName',
  'userName',
  'displayName',
];

const PERSON_EMAIL_FIELDS = [
  'email',
  'studentEmail',
  'teacherEmail',
  'mentorEmail',
];

const PERSON_ID_FIELDS = [
  'studentId',
  'studentCode',
  'teacherId',
  'mentorId',
  'userId',
  'id',
  '_id',
];

const OPAQUE_ID_RE = /^(?:[a-f\d]{24}|[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})$/i;
const NESTED_PERSON_FIELDS = ['student', 'user', 'account', 'profile'];

const getPersonRecords = (record) => {
  if (!record || typeof record !== 'object') return [];
  return [
    record,
    ...NESTED_PERSON_FIELDS
      .map((field) => record[field])
      .filter((value) => value && typeof value === 'object'),
  ];
};

const getFirstText = (record, fields) => {
  for (const candidate of getPersonRecords(record)) {
    for (const field of fields) {
      const value = String(candidate[field] || '').trim();
      if (value) return value;
    }
  }
  return '';
};

export const getPersonId = (record) => getFirstText(record, PERSON_ID_FIELDS);

export const getPersonEmail = (record) => getFirstText(record, PERSON_EMAIL_FIELDS);

export const getPersonDisplayName = (record, fallback = 'User') => {
  const name = getFirstText(record, PERSON_NAME_FIELDS);
  if (name && !OPAQUE_ID_RE.test(name)) return name;
  return getPersonEmail(record) || fallback;
};

export const findPersonById = (people = [], id = '') => {
  const target = String(id || '').trim().toLowerCase();
  if (!target) return null;
  return people.find((person) => (
    getPersonId(person).toLowerCase() === target
    || getPersonEmail(person).toLowerCase() === target
  )) || null;
};
