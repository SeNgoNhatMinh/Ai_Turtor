import { useEffect, useRef } from 'react';
import LoginAuthCard from './components/LoginAuthCard';
import LoginBrandPanel from './components/LoginBrandPanel';
import { useAuthForm } from './hooks/useAuthForm';

function LoginPage({ onLoginSuccess, triggerToast }) {
  const authForm = useAuthForm({ onLoginSuccess, triggerToast });
  const pageRef = useRef(null);

  useEffect(() => {
    if (typeof pageRef.current?.scrollTo === 'function') {
      pageRef.current.scrollTo({ top: 0, behavior: 'auto' });
    } else if (pageRef.current) {
      pageRef.current.scrollTop = 0;
    }
  }, []);

  return (
    <main ref={pageRef} className="login-page">
      <div className="login-shell">
        <LoginBrandPanel />
        <aside className="login-mascot-message" aria-label="Lời chào từ AI Tutor">
          <span className="login-mascot-status">
            <span aria-hidden="true" /> Sẵn sàng hỗ trợ
          </span>
          <strong>Học tập chủ động – Kiến tạo tương lai</strong>
          <p>Mình là AI Tutor, sẵn sàng đồng hành cùng bạn.</p>
        </aside>
        <LoginAuthCard {...authForm} />
      </div>
    </main>
  );
}

export default LoginPage;
