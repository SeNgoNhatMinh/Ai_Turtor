// UX test accounts in tutor_db_loadtest ONLY: give one real teacher and one senior mentor
// (with classes/data) the known password of loadtest001 by copying its password hash.
const d = db.getSiblingDB('tutor_db_loadtest');
const src = d.users.findOne({ email: 'loadtest001@loadtest.local' });
if (!src) throw new Error('loadtest001 missing: run seed_users.py first');
const hashField = ['password', 'passwordHash', 'hashedPassword'].find(f => typeof src[f] === 'string');
const teacherIds = d.class_sections.distinct('teacherId').filter(Boolean);
const teacher = d.users.findOne({ role: 'TEACHER', _id: { $in: teacherIds } }) || d.users.findOne({ role: 'TEACHER' });
const senior = d.users.findOne({ role: { $in: ['SENIOR', 'SENIOR_MENTOR'] } });
const out = {};
for (const [k, u] of Object.entries({ teacher, senior })) {
  if (!u) continue;
  d.users.updateOne({ _id: u._id }, { $set: { [hashField]: src[hashField], isActive: true } });
  out[k] = { email: u.email, role: u.role };
}
out.hashField = hashField;
out.classTeacherField = d.class_sections.findOne({}, { teacherId: 1, teacherIds: 1, mentorId: 1 });
print(JSON.stringify(out));
