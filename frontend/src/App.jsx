import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import NewAdminDashboard from './pages/NewAdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import './index.css';

function App() {
  const [auth, setAuth] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Load auth from localStorage on mount (handles page refresh)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fugen_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that the saved auth has the required fields
        if (parsed && parsed.role) {
          setAuth(parsed);
        }
      }
    } catch (e) {
      localStorage.removeItem('fugen_auth');
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  const handleLogin = (role, user = null) => {
    const authData = { role, user };
    setAuth(authData);
    localStorage.setItem('fugen_auth', JSON.stringify(authData));
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('fugen_auth');
  };

  // Don't render anything until we've checked localStorage (prevents flash of login page)
  if (!authLoaded) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f0f2f5',
        fontSize: 16,
        color: '#555'
      }}>
        Loading...
      </div>
    );
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            auth.role === 'admin'
              ? <NewAdminDashboard onLogout={handleLogout} />
              : <StudentDashboard user={auth.user} onLogout={handleLogout} />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
