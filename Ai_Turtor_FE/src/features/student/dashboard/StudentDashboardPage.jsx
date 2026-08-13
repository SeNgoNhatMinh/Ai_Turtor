import { ArrowRight, BookOpen, Bot, ClipboardCheck, GraduationCap, Layers3, MessageCircle, Sparkles } from 'lucide-react';
import './StudentDashboardPage.css';

const courseCode = (item) => item?.courseId || item?.courseCode || item?.course?.courseId || item?.course?.id || '';
const courseName = (item) => item?.courseName || item?.courseTitle || item?.course?.name || 'Môn học đang tham gia';
const classCode = (item) => item?.classCode || item?.classId || item?.classSection?.classCode || item?.classSection?.classId || '';

export default function StudentDashboardPage({ currentUser, courseId, setCourseId, setClassId, switchTab, enrollment }) {
  const enrollments = enrollment?.studentEnrollments || [];
  const name = currentUser?.fullName || currentUser?.name || currentUser?.username || 'bạn';
  const courses = Array.from(new Map(enrollments.map((item) => [courseCode(item), item]).filter(([id]) => id)).values());
  const classCount = new Set(enrollments.map(classCode).filter(Boolean)).size;
  const openCourse = (item) => {
    setCourseId?.(courseCode(item));
    setClassId?.(classCode(item));
    switchTab?.('student-chat');
  };
  const actions = [
    [Bot, 'Hỏi AI Tutor', 'Học theo tài liệu môn học', 'student-chat', 'blue'],
    [ClipboardCheck, 'Làm quiz', 'Luyện tập và kiểm tra nhanh', 'student-quizzes', 'orange'],
    [BookOpen, 'Xem học liệu', 'Tài liệu và bài tập môn học', 'student-materials', 'green'],
    [MessageCircle, 'Hỏi giảng viên', 'Theo dõi yêu cầu hỗ trợ', 'student-escalation', 'purple'],
  ];

  return <main className="student-dashboard">
    <section className="student-dashboard-hero">
      <div><span className="student-dashboard-eyebrow"><Sparkles size={15}/> Không gian học tập của bạn</span><h1>Chào {name}, hôm nay mình học gì?</h1><p>Theo dõi các môn đang tham gia và tiếp tục buổi học chỉ trong một chạm.</p><button type="button" onClick={() => switchTab?.('student-chat')}>Bắt đầu học với AI <ArrowRight size={18}/></button></div>
      <img src="/favicon.jpg" alt="Linh vật FPT University AI Tutor"/>
    </section>
    <section className="student-dashboard-stats" aria-label="Tổng quan học tập">
      <article><span><GraduationCap size={21}/></span><div><strong>{courses.length}</strong><small>Môn đang học</small></div></article>
      <article><span><Layers3 size={21}/></span><div><strong>{classCount}</strong><small>Lớp đang tham gia</small></div></article>
      <article><span><BookOpen size={21}/></span><div><strong>{courseId || '—'}</strong><small>Môn đang chọn</small></div></article>
    </section>
    <div className="student-dashboard-content-grid">
    <section className="student-dashboard-section student-dashboard-courses">
      <header className="student-dashboard-heading"><div><span>Môn học của tôi</span><h2>Tiếp tục hành trình học tập</h2></div><button type="button" onClick={() => switchTab?.('student-materials')}>Xem học liệu <ArrowRight size={16}/></button></header>
      {enrollment?.isStudentEnrollmentsLoading ? <div className="student-dashboard-empty">Đang tải danh sách môn học...</div> : courses.length ? <div className="student-course-grid">{courses.map((item, index) => {
        const id = courseCode(item); const classes = enrollments.filter((entry) => courseCode(entry) === id).map(classCode).filter(Boolean);
        return <article className={`student-course-card course-tone-${index % 4}`} key={id}><div className="student-course-top"><span>{id}</span><small>Đang học</small></div><div className="student-course-icon"><BookOpen size={25}/></div><h3>{courseName(item)}</h3><p>{classes.length ? `Lớp ${classes.join(', ')}` : 'Đã ghi danh vào môn học'}</p><button type="button" onClick={() => openCourse(item)}>Vào môn học <ArrowRight size={17}/></button></article>;
      })}</div> : <div className="student-dashboard-empty"><GraduationCap size={34}/><strong>Chưa tìm thấy môn học đang tham gia</strong><span>Danh sách sẽ xuất hiện khi dữ liệu ghi danh được đồng bộ.</span></div>}
    </section>
    <section className="student-dashboard-section student-dashboard-actions"><header className="student-dashboard-heading"><div><span>Truy cập nhanh</span><h2>Bạn muốn làm gì tiếp theo?</h2></div></header><div className="student-quick-grid">{actions.map(([Icon,title,text,tab,tone]) => <button type="button" className={`student-quick-card ${tone}`} onClick={() => switchTab?.(tab)} key={tab}><span><Icon size={21}/></span><div><strong>{title}</strong><small>{text}</small></div><ArrowRight size={17}/></button>)}</div></section>
    </div>
  </main>;
}
