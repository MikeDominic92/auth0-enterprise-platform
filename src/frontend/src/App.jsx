import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Teams from './pages/Teams';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';

// Global styles
const globalStyles = `
  .app-container {
    display: flex;
    min-height: 100vh;
    background-color: #f5f7fa;
  }
  .main-content {
    flex: 1;
    margin-left: 250px;
    padding-top: 64px;
  }
  .page-content {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
  }
  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  .login-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
  }
  .login-card {
    background: #fff;
    border-radius: 12px;
    padding: 48px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    text-align: center;
    max-width: 400px;
    width: 90%;
  }
  .login-title {
    color: #1a1a2e;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .login-subtitle {
    color: #666;
    font-size: 14px;
    margin-bottom: 32px;
  }
  .login-button {
    width: 100%;
    padding: 14px 24px;
    background: linear-gradient(135deg, #635bff 0%, #7c3aed 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .login-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(99, 91, 255, 0.4);
  }
  .error-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #f5f7fa;
    color: #333;
    text-align: center;
    padding: 24px;
  }
  .error-title {
    font-size: 24px;
    font-weight: 700;
    color: #dc2626;
    margin-bottom: 8px;
  }
  .error-message {
    color: #666;
    margin-bottom: 24px;
  }
  .retry-button {
    padding: 12px 24px;
    background: #635bff;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Protected Route wrapper component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Login page component
const LoginPage = () => {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Enterprise Admin Portal</h1>
        <p className="login-subtitle">
          Secure access to your organization's identity management
        </p>
        <button
          className="login-button"
          onClick={() => loginWithRedirect()}
        >
          Sign In with Auth0
        </button>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const { isLoading, error } = useAuth0();

  // Inject global styles
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = globalStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  if (error) {
    return (
      <div className="error-screen">
        <h1 className="error-title">Authentication Error</h1>
        <p className="error-message">{error.message}</p>
        <button
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Initializing application...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="main-content">
                <Header />
                <div className="page-content">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/teams" element={<Teams />} />
                    <Route path="/audit-logs" element={<AuditLogs />} />
                    <Route path="/reports" element={<Reports />} />
                  </Routes>
                </div>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
