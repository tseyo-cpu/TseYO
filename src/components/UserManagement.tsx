import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context';
import { UserCog, AlertCircle, ShieldAlert, Plus, Trash2, Upload, Download, CheckCircle, X } from 'lucide-react';
import { AppUser } from '../types';
import * as XLSX from 'xlsx';

interface UserRowProps {
  appUser: AppUser;
  isSelf: boolean;
  updateUserRole: (id: string, role: 'admin' | 'editor' | 'viewer' | 'student') => Promise<void>;
  updateUserAbbreviation: (id: string, abbreviation: string) => Promise<void>;
  deleteAppUser: (id: string) => Promise<void>;
}

const UserRow: React.FC<UserRowProps> = ({ 
  appUser, 
  isSelf, 
  updateUserRole, 
  updateUserAbbreviation, 
  deleteAppUser 
}) => {
  const [abbreviation, setAbbreviation] = useState(appUser.teacherAbbreviation || '');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer' | 'student' | 'delete'>(appUser.role);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAbbreviation(appUser.teacherAbbreviation || '');
    setRole(appUser.role);
  }, [appUser.teacherAbbreviation, appUser.role]);

  const hasChanges = abbreviation !== (appUser.teacherAbbreviation || '') || role !== appUser.role;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (role === 'delete') {
        if (window.confirm(`警告：確定要刪除使用者 ${appUser.displayName} 的權限嗎？該使用者將無法再登入系統！`)) {
          await deleteAppUser(appUser.id);
        } else {
          setRole(appUser.role); // revert
        }
      } else {
        if (role !== appUser.role) {
          await updateUserRole(appUser.id, role);
        }
        if (abbreviation !== (appUser.teacherAbbreviation || '')) {
          await updateUserAbbreviation(appUser.id, abbreviation.trim());
        }
      }
    } catch (err) {
      console.error("Failed to update user:", err);
      alert('更新失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setAbbreviation(appUser.teacherAbbreviation || '');
    setRole(appUser.role);
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
          {appUser.displayName ? appUser.displayName.charAt(0).toUpperCase() : 'U'}
        </div>
        {appUser.displayName}
        {isSelf && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">自己</span>}
      </td>
      <td className="px-6 py-4 text-slate-500">{appUser.email}</td>
      <td className="px-6 py-4">
        <input
          type="text"
          value={abbreviation}
          onChange={(e) => setAbbreviation(e.target.value)}
          placeholder="無簡稱"
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-32 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </td>
      <td className="px-6 py-4">
        <select
          disabled={isSelf}
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer' | 'student' | 'delete')}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-white"
        >
          <option value="admin">管理者</option>
          <option value="editor">編輯者</option>
          <option value="viewer">檢視者</option>
          <option value="student">學生</option>
          <option value="delete" className="text-red-500 font-medium">移除權限</option>
        </select>
      </td>
      <td className="px-6 py-4">
        {hasChanges ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={14} />
              儲存
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <X size={14} />
              取消
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">已儲存</span>
        )}
      </td>
    </tr>
  );
};

export const UserManagement = () => {
  const { user, userRole, appUsers, pendingUsers, updateUserRole, updateUserAbbreviation, addPendingUser, deletePendingUser, deleteAppUser } = useAppContext();
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer' | 'student'>('editor');
  const [newAbbreviation, setNewAbbreviation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <ShieldAlert size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">無權限存取</h2>
        <p className="mt-2">您需要管理者權限才能檢視此頁面。</p>
      </div>
    );
  }

  const handleAddPending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      alert('請輸入有效的電子郵件');
      return;
    }
    if (appUsers.some(u => u.email.toLowerCase() === newEmail.toLowerCase().trim())) {
      alert('此使用者已經登入過系統，請直接在下方列表中修改權限。');
      return;
    }
    try {
      await addPendingUser(newEmail, newRole, newAbbreviation.trim());
      setNewEmail('');
      setNewRole('editor');
      setNewAbbreviation('');
      alert('已成功新增預先授權使用者！當該信箱登入時會自動取得對應權限。');
    } catch (err) {
      console.error(err);
      alert('新增失敗，請稍後再試');
    }
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ['Email', '負責老師簡稱', '權限 (admin/editor/viewer/student/delete)'],
      ['teacher1@school.edu.hk', 'TChan', 'admin'],
      ['teacher2@school.edu.hk', 'WongSir', 'editor'],
      ['oldteacher@school.edu.hk', '', 'delete']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "權限設定");
    XLSX.writeFile(wb, "user_permissions_template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let successCount = 0;
        let deleteCount = 0;
        const failedRows: string[] = [];
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const email = String(row['Email'] || '').toLowerCase().trim();
          const actionRole = String(row['權限 (admin/editor/viewer/student/delete)'] || row['權限 (admin/editor/delete)'] || '').toLowerCase().trim();
          const abbreviation = String(row['負責老師簡稱'] || '').trim();
          
          if (!email || !email.includes('@')) {
            failedRows.push(`第 ${i + 2} 行 (缺少或無效的 Email)`);
            continue;
          }
          
          // Cannot affect self or root admin
          if (email === user?.email || email === 'tseyo@pochiu.edu.hk') {
            failedRows.push(`第 ${i + 2} 行 (無法修改自己或根管理員權限: ${email})`);
            continue;
          }

          const existingAppUser = appUsers.find(u => u.email === email);
          const isPending = pendingUsers.some(u => u.email === email);

          if (actionRole === 'delete') {
            if (existingAppUser) await deleteAppUser(existingAppUser.id);
            if (isPending) await deletePendingUser(email);
            if (existingAppUser || isPending) deleteCount++;
            else failedRows.push(`第 ${i + 2} 行 (欲刪除的 Email 不存在: ${email})`);
          } else if (actionRole === 'admin' || actionRole === 'editor' || actionRole === 'viewer' || actionRole === 'student') {
            if (existingAppUser) {
              await updateUserRole(existingAppUser.id, actionRole);
              if (abbreviation) await updateUserAbbreviation(existingAppUser.id, abbreviation);
            } else {
              await addPendingUser(email, actionRole, abbreviation);
            }
            successCount++;
          } else {
            failedRows.push(`第 ${i + 2} 行 (無效的權限設定: ${actionRole})`);
          }
        }
        
        let msg = `匯入完成！成功新增/更新 ${successCount} 筆，刪除 ${deleteCount} 筆。`;
        if (failedRows.length > 0) {
          msg += `\n\n有 ${failedRows.length} 筆資料匯入失敗或略過：\n${failedRows.slice(0, 10).join('\n')}`;
          if (failedRows.length > 10) msg += `\n...等共 ${failedRows.length} 筆`;
        }
        alert(msg);
      } catch (error) {
        console.error("Error parsing Excel file", error);
        alert('讀取檔案時發生錯誤。請確保格式與範本相符。');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <UserCog size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">權限管理</h2>
            <p className="text-slate-500 mt-1">管理系統使用者的權限級別。您也可以預先新增使用者信箱，待他們首次登入即會套用權限。</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={handleDownloadTemplate}
            className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm whitespace-nowrap"
          >
            <Download size={16} />
            下載範本
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 border border-transparent text-white hover:bg-indigo-700 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm whitespace-nowrap shadow-sm"
          >
            <Upload size={16} />
            匯入 Excel
          </button>
        </div>
      </header>

      {/* 新增使用者區塊 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Plus size={18} className="text-indigo-600" />
            預先新增使用者權限
          </h3>
          <form onSubmit={handleAddPending} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1">Google 電子郵件 (Email)</label>
              <input 
                type="email" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="例如: teacher@school.edu.hk"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">負責老師簡稱</label>
              <input 
                type="text" 
                value={newAbbreviation}
                onChange={(e) => setNewAbbreviation(e.target.value)}
                placeholder="例如: 陳大文 或 TChan"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">預設權限</label>
              <select 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'editor' | 'viewer' | 'student')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                <option value="editor">編輯者</option>
                <option value="admin">管理者</option>
                <option value="viewer">檢視者</option>
                <option value="student">學生</option>
              </select>
            </div>
            <button 
              type="submit"
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              新增
            </button>
          </form>
          
          {pendingUsers.filter(pu => !appUsers.some(u => u.email === pu.email)).length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-600 mb-3">尚未登入的預先授權名單：</h4>
              <div className="flex flex-wrap gap-3">
                {pendingUsers.filter(pu => !appUsers.some(u => u.email === pu.email)).map(pu => (
                  <div key={pu.email} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm">
                    <span className="text-slate-700 font-medium">{pu.email}</span>
                    {pu.teacherAbbreviation && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {pu.teacherAbbreviation}
                      </span>
                    )}
                    <span className="text-slate-400">({pu.role === 'admin' ? '管理者' : pu.role === 'editor' ? '編輯者' : pu.role === 'viewer' ? '檢視者' : '學生'})</span>
                    <button 
                      onClick={() => {
                        if (window.confirm(`確定要取消 ${pu.email} 的預先授權嗎？`)) {
                          deletePendingUser(pu.email);
                        }
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex gap-2 items-center bg-indigo-50/50">
          <AlertCircle size={20} className="text-indigo-600 shrink-0" />
          <span className="text-sm text-indigo-800">
            當前共有 <strong>{appUsers.length}</strong> 位已註冊使用者。新加入的老師如果在上方未被預先授權，首次登入系統時會被設定為預設「編輯者」。
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">使用者名稱</th>
                <th className="px-6 py-4">電子郵件</th>
                <th className="px-6 py-4">負責老師簡稱</th>
                <th className="px-6 py-4">權限狀態</th>
                <th className="px-6 py-4">變更權限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appUsers.map(appUser => (
                <UserRow
                  key={appUser.id}
                  appUser={appUser}
                  isSelf={appUser.id === user?.uid}
                  updateUserRole={updateUserRole}
                  updateUserAbbreviation={updateUserAbbreviation}
                  deleteAppUser={deleteAppUser}
                />
              ))}
            </tbody>
          </table>
          {appUsers.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              尚無使用者資料
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
