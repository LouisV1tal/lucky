import React from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

import Login from './pages/Login.jsx';
import Orders from './pages/Orders.jsx';
import OrderNew from './pages/OrderNew.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Scan from './pages/Scan.jsx';
import Clients from './pages/Clients.jsx';
import Employees from './pages/Employees.jsx';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Lucky" className="brand-logo" />
          <span>Учёт заказов</span>
        </div>
        <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>Заказы</NavLink>
        {(user.role === 'admin' || user.role === 'operator') && (
          <NavLink to="/orders/new" className={({ isActive }) => (isActive ? 'active' : '')}>Новый заказ</NavLink>
        )}
        <NavLink to="/scan" className={({ isActive }) => (isActive ? 'active' : '')}>Сканировать QR</NavLink>
        {(user.role === 'admin' || user.role === 'operator') && (
          <NavLink to="/clients" className={({ isActive }) => (isActive ? 'active' : '')}>Клиенты</NavLink>
        )}
        {user.role === 'admin' && (
          <NavLink to="/employees" className={({ isActive }) => (isActive ? 'active' : '')}>Сотрудники</NavLink>
        )}
        <div className="sidebar-user">
          {user.fullName} · {roleLabel(user.role)}
          <div>
            <button className="btn secondary" style={{ marginTop: 10, minHeight: 40, width: '100%' }} onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function roleLabel(role) {
  return { admin: 'Администратор', operator: 'Оператор', production: 'Производство', courier: 'Курьер' }[role] || role;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/orders" replace /> : <Login />} />
      <Route path="/orders" element={<Protected><Shell><Orders /></Shell></Protected>} />
      <Route path="/orders/new" element={<Protected><Shell><OrderNew /></Shell></Protected>} />
      <Route path="/orders/:id" element={<Protected><Shell><OrderDetail /></Shell></Protected>} />
      <Route path="/scan" element={<Protected><Shell><Scan /></Shell></Protected>} />
      <Route path="/clients" element={<Protected><Shell><Clients /></Shell></Protected>} />
      <Route path="/employees" element={<Protected><Shell><Employees /></Shell></Protected>} />
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}
