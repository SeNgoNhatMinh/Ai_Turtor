import React, { useState } from 'react';
import { apiService } from '../services/api';
import { User, Lock, Mail, ArrowRight, UserPlus, ShieldCheck } from 'lucide-react';
import '../index.css';

function Login({ onLoginSuccess, triggerToast }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoginView && password.length < 6) {
      triggerToast('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      if (isLoginView) {
        const user = await apiService.login(email, password);
        triggerToast('Signed in successfully.');
        onLoginSuccess(user);
      } else {
        await apiService.register({ email, password, fullName });
        triggerToast('Account created. Please sign in.');
        setIsLoginView(true);
      }
    } catch (e) {
      triggerToast(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #FFF7F0 0%, #FFFFFF 52%, #FFE1CC 100%)',
      position: 'fixed',
      top: 0, left: 0, zIndex: 9999
    }}>
      <div className="glass-card" style={{
        width: '400px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#FFFFFF',
        border: '1px solid #F3D2BC',
        boxShadow: '0 24px 60px rgba(216, 95, 22, 0.18)'
      }}>
        <div className="login-brand-mark">
          <span className="brand-fpt">FPT</span>
          <span>University</span>
          <small>AI Tutor</small>
        </div>
        <div style={{
          background: 'rgba(243, 112, 33, 0.12)',
          padding: '16px',
          borderRadius: '50%',
          marginBottom: '20px'
        }}>
          <ShieldCheck size={48} color="#F37021" />
        </div>
        <h2 style={{ marginBottom: '10px', color: '#1F2937' }}>
          {isLoginView ? 'Welcome back' : 'Create your account'}
        </h2>
        <p style={{ color: '#6B7280', marginBottom: '30px', textAlign: 'center' }}>
          FPT University AI Tutor - intelligent learning support platform
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {!isLoginView && (
            <div className="input-group" style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#FFF7F0', borderRadius: '8px', padding: '10px 15px', border: '1px solid #F3D2BC' }}>
                <User size={18} color="#F37021" style={{ marginRight: '10px' }} />
                <input
                  type="text"
                  placeholder="Full name"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{ border: 'none', background: 'transparent', color: '#1F2937', width: '100%', outline: 'none' }}
                />
              </div>
            </div>
          )}

          <div className="input-group" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#FFF7F0', borderRadius: '8px', padding: '10px 15px', border: '1px solid #F3D2BC' }}>
              <Mail size={18} color="#F37021" style={{ marginRight: '10px' }} />
              <input
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ border: 'none', background: 'transparent', color: '#1F2937', width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#FFF7F0', borderRadius: '8px', padding: '10px 15px', border: '1px solid #F3D2BC' }}>
              <Lock size={18} color="#F37021" style={{ marginRight: '10px' }} />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ border: 'none', background: 'transparent', color: '#1F2937', width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isLoginView ? <>Sign in <ArrowRight size={18} style={{ marginLeft: '8px' }}/></> : <>Sign up <UserPlus size={18} style={{ marginLeft: '8px' }}/></>)}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setIsLoginView(!isLoginView); }}
            style={{ color: '#F37021', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}
          >
            {isLoginView ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
