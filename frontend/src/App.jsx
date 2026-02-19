import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import NewAdminDashboard from './pages/NewAdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import './index.css';

function App() {
  const [auth, setAuth] = useState(null); // { role: 'admin'|'student', user: {} }

  const handleLogin = (role, user = null) => {
    setAuth({ role, user });
  };

  const handleLogout = () => {
    setAuth(null);
  };

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
