import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Students } from './components/Students';
import { AwardEntry } from './components/AwardEntry';
import { ActivityEntry } from './components/ActivityEntry';
import { Reports } from './components/Reports';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';

export type TabType = 'dashboard' | 'students' | 'awards' | 'activities' | 'reports' | 'users';

const MainLayout = () => {
  const { user, userRole, loading } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabType>(userRole === 'admin' ? 'dashboard' : (userRole === 'student' ? 'reports' : 'awards'));

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><p className="text-slate-500 font-medium">載入中...</p></div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'dashboard' && userRole === 'admin' && <Dashboard />}
        {activeTab === 'students' && userRole === 'admin' && <Students />}
        {activeTab === 'awards' && <AwardEntry />}
        {activeTab === 'activities' && <ActivityEntry />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'users' && userRole === 'admin' && <UserManagement />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
