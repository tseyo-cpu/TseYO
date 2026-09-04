import React, { useState } from 'react';
import { TabType } from '../App';
import { LayoutDashboard, Users, Award, FileBarChart, School, Plus, Trash2, X, LogOut, UserCog, Trophy } from 'lucide-react';
import { useAppContext } from '../context';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { logout } from '../lib/firebase';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, userRole, currentAcademicYear, setCurrentAcademicYear, academicYears, addAcademicYear, deleteAcademicYear } = useAppContext();
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [isDeleteYearModalOpen, setIsDeleteYearModalOpen] = useState(false);
  
  const allTabs: { id: TabType; label: string; icon: any; roles: string[] }[] = [
    { id: 'dashboard', label: '儀表板', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'students', label: '學生管理', icon: Users, roles: ['admin'] },
    { id: 'awards', label: '學生獎勵紀錄', icon: Award, roles: ['admin', 'editor', 'viewer'] },
    { id: 'activities', label: '課外活動紀錄', icon: Trophy, roles: ['admin', 'editor', 'viewer'] },
    { id: 'reports', label: '表現報告', icon: FileBarChart, roles: ['admin', 'editor', 'viewer', 'student'] },
    { id: 'users', label: '權限管理', icon: UserCog, roles: ['admin'] },
  ];

  const tabs = allTabs.filter(tab => userRole && tab.roles.includes(userRole));

  return (
    <>
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 flex flex-col gap-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <School size={24} />
          </div>
          <h1 className="font-bold text-lg text-slate-800">學生獎勵系統</h1>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">學年度</label>
            {userRole === 'admin' && (
              <div className="flex gap-1">
                <button onClick={() => setIsAddYearModalOpen(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded" title="新增學年度">
                  <Plus size={14} />
                </button>
                <button 
                  onClick={() => {
                    if (academicYears.length <= 1) {
                      alert('至少需保留一個學年度');
                      return;
                    }
                    setIsDeleteYearModalOpen(true);
                  }} 
                  className="text-red-500 hover:bg-red-50 p-1 rounded" title="刪除當前學年度"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          <select 
            value={currentAcademicYear}
            onChange={(e) => setCurrentAcademicYear(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-100 flex flex-col gap-3">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
            {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : user?.displayName?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-medium text-slate-800 truncate">{user?.displayName || '用戶'}</span>
            <span className="text-xs text-slate-500 truncate">{userRole === 'admin' ? '管理者' : userRole === 'editor' ? '編輯者' : userRole === 'viewer' ? '檢視者' : '學生'}</span>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 justify-center w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut size={16} />
          登出
        </button>
      </div>
    </aside>

    {isAddYearModalOpen && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">新增學年度</h3>
            <button onClick={() => setIsAddYearModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const newYear = fd.get('year') as string;
              if (newYear && newYear.trim()) {
                addAcademicYear(newYear.trim());
                setIsAddYearModalOpen(false);
              }
            }} 
            className="p-4 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">學年度名稱</label>
              <input required name="year" type="text" placeholder="例如: 2027-2028" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div className="pt-2 flex justify-end gap-3">
              <button type="button" onClick={() => setIsAddYearModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">取消</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">新增</button>
            </div>
          </form>
        </div>
      </div>
    )}
    
    <ConfirmDeleteModal
      isOpen={isDeleteYearModalOpen}
      onClose={() => setIsDeleteYearModalOpen(false)}
      onConfirm={() => deleteAcademicYear(currentAcademicYear)}
      title="刪除學年度"
      message={<>您確定要刪除 <strong>{currentAcademicYear}</strong> 學年度嗎？<br/>此操作將同時刪除該年度的所有學生與獎勵紀錄，且無法復原！</>}
      requireInputText="刪除"
    />
    </>
  );
};
