import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from './pages/Login';
import Review from './pages/Review';
import UploadVideo from './pages/UploadVideo';
import Statistics from './pages/Statistics';
import AppLayout from './components/AppLayout';
import { useAuthStore } from './stores';
import './styles/index.css';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const location = useLocation();
  const { token } = useAuthStore();

  if (location.pathname === '/login') {
    return <Login />;
  }

  return (
    <AppLayout location={location}>
      <Routes>
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <UploadVideo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <Review />
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <Statistics />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </AppLayout>
  );
};

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <AppContent />
      </Router>
    </ConfigProvider>
  );
}

export default App;
