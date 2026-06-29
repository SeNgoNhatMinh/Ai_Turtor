import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Login from '../pages/Login';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';

const StudentPortal = lazy(() => import('../pages/StudentPortal'));
const TeacherPortal = lazy(() => import('../pages/TeacherPortal'));
const AdminPortal = lazy(() => import('../pages/AdminPortal'));

function AppContent() {
  const currentUser = useAuthStore(state => state.currentUser);
  const activeRole = useAuthStore(state => state.activeRole);
  const activeTab = useUiStore(state => state.activeTab);
  const setActiveTab = useUiStore(state => state.setActiveTab);
  const isDarkMode = useUiStore(state => state.isDarkMode);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!currentUser && location.pathname !== '/login') {
      navigate('/login');
    } else if (currentUser && location.pathname === '/login') {
      navigate('/');
    }
  }, [currentUser, location.pathname, navigate]);

  // Sync route with active role if we are on the root route
  useEffect(() => {
    if (currentUser && location.pathname === '/') {
      navigate(`/${activeRole}`);
    }
  }, [currentUser, activeRole, location.pathname, navigate]);

  // Ensure activeTab matches the activeRole (e.g. on page refresh)
  useEffect(() => {
    if (activeRole && !activeTab?.startsWith(activeRole)) {
      if (activeRole === 'student') setActiveTab('student-chat');
      else if (activeRole === 'teacher') setActiveTab('teacher-classes');
      else if (activeRole === 'admin') setActiveTab('admin-dashboard');
    }
  }, [activeRole, activeTab, setActiveTab]);

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : 'light'}`}>
      <Header />
      <div className="main-layout">
        <Sidebar activeRole={activeRole} activeTab={activeTab} switchTab={setActiveTab} />
        <main className="content-wrapper">
          <Suspense fallback={<div className="flex-center h-full"><Spin size="large" /></div>}>
            <Routes>
              <Route path="/student/*" element={<StudentPortal />} />
              <Route path="/teacher/*" element={<TeacherPortal />} />
              <Route path="/admin/*" element={<AdminPortal />} />
              <Route path="*" element={<Navigate to={`/${activeRole}`} replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
