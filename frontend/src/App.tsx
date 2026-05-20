import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Admin from './pages/Admin';
import CreateEntry from './pages/CreateEntry';
import Entries from './pages/Entries';
import Inventory from './pages/Inventory';
import Ledgers from './pages/Ledgers';
import { ToastProvider } from './contexts/ToastContext';

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" />;

  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/create-entry" element={<PrivateRoute><CreateEntry /></PrivateRoute>} />
            <Route path="/entries" element={<PrivateRoute><Entries /></PrivateRoute>} />
            <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
            <Route path="/ledgers" element={<PrivateRoute><Ledgers /></PrivateRoute>} />
            <Route path="/reports" element={<PrivateRoute><Dashboard /></PrivateRoute>} /> {/* Placeholder */}
            
            <Route path="/admin" element={<PrivateRoute adminOnly><Admin /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}
