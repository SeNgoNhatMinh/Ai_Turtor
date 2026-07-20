import { lazy, Suspense } from 'react';
import { BookOpen, GraduationCap, Pencil } from 'lucide-react';
import FptWordmark from './FptWordmark';

const RobotHeadMascot = lazy(() => import('../../../components/RobotHeadMascot'));

const BENEFITS = [
  {
    icon: BookOpen,
    title: 'Course AI Answers',
    description: 'Ask questions with course-aware context.',
  },
  {
    icon: Pencil,
    title: 'Code Review',
    description: 'Get guided feedback on programming tasks.',
  },
  {
    icon: GraduationCap,
    title: '1-on-1 Support',
    description: 'Escalate complex questions to mentors.',
  },
];

function LoginMascotFallback() {
  return <div className="login-robot-fallback" aria-hidden="true" />;
}

function LoginBrandPanel() {
  return (
    <section className="login-brand-panel" aria-label="FPT University AI Tutor introduction">
      <div className="login-brand-kicker">AI-powered learning platform</div>

      <div className="login-mascot-stage">
        <div className="login-robot-wrap">
          <Suspense fallback={<LoginMascotFallback />}>
            <RobotHeadMascot
              size={210}
              talking
              ariaLabel="AI robot tutor saying the FPT learning slogan"
              className="login-robot-head"
            />
          </Suspense>
          <div className="login-speech-bubble" aria-label="Learning slogan">
            <span>Học tập chủ động</span>
            <strong>Kiến tạo tương lai</strong>
          </div>
        </div>
      </div>

      <h1><FptWordmark /> University AI Tutor</h1>
      <p>
        Study smarter with course-aware AI support, guided code feedback, and mentor escalation in one workspace.
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
