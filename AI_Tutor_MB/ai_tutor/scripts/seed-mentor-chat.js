const teacher = db.mentors.findOne({ mentorCode: 'TEACHER_A' });
if (!teacher) {
  print('ERROR: mentor TEACHER_A not found');
  quit(1);
}
const teacherId = teacher._id;
const updated = db.class_sections.updateMany(
  { teacherId: 'TEACHER_A' },
  {
    $set: {
      teacherId: teacherId,
      teacherName: teacher.mentorName,
      teacherEmail: teacher.email,
      updatedAt: new Date(),
    },
  },
);
print('class_sections updated: ' + updated.modifiedCount);

db.mentors.updateOne(
  { _id: teacherId },
  {
    $set: {
      isActive: true,
      verified: true,
      averageRating: 4.8,
      completedMentorSessions: 42,
      responseTimeMinutes: 5,
      maxConcurrentChats: 10,
      currentActiveChatSessions: 0,
      specializations: ['Java', 'Spring Boot', 'Quy định lớp', 'PRJ301'],
      keywords: ['java', 'spring', 'deadline', 'diem', 'nop bai', 'tre', 'PRJ301'],
      teachingClassIds: ['SE1840', 'SE180108'],
      managedCourseIds: ['PRJ301', 'CSI106', 'OSG203', 'PRO192'],
      updatedAt: new Date(),
    },
  },
);

const extras = [
  {
    _id: 'mentor-b-001',
    mentorCode: 'MENTOR_B',
    mentorName: 'Nguyen Thi Mentor B',
    email: 'mentor.b@school.local',
    phone: '0900000001',
    department: 'Software Engineering',
    faculty: 'Information Technology',
    specializations: ['OOP', 'Database', 'Operating Systems'],
    categories: ['COURSE_MENTOR'],
    managedCourseIds: ['CSI106', 'OSG203'],
    teachingClassIds: ['SE180108'],
    isActive: true,
    verified: true,
    averageRating: 4.6,
    completedMentorSessions: 28,
    responseTimeMinutes: 8,
    maxConcurrentChats: 5,
    currentActiveChatSessions: 0,
    keywords: ['oop', 'database', 'sql', 'operating system', 'deadline'],
    createdAt: new Date(),
    updatedAt: new Date(),
    _class: 'com.ragapi.entity.Mentor',
  },
  {
    _id: 'mentor-c-001',
    mentorCode: 'MENTOR_C',
    mentorName: 'Tran Van Mentor C',
    email: 'mentor.c@school.local',
    phone: '0900000002',
    department: 'Software Engineering',
    faculty: 'Information Technology',
    specializations: ['Web', 'Java EE', 'Project'],
    categories: ['COURSE_MENTOR'],
    managedCourseIds: ['PRJ301'],
    teachingClassIds: ['SE180108'],
    isActive: true,
    verified: true,
    averageRating: 4.9,
    completedMentorSessions: 55,
    responseTimeMinutes: 4,
    maxConcurrentChats: 8,
    currentActiveChatSessions: 0,
    keywords: ['web', 'jsp', 'servlet', 'project', 'nop bai'],
    createdAt: new Date(),
    updatedAt: new Date(),
    _class: 'com.ragapi.entity.Mentor',
  },
];

for (const m of extras) {
  const existing = db.mentors.findOne({ mentorCode: m.mentorCode });
  if (existing) {
    db.mentors.updateOne({ _id: existing._id }, { $set: m });
    print('updated mentor ' + m.mentorCode);
  } else {
    db.mentors.insertOne(m);
    print('inserted mentor ' + m.mentorCode);
  }
}

print('DONE teacherId=' + teacherId);
