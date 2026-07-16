import { ArrowRight, Lock, Mail, User, UserPlus } from 'lucide-react';

function LoginAuthCard({
  email,
  fullName,
  handleSubmit,
  isLoading,
  isLoginView,
  password,
  setEmail,
  setFullName,
  setIsLoginView,
  setPassword,
}) {
  const title = isLoginView ? 'Welcome back' : 'Create your account';
  const description = isLoginView
    ? 'Sign in to continue your learning session.'
    : 'Start using your AI learning workspace.';

  return (
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
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="login-segment" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          className={isLoginView ? 'active' : ''}
          onClick={() => setIsLoginView(true)}
          aria-selected={isLoginView}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
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
                onChange={(event) => setFullName(event.target.value)}
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
              onChange={(event) => setEmail(event.target.value)}
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
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {!isLoginView && <small>Password must be at least 6 characters.</small>}
        </label>

        <button type="submit" className="login-submit btn btn-primary" disabled={isLoading}>
          {isLoading
            ? 'Processing...'
            : isLoginView
              ? <>Sign in <ArrowRight size={18} /></>
              : <>Create account <UserPlus size={18} /></>}
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
  );
}

export default LoginAuthCard;
