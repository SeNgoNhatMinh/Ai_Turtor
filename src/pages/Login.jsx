import React, { useState } from 'react';
import { apiService } from '../services/api';
import { User, Lock, Mail, ArrowRight, UserPlus, GraduationCap, BookOpen, Pencil, Globe, Hexagon, Component } from 'lucide-react';
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
      background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1440 320\'%3E%3Cpath fill=\'%23f37021\' fill-opacity=\'1\' d=\'M0,128L48,117.3C96,107,192,85,288,101.3C384,117,480,171,576,170.7C672,171,768,117,864,101.3C960,85,1056,107,1152,117.3C1248,128,1344,128,1392,128L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z\'%3E%3C/path%3E%3Cpath fill=\'%2300a896\' fill-opacity=\'1\' d=\'M0,224L48,229.3C96,235,192,245,288,224C384,203,480,149,576,133.3C672,117,768,139,864,165.3C960,192,1056,224,1152,229.3C1248,235,1344,213,1392,202.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z\'%3E%3C/path%3E%3C/svg%3E")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#f9fcfb',
      position: 'fixed',
      top: 0, left: 0, zIndex: 9999,
      overflow: 'hidden'
    }}>
      {/* Floating Background Icons */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', opacity: 0.35, transform: 'rotate(-15deg)' }}>
        <GraduationCap size={56} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', top: '18%', right: '15%', opacity: 0.3, transform: 'rotate(20deg)' }}>
        <BookOpen size={44} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', bottom: '25%', left: '8%', opacity: 0.35, transform: 'rotate(25deg)' }}>
        <Hexagon size={40} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', top: '40%', right: '8%', opacity: 0.3, transform: 'rotate(-20deg)' }}>
        <Globe size={52} color="#F37021" />
      </div>
      <div style={{ position: 'absolute', top: '8%', right: '35%', opacity: 0.25, transform: 'rotate(5deg)' }}>
        <Component size={36} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', bottom: '35%', left: '22%', opacity: 0.3, transform: 'rotate(-15deg)' }}>
        <Pencil size={42} color="#00a896" />
      </div>
      {/* Thêm nhiều icon mới */}
      <div style={{ position: 'absolute', top: '65%', left: '12%', opacity: 0.25, transform: 'rotate(45deg)' }}>
        <Globe size={48} color="#00a896" />
      </div>
      <div style={{ position: 'absolute', bottom: '15%', right: '18%', opacity: 0.3, transform: 'rotate(-10deg)' }}>
        <GraduationCap size={50} color="#F37021" />
      </div>
      <div style={{ position: 'absolute', top: '30%', left: '28%', opacity: 0.2, transform: 'rotate(30deg)' }}>
        <Hexagon size={32} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', bottom: '45%', right: '25%', opacity: 0.25, transform: 'rotate(15deg)' }}>
        <BookOpen size={38} color="#00a896" />
      </div>
      <div style={{ position: 'absolute', top: '55%', right: '4%', opacity: 0.25, transform: 'rotate(-30deg)' }}>
        <Component size={40} color="#F37021" />
      </div>
      <div style={{ position: 'absolute', bottom: '10%', left: '35%', opacity: 0.3, transform: 'rotate(10deg)' }}>
        <Pencil size={36} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', top: '15%', left: '45%', opacity: 0.2, transform: 'rotate(-5deg)' }}>
        <BookOpen size={30} color="#ffffff" />
      </div>
      <div style={{ position: 'absolute', top: '75%', right: '40%', opacity: 0.25, transform: 'rotate(25deg)' }}>
        <Hexagon size={44} color="#00a896" />
      </div>

      <div className="glass-card" style={{
        width: '400px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'center',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
        }}>
          <img src="/favicon.jpg" alt="Logo" style={{ width: 100, height: 100, objectFit: 'contain' }} />
        </div>
        
        <h1 style={{ margin: '10px 0 5px 0', fontSize: '24px', fontWeight: 800, textAlign: 'center' }}>
          <span style={{ color: '#F37021' }}>FPT UNIVERSITY</span>
        </h1>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', letterSpacing: '4px', color: '#1B3A53', fontWeight: 500, textAlign: 'center' }}>
          ACADEMIC PORTAL
        </h3>
        
        <p style={{ color: '#4B5563', marginBottom: '30px', textAlign: 'center', fontSize: '14px', fontWeight: 500 }}>
          Học tập chủ động - Kiến tạo tương lai
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {!isLoginView && (
            <div className="input-group" style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#F3F4F6', borderRadius: '12px', padding: '12px 16px' }}>
                <User size={18} color="#6B7280" style={{ marginRight: '10px' }} />
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
            <div style={{ display: 'flex', alignItems: 'center', background: '#F3F4F6', borderRadius: '12px', padding: '12px 16px' }}>
              <Mail size={18} color="#6B7280" style={{ marginRight: '10px' }} />
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
            <div style={{ display: 'flex', alignItems: 'center', background: '#F3F4F6', borderRadius: '12px', padding: '12px 16px' }}>
              <Lock size={18} color="#6B7280" style={{ marginRight: '10px' }} />
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
            style={{ 
              width: '100%', padding: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', 
              fontSize: '16px', fontWeight: 600, borderRadius: '12px',
              background: 'linear-gradient(90deg, #F37021 0%, #FF8C00 100%)', border: 'none'
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isLoginView ? <>Sign in <ArrowRight size={18} style={{ marginLeft: '8px' }}/></> : <>Sign up <UserPlus size={18} style={{ marginLeft: '8px' }}/></>)}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setIsLoginView(!isLoginView); }}
            style={{ color: '#00a896', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
          >
            {isLoginView ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
