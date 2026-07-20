import { lazy, Suspense } from 'react';
import { BookOpen, GraduationCap, Pencil } from 'lucide-react';
import FptWordmark from './FptWordmark';

const RobotHeadMascot = lazy(() => import('../../../components/RobotHeadMascot'));

const BENEFITS = [
  {
    icon: BookOpen,
    title: 'Hỏi đáp theo môn học',
    description: 'Đặt câu hỏi với ngữ cảnh từ học liệu của môn.',
  },
  {
    icon: Pencil,
    title: 'Kiểm tra mã nguồn',
    description: 'Nhận hướng dẫn cải thiện bài tập lập trình.',
  },
  {
    icon: GraduationCap,
    title: 'Hỗ trợ từ giảng viên',
    description: 'Chuyển câu hỏi phức tạp tới giảng viên phù hợp.',
  },
];

function LoginMascotFallback() {
  return <div className="login-robot-fallback" aria-hidden="true" />;
}

function LoginBrandPanel() {
  return (
    <section className="login-brand-panel" aria-label="Giới thiệu FPT University AI Tutor">
      <div className="login-brand-kicker">Nền tảng học tập hỗ trợ bởi AI</div>

      <div className="login-mascot-stage">
        <div className="login-robot-wrap">
          <Suspense fallback={<LoginMascotFallback />}>
            <RobotHeadMascot
              size={210}
              talking
              ariaLabel="Robot AI Tutor giới thiệu thông điệp học tập FPT"
              className="login-robot-head"
            />
          </Suspense>
          <div className="login-speech-bubble" aria-label="Thông điệp học tập">
            <span>Học tập chủ động</span>
            <strong>Kiến tạo tương lai</strong>
          </div>
        </div>
      </div>

      <h1><FptWordmark /> University AI Tutor</h1>
      <p>
        Học hiệu quả hơn với AI theo môn học, hướng dẫn mã nguồn và hỗ trợ từ giảng viên trong cùng một không gian.
      </p>

      <div className="login-benefit-grid">
        {BENEFITS.map(({ icon: Icon, title, description }) => (
          <article className="login-benefit-card" key={title}>
            <div className="login-benefit-icon" aria-hidden="true"><Icon size={20} /></div>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default LoginBrandPanel;
