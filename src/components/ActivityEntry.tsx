import React, { useState, useRef, useMemo } from 'react';
import { Plus, Search, Upload, Download, Edit2, Trash2, Trophy } from 'lucide-react';
import { useAppContext } from '../context';
import { ActivityRecord, Student } from '../types';
import * as XLSX from 'xlsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export const ActivityEntry = () => {
  const { students, activityRecords, currentAcademicYear, academicYears, user, userRole, addActivityRecord, updateActivityRecord, deleteActivityRecord, bulkAddActivityRecords, bulkDeleteActivityRecords, appUsers } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [recordSearchTerm, setRecordSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  const [editModal, setEditModal] = useState<{ isOpen: boolean; record: ActivityRecord | null }>({ isOpen: false, record: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'single' | 'bulk'; id?: string; count?: number }>({ isOpen: false, type: 'single' });

  const [impersonatedUserEmail, setImpersonatedUserEmail] = useState('');
  const activeRecordedBy = impersonatedUserEmail || user?.email || 'Unknown';
  const [showSuccess, setShowSuccess] = useState(false);
  
const latestAcademicYear = useMemo(() => {
    return [...(academicYears || [])].sort((a, b) => b.localeCompare(a))[0];
  }, [academicYears]);
  
  const isLatestAcademicYear = currentAcademicYear === latestAcademicYear;
  const canEditOrAdd = userRole === 'admin' || (userRole === 'editor' && isLatestAcademicYear);

  const currentStudents = useMemo(() => {
    return students
      .filter(s => s.academicYear === currentAcademicYear)
      .sort((a, b) => {
        if (a.className !== b.className) {
          return a.className.localeCompare(b.className);
        }
        return (a.classNumber || 0) - (b.classNumber || 0);
      });
  }, [students, currentAcademicYear]);
  const displayedRecords = useMemo(() => {
    return activityRecords
      .filter(r => r.academicYear === currentAcademicYear)
      .filter(r => {
        const student = students.find(s => s.id === r.studentId);
        const searchStr = `${r.chineseName} ${r.englishName || ''} ${r.organizer} ${r.description} ${r.awardObtained || ''} ${student?.chineseName || ''} ${student?.className || ''}`.toLowerCase();
        
        const matchesSearch = !recordSearchTerm.trim() || searchStr.includes(recordSearchTerm.toLowerCase());
        const matchesStudent = !selectedStudentId || r.studentId === selectedStudentId;
        
        let matchesUser = false;
        if (userRole === 'admin') {
          if (impersonatedUserEmail) {
            matchesUser = r.recordedBy === impersonatedUserEmail || r.recordedBy === appUsers?.find(u => u.email === impersonatedUserEmail)?.displayName;
          } else {
            matchesUser = true; // Admin sees all records if no one is selected
          }
        } else {
          matchesUser = r.recordedBy === user?.email || r.recordedBy === user?.displayName || r.recordedBy === '登入老師';
        }
        
        return matchesSearch && matchesStudent && matchesUser;
      })
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [activityRecords, currentAcademicYear, selectedStudentId, recordSearchTerm, students, userRole, impersonatedUserEmail, user, appUsers]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    chineseName: '',
    englishName: '',
    organizer: '',
    description: '',
    awardObtained: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert('請先選擇學生');
      return;
    }
    if (!formData.chineseName || !formData.organizer || !formData.description) {
      alert('請填寫所有必填欄位');
      return;
    }

    addActivityRecord({
      studentId: selectedStudentId,
      academicYear: currentAcademicYear,
      date: formData.date,
      chineseName: formData.chineseName,
      englishName: formData.englishName,
      organizer: formData.organizer,
      description: formData.description,
      awardObtained: formData.awardObtained,
      recordedBy: activeRecordedBy
    });

    setFormData(prev => ({ ...prev, chineseName: '', englishName: '', organizer: '', description: '', awardObtained: '' }));
    setIsFormOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editModal.record) {
      updateActivityRecord(editModal.record);
      setEditModal({ isOpen: false, record: null });
    }
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ['負責老師簡稱', '活動中文名稱', '活動英文名稱（如有）', '主辦/合辦機構', '相關資料簡介（如有）', '校內編號', '獲得獎項（如有）', '日期'],
      ['CHAN', '全港中學生朗誦比賽', 'HK Schools Speech Festival', '香港學校音樂及朗誦協會', '參加中文獨誦', '2025-001', '季軍', '2025-12-01']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '課外活動紀錄範本');
    XLSX.writeFile(wb, '課外活動紀錄範本.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const newRecords: any[] = [];
        const failedRows: string[] = [];

        data.forEach((row: any, index: number) => {
          const schoolId = String(row['校內編號'] || row['學生編號'] || '');
          const student = currentStudents.find(s => s.schoolId === schoolId);
          
          if (!schoolId) {
             failedRows.push(`第 ${index + 2} 行 (缺少校內編號)`);
             return;
          }
          if (!student) {
             failedRows.push(`第 ${index + 2} 行 (找不到校內編號為 ${schoolId} 的學生)`);
             return;
          }

          const date = row['日期'] || new Date().toISOString().split('T')[0];
          const chineseName = String(row['活動中文名稱'] || row['中文名稱'] || '');
          const englishName = String(row['活動英文名稱（如有）'] || row['英文名稱'] || '');
          const organizer = String(row['主辦/合辦機構'] || row['主辦機構'] || '');
          const description = String(row['相關資料簡介（如有）'] || row['相關資料簡介'] || row['簡介'] || '');
          const awardObtained = String(row['獲得獎項（如有）'] || row['獲得獎項'] || '');
          const recordedByOverride = String(row['負責老師簡稱'] || row['負責老師'] || '');
          let finalRecordedBy = activeRecordedBy;
          if (recordedByOverride) {
            const matchedUser = appUsers?.find(u => u.teacherAbbreviation === recordedByOverride || u.displayName === recordedByOverride || u.email === recordedByOverride);
            finalRecordedBy = matchedUser ? matchedUser.email : recordedByOverride;
          }

          if (!chineseName || !organizer) {
             failedRows.push(`第 ${index + 2} 行 (缺少必填的活動中文名稱或主辦/合辦機構)`);
             return;
          }
          
          newRecords.push({
            studentId: student.id,
            academicYear: currentAcademicYear,
            date,
            chineseName,
            englishName,
            organizer,
            description,
            awardObtained,
            recordedBy: finalRecordedBy
          });
        });

        if (newRecords.length > 0) {
          bulkAddActivityRecords(newRecords);
          let msg = `成功匯入 ${newRecords.length} 筆活動紀錄！`;
          if (failedRows.length > 0) {
            msg += `\n\n有 ${failedRows.length} 筆資料匯入失敗：\n${failedRows.slice(0, 10).join('\n')}`;
            if (failedRows.length > 10) msg += `\n...等共 ${failedRows.length} 筆`;
          }
          alert(msg);
        } else {
          let msg = '找不到有效的紀錄，請確認「校內編號」是否存在且必填欄位已填妥。';
          if (failedRows.length > 0) {
            msg += `\n\n失敗原因：\n${failedRows.slice(0, 10).join('\n')}`;
            if (failedRows.length > 10) msg += `\n...等共 ${failedRows.length} 筆`;
          }
          alert(msg);
        }
      } catch (error) {
        console.error("Error parsing Excel", error);
        alert('讀取檔案錯誤。');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleSelectAll = (records: ActivityRecord[]) => {
    if (selectedRecordIds.size === records.length && records.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(records.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedRecordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRecordIds(next);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">課外活動紀錄</h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-slate-500">新增課外活動紀錄 ({currentAcademicYear})</p>
            {userRole === 'admin' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">目前操作戶口:</span>
                <select 
                  value={impersonatedUserEmail} 
                  onChange={(e) => setImpersonatedUserEmail(e.target.value)}
                  className="text-sm border border-slate-300 rounded-md px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">(本人/顯示全部紀錄)</option>
                  {appUsers?.filter(u => u.role === 'editor' || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.email}>{u.displayName || u.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {canEditOrAdd && (
            <div className="flex gap-2 mr-4 border-r border-slate-200 pr-4">
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Upload size={18} />
                <span>批量匯入</span>
              </button>
              <button 
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                title="下載 Excel 範本"
              >
                <Download size={18} />
                <span>範本</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-8">
        {canEditOrAdd && (
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">1. 選擇學生</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="搜尋學生 (姓名、學號或班別)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {currentStudents
                .filter(s => {
                  const searchStr = `${s.chineseName} ${s.englishName || ''} ${s.schoolId} ${s.className}`.toLowerCase();
                  return !searchTerm.trim() || searchStr.includes(searchTerm.toLowerCase());
                })
                .map(student => (
                  <div 
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-3 cursor-pointer transition-colors flex justify-between items-center ${selectedStudentId === student.id ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}`}
                  >
                    <div>
                      <div className={`font-medium ${selectedStudentId === student.id ? 'text-indigo-700' : 'text-slate-900'}`}>{student.chineseName}</div>
                      <div className="text-xs text-slate-500">{student.className} ({student.classNumber})</div>
                    </div>
                  </div>
                ))
              }
              {currentStudents.length === 0 && (
                <div className="p-4 text-sm text-slate-500 text-center">找不到學生</div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-100 transition-opacity">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              2. 活動內容 {selectedStudentId && currentStudents.find(s => s.id === selectedStudentId) && <span className="text-indigo-600">({currentStudents.find(s => s.id === selectedStudentId)?.chineseName})</span>}
            </h3>
            
            <fieldset disabled={!selectedStudentId} className="space-y-4 disabled:opacity-50">
              

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">活動中文名稱 *</label>
                <input type="text" required value={formData.chineseName} onChange={e => setFormData({...formData, chineseName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">活動英文名稱（如有）</label>
                <input type="text" value={formData.englishName} onChange={e => setFormData({...formData, englishName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">主辦 / 合辦機構名稱 *</label>
                <input type="text" required value={formData.organizer} onChange={e => setFormData({...formData, organizer: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">獲得獎項（如有）</label>
                <input type="text" value={formData.awardObtained} onChange={e => setFormData({...formData, awardObtained: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">相關資料簡介（如有）</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-20 focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={!selectedStudentId || !formData.chineseName || !formData.organizer || !formData.description}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <Plus size={18} />
                  <span>新增紀錄</span>
                </button>
                {showSuccess && (
                  <p className="text-emerald-600 text-sm text-center mt-2 font-medium">紀錄已成功新增！</p>
                )}
              </div>
            </fieldset>
          </form>
        </div>
        )}

        <div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
              <h3 className="text-lg font-bold text-slate-800">
                活動紀錄清單
                {selectedStudentId && currentStudents.find(s => s.id === selectedStudentId) && (
                  <span className="text-indigo-600 ml-2">({currentStudents.find(s => s.id === selectedStudentId)?.chineseName})</span>
                )}
              </h3>
              
              <div className="flex items-center gap-3">
                {selectedRecordIds.size > 0 && canEditOrAdd && (
                  <button 
                    onClick={() => setDeleteModal({ isOpen: true, type: 'bulk', count: selectedRecordIds.size })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-md hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={16} />
                    <span>刪除 ({selectedRecordIds.size})</span>
                  </button>
                )}
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="搜尋紀錄..."
                    value={recordSearchTerm}
                    onChange={(e) => setRecordSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 lg:w-64"
                  />
                </div>
              </div>
            </div>

            <div className="p-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
                  <tr>
                    {canEditOrAdd && (
                      <th className="px-4 py-3 w-12">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedRecordIds.size > 0 && selectedRecordIds.size === displayedRecords.length}
                          onChange={() => toggleSelectAll(displayedRecords)}
                        />
                      </th>
                    )}
                    {!selectedStudentId && <th className="px-4 py-3 whitespace-nowrap">學生 (班別)</th>}
                    <th className="px-4 py-3 whitespace-nowrap">日期</th>
                    <th className="px-4 py-3 whitespace-nowrap">活動名稱</th>
                    <th className="px-4 py-3 whitespace-nowrap">主辦機構</th>
                    <th className="px-4 py-3 whitespace-nowrap">獎項</th>
                    <th className="px-4 py-3 whitespace-nowrap">負責老師</th>
                    {canEditOrAdd && <th className="px-4 py-3 text-right whitespace-nowrap">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRecords.map(record => {
                      const student = students.find(s => s.id === record.studentId);
                      const canModify = userRole === 'admin' || record.recordedBy === user?.email;
                      let recordedByUser = appUsers?.find(u => u.email === record.recordedBy || u.displayName === record.recordedBy);
                      let displayTeacher = recordedByUser?.teacherAbbreviation || record.recordedBy;
                      
                      return (
                        <tr key={record.id} className={`${selectedRecordIds.has(record.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                          {canEditOrAdd && (
                            <td className="px-4 py-3">
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                checked={selectedRecordIds.has(record.id)}
                                onChange={() => toggleSelect(record.id)}
                                disabled={!canModify}
                              />
                            </td>
                          )}
                          {!selectedStudentId && (
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-900">{student?.chineseName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{student?.className} ({student?.classNumber})</div>
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-slate-800">{record.date}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{record.chineseName}</div>
                            {record.englishName && <div className="text-xs text-slate-500">{record.englishName}</div>}
                            <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={record.description}>{record.description}</div>
                          </td>
                          <td className="px-4 py-3 max-w-[150px] truncate" title={record.organizer}>
                            {record.organizer}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {record.awardObtained ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                {record.awardObtained}
                              </span>
                            ) : <span className="text-slate-400 text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="truncate max-w-[100px] block" title={record.recordedBy}>{displayTeacher}</span>
                          </td>
                          {canEditOrAdd && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {canModify ? (
                                <>
                                  <button 
                                    onClick={() => setEditModal({ isOpen: true, record })}
                                    className="text-slate-400 hover:text-indigo-600 p-1 transition-colors mr-1"
                                    title="編輯"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteModal({ isOpen: true, type: 'single', id: record.id })}
                                    className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                                    title="刪除"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded">不可修改</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                  })}
                  {displayedRecords.length === 0 && (
                    <tr>
                      <td colSpan={selectedStudentId ? (canEditOrAdd ? 7 : 6) : (canEditOrAdd ? 8 : 7)} className="px-4 py-8 text-center text-slate-500">
                        {selectedStudentId ? '此學生尚無活動紀錄' : '暫無活動紀錄'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && editModal.record && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">編輯活動紀錄</h3>
              <button onClick={() => setEditModal({ isOpen: false, record: null })} className="text-slate-400 hover:text-slate-600"><span className="text-xl leading-none">&times;</span></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">活動中文名稱 *</label>
                  <input type="text" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={editModal.record.chineseName} onChange={e => setEditModal({...editModal, record: {...editModal.record!, chineseName: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">活動英文名稱（如有）</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={editModal.record.englishName || ''} onChange={e => setEditModal({...editModal, record: {...editModal.record!, englishName: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">主辦 / 合辦機構名稱 *</label>
                  <input type="text" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={editModal.record.organizer} onChange={e => setEditModal({...editModal, record: {...editModal.record!, organizer: e.target.value}})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">相關資料簡介（如有）</label>
                  <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 h-20 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={editModal.record.description} onChange={e => setEditModal({...editModal, record: {...editModal.record!, description: e.target.value}})}></textarea>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">獲得獎項（如有）</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={editModal.record.awardObtained || ''} onChange={e => setEditModal({...editModal, record: {...editModal.record!, awardObtained: e.target.value}})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setEditModal({ isOpen: false, record: null })} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">取消</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">儲存變更</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={() => {
          if (deleteModal.type === 'bulk') {
            bulkDeleteActivityRecords(Array.from(selectedRecordIds));
            setSelectedRecordIds(new Set());
          } else if (deleteModal.id) {
            deleteActivityRecord(deleteModal.id);
            const next = new Set(selectedRecordIds);
            next.delete(deleteModal.id);
            setSelectedRecordIds(next);
          }
          setDeleteModal({ isOpen: false, type: 'single' });
        }}
        title={deleteModal.type === 'bulk' ? '大量刪除紀錄' : '刪除活動紀錄'}
        message={
          deleteModal.type === 'bulk' 
            ? <>您確定要刪除選取的 <strong>{deleteModal.count}</strong> 筆紀錄嗎？<br/>此操作無法復原！</>
            : <>您確定要刪除這筆紀錄嗎？<br/>此操作無法復原！</>
        }
      />
    </div>
  );
};
