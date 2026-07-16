import LoginAuthCard from './components/LoginAuthCard';
import LoginBrandPanel from './components/LoginBrandPanel';
import { useAuthForm } from './hooks/useAuthForm';

function LoginPage({ onLoginSuccess, triggerToast }) {
  const authForm = useAuthForm({ onLoginSuccess, triggerToast });

  return (
    <main className="login-page">
      <div className="login-shell">
        <LoginBrandPanel />
        <LoginAuthCard {...authForm} />
      </div>
    </main>
  );
}

export default LoginPage;
