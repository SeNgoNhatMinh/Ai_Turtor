import { useState } from 'react';
import { apiService } from '../services/api';
import { User, Lock, Mail, ArrowRight, UserPlus, GraduationCap, BookOpen, Pencil } from 'lucide-react';
import RobotHeadMascot from '../components/RobotHeadMascot';
import { validateAuthForm } from '../utils/validators';
import '../index.css';

function Login({ onLoginSuccess, triggerToast }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const now = Date.now();
    if (isLoading || now - lastSubmitAt < 900) return;

    const validation = validateAuthForm({ email, password, fullName, isLoginView });
    if (!validation.ok) {
      triggerToast(validation.message);
      return;
    }
    setLastSubmitAt(now);
    setIsLoading(true);
    try {
      if (isLoginView) {
        const user = await apiService.login(validation.value.email, validation.value.password);
        triggerToast('Signed in successfully.');
        onLoginSuccess(user);
      } else {
        await apiService.register(validation.value);
        triggerToast('Account created. Please sign in.');
        setIsLoginView(true);
      }
    } catch (e) {
      triggerToast(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const benefitItems = [
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

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-brand-panel" aria-label="FPT University AI Tutor introduction">
          <div className="login-brand-kicker">AI-powered learning platform</div>
          <div className="login-mascot-stage">
            <div className="login-robot-wrap">
              <RobotHeadMascot
                size={210}
                talking={true}
                ariaLabel="AI robot tutor saying the FPT learning slogan"
                className="login-robot-head"
              />
              <div className="login-speech-bubble" aria-label="Learning slogan">
                <span>Học tập chủ động</span>
                <strong>Kiến tạo tương lai</strong>
              </div>
            </div>
          </div>
          <h1>
            <span>FPT</span> University AI Tutor
          </h1>
          <p>
            Study smarter with course-aware AI support, guided code feedback, and mentor escalation in one workspace.
          </p>

          <div className="login-benefit-grid">
            {benefitItems.map(({ icon: Icon, title, description }) => (
              <article className="login-benefit-card" key={title}>
                <div className="login-benefit-icon" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="login-auth-card" aria-label={isLoginView ? 'Sign in form' : 'Create account form'}>
          <div className="login-card-header">
            <div className="login-auth-brand-row">
              <img src="/favicon.jpg" alt="FPT University AI Tutor mascot" className="login-auth-mascot" />
              <div className="login-brand-mark">
                <span className="brand-fpt">FPT</span>
                <span className="brand-university">University</span>
                <small>AI Tutor</small>
              </div>
            </div>
            <h2>{isLoginView ? 'Welcome back' : 'Create your account'}</h2>
            <p>{isLoginView ? 'Sign in to continue your learning session.' : 'Start using your AI learning workspace.'}</p>
          </div>

          <div className="login-segment" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={isLoginView ? 'active' : ''}
              onClick={() => setIsLoginView(true)}
              aria-selected={isLoginView}
            >
              Sign in
            </button>
            <button
              type="button"
              className={!isLoginView ? 'active' : ''}
              onClick={() => setIsLoginView(false)}
              aria-selected={!isLoginView}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {!isLoginView && (
              <label className="login-field">
                <span>Full name</span>
                <div className="login-input-wrap">
                  <User size={18} aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Full name"
                    required
                  value={fullName}
                  maxLength={80}
                  onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </label>
            )}

            <label className="login-field">
              <span>Email address</span>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  value={email}
                  maxLength={254}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  maxLength={128}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              {!isLoginView && <small>Password must be at least 6 characters.</small>}
            </label>

            <button
              type="submit"
              className="login-submit btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : (isLoginView ? <>Sign in <ArrowRight size={18} /></> : <>Create account <UserPlus size={18} /></>)}
            </button>
          </form>

          <button
            type="button"
            className="login-toggle-link"
            onClick={() => setIsLoginView(!isLoginView)}
          >
            {isLoginView ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </section>
      </div>
    </main>
  );
}

export default Login;
