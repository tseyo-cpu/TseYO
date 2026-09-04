import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../context';
import { AwardType, Category, AwardTypeLabels, CategoryLabels, DefaultCategorySubcategories, AcademicTerm } from '../types';
import { Search, CheckCircle, Trash2, Edit2, Upload, Download, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditRecordModal } from './EditRecordModal';

export const AwardEntry = () => {
  const { user, userRole, students, records, currentAcademicYear, academicYears, subCategories, updateSubCategories, addRecord, updateRecord, deleteRecord, bulkAddRecords, bulkDeleteRecords, approveRecords, appUsers } = useAppContext();
  
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
const latestAcademicYear = useMemo(() => {
    return [...(academicYears || [])].sort((a, b) => b.localeCompare(a))[0];
  }, [academicYears]);
  
  const isLatestAcademicYear = currentAcademicYear === latestAcademicYear;
  const canEditOrAdd = userRole === 'admin' || (userRole === 'editor' && isLatestAcademicYear);

  const currentRecords = records.filter(r => r.academicYear === currentAcademicYear);

  const duplicateRecordIds = useMemo(() => {
    const counts: Record<string, string[]> = {};
    currentRecords.forEach(r => {
      const key = `${r.studentId}-${r.term}-${r.category}-${r.subCategory}`;
      if (!counts[key]) counts[key] = [];
      counts[key].push(r.id);
    });
    const duplicates = new Set<string>();
    Object.values(counts).forEach(ids => {
      if (ids.length >= 2) {
        ids.forEach(id => duplicates.add(id));
      }
    });
    return duplicates;
  }, [currentRecords]);


  const [searchTerm, setSearchTerm] = useState('');
  const [recordSearchTerm, setRecordSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, type: 'single'|'bulk', id?: string, count?: number}>({isOpen: false, type: 'single'});
  const [deleteOldRecordsModal, setDeleteOldRecordsModal] = useState<{isOpen: boolean, step: number}>({ isOpen: false, step: 0 });
  const [editModal, setEditModal] = useState<{isOpen: boolean, record: any | null}>({isOpen: false, record: null});
  const [impersonatedUserEmail, setImpersonatedUserEmail] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    term: '全年' as AcademicTerm,
    category: 'subject' as Category,
    subCategory: subCategories['subject']?.[0] || DefaultCategorySubcategories['subject']?.[0] || '',
    awardType: 'advantage' as AwardType,
    count: 1,
    description: '表現良好',
    position: '',
    recordedBy: '登入老師' // Dummy for now
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredStudents = currentStudents.filter(s => 
    s.chineseName.includes(searchTerm) || 
    s.englishName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.schoolId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedRecords = useMemo(() => {
    return currentRecords.filter(r => {
      const student = students.find(s => s.id === r.studentId);
      const searchStr = `${r.description} ${r.subCategory || ''} ${r.position || ''} ${student?.chineseName || ''} ${student?.className || ''}`.toLowerCase();
      
      const matchesSearch = !recordSearchTerm.trim() || searchStr.includes(recordSearchTerm.toLowerCase());
      const matchesStudent = !selectedStudentId || r.studentId === selectedStudentId;
      
      let matchesUser = false;
      if (userRole === 'admin') {
        if (impersonatedUserEmail) {
          matchesUser = r.recordedBy === impersonatedUserEmail || r.recordedBy === appUsers.find(u => u.email === impersonatedUserEmail)?.displayName;
        } else {
          matchesUser = true; // Admin sees all records if no one is selected
        }
      } else {
        matchesUser = r.recordedBy === user?.email || r.recordedBy === user?.displayName || r.recordedBy === '登入老師';
      }
      
      return matchesSearch && matchesStudent && matchesUser;
    }).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [currentRecords, recordSearchTerm, selectedStudentId, user?.email, user?.displayName, students, userRole, impersonatedUserEmail, appUsers]);

  const selectedStudent = currentStudents.find(s => s.id === selectedStudentId);

  const handleAdminTemplateDownload = () => {
    // Generate headers from CategoryLabels
    const categories = Object.keys(CategoryLabels) as Category[];
    const wsData: string[][] = [];
    
    // Header row
    const headers = categories.map(cat => CategoryLabels[cat]);
    wsData.push(headers);
    
    // Find max length of subcategories
    let maxLen = 0;
    for (const cat of categories) {
      const len = (subCategories[cat] || DefaultCategorySubcategories[cat] || []).length;
      if (len > maxLen) maxLen = len;
    }
    
    // Fill data rows
    for (let i = 0; i < maxLen; i++) {
      const row: string[] = [];
      for (const cat of categories) {
        const subs = subCategories[cat] || DefaultCategorySubcategories[cat] || [];
        row.push(subs[i] || '');
      }
      wsData.push(row);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "細項分類");
    XLSX.writeFile(wb, "subcategory_template.xlsx");
  };

  const activeRecordedBy = userRole === 'admin' && impersonatedUserEmail 
    ? (appUsers.find(u => u.email === impersonatedUserEmail)?.displayName || impersonatedUserEmail)
    : (user?.displayName || user?.email || 'Unknown');

  const handleAdminFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

        if (data.length > 0) {
          const headers = data[0];
          const newSubCats: Partial<Record<Category, string[]>> = {};

          headers.forEach((header, index) => {
            if (!header) return;
            const catKey = Object.keys(CategoryLabels).find(key => CategoryLabels[key as Category] === header) as Category;
            if (catKey) {
              newSubCats[catKey] = [];
              for (let i = 1; i < data.length; i++) {
                const val = data[i][index];
                if (val && String(val).trim()) {
                  newSubCats[catKey]?.push(String(val).trim());
                }
              }
            }
          });

          // Merge with default/existing
          const finalSubCats: Record<Category, string[]> = { ...DefaultCategorySubcategories, ...subCategories };
          for (const key of Object.keys(finalSubCats)) {
            if (newSubCats[key as Category]) {
              finalSubCats[key as Category] = newSubCats[key as Category]!;
            }
          }

          await updateSubCategories(finalSubCats);
          alert('細項分類更新成功！');
        }
      } catch (error) {
        console.error("Error parsing Admin Excel file", error);
        alert('讀取檔案時發生錯誤。');
      }
      if (adminFileInputRef.current) adminFileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ['負責老師簡稱', '活動類型', '負責單位', '獲獎學期', '校內編號', '所獲獎項', '所獲獎項數目', '負責崗位（如有）', '獲獎理由', '日期'],
      ['CHAN', '科目', '中文科', '第一學期', '2025-001', '優點', '1', '', '默書滿分', '2025-12-01'],
      ['LEE', '校外比賽', '視藝比賽', '全年', '2025-002', '小功', '1', '隊長', '朗誦優異', '2025-12-05']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '學生獎勵紀錄範本');
    XLSX.writeFile(wb, '學生獎勵紀錄範本.xlsx');
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
          
          let term = row['獲獎學期'] || '全年';
          if (!['第一學期', '第二學期', '上學期', '下學期', '全年'].includes(term)) {
            term = '全年';
          }
          
          const catLabel = row['活動類型'] || row['分類'];
          const category = (Object.keys(CategoryLabels).find(key => CategoryLabels[key as Category] === catLabel) || 'other') as Category;
          
          const subCategory = String(row['負責單位'] || row['細項'] || '');
          const position = String(row['負責崗位（如有）'] || row['負責崗位'] || row['崗位'] || '');
          
          const typeLabel = row['所獲獎項'] || row['獎勵類型'];
          const awardType = (Object.keys(AwardTypeLabels).find(key => AwardTypeLabels[key as AwardType] === typeLabel) || 'advantage') as AwardType;
          
          let count = Number(row['所獲獎項數目'] || row['數量']);
          if (isNaN(count)) count = 1;
          if (count < 0) count = 0;
          if (count > 2) count = 2;
          
          const description = String(row['獲獎理由'] || row['描述'] || '');
          
          const recordedByOverride = String(row['負責老師簡稱'] || row['負責老師'] || '');
          let finalRecordedBy = activeRecordedBy;
          if (recordedByOverride) {
            const matchedUser = appUsers?.find(u => u.teacherAbbreviation === recordedByOverride || u.displayName === recordedByOverride || u.email === recordedByOverride);
            finalRecordedBy = matchedUser ? matchedUser.email : recordedByOverride;
          }

          newRecords.push({
            studentId: student.id,
            academicYear: currentAcademicYear,
            term: term as AcademicTerm,
            date,
            category,
            subCategory,
            position,
            awardType,
            count,
            description,
            recordedBy: finalRecordedBy
          });
        });

        if (newRecords.length > 0) {
          bulkAddRecords(newRecords);
          let msg = `成功匯入 ${newRecords.length} 筆獎勵紀錄！`;
          if (failedRows.length > 0) {
            msg += `\n\n有 ${failedRows.length} 筆資料匯入失敗：\n${failedRows.slice(0, 10).join('\n')}`;
            if (failedRows.length > 10) msg += `\n...等共 ${failedRows.length} 筆`;
          }
          alert(msg);
        } else {
          let msg = '找不到有效的紀錄，請確認「校內編號」是否在目前學年中存在，並檢查格式。';
          if (failedRows.length > 0) {
            msg += `\n\n失敗原因：\n${failedRows.slice(0, 10).join('\n')}`;
            if (failedRows.length > 10) msg += `\n...等共 ${failedRows.length} 筆`;
          }
          alert(msg);
        }
      } catch (error) {
        console.error("Error parsing Excel file", error);
        alert('讀取檔案時發生錯誤。');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeleteOldRecords = () => {
    const oldRecordIds = records.filter(r => r.academicYear !== latestAcademicYear).map(r => r.id);
    if (oldRecordIds.length === 0) {
      alert('沒有最新年度之前的紀錄。');
      return;
    }
    bulkDeleteRecords(oldRecordIds); setSelectedRecordIds(new Set());
    setDeleteOldRecordsModal({ isOpen: false, step: 0 });
  };

  const handleBulkDelete = () => {
    if (selectedRecordIds.size === 0) return;
    setDeleteModal({ isOpen: true, type: 'bulk', count: selectedRecordIds.size });
  };

  const toggleSelectAll = (records: any[]) => {
    const modifiableRecords = records.filter(r => userRole === 'admin' || r.status !== 'approved');
    if (selectedRecordIds.size === modifiableRecords.length && modifiableRecords.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(modifiableRecords.map(r => r.id)));
    }
  };

  const handleBulkApprove = () => {
    if (userRole !== 'admin') return;
    approveRecords(Array.from(selectedRecordIds));
    setSelectedRecordIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedRecordIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRecordIds(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    addRecord({
      studentId: selectedStudentId,
      academicYear: currentAcademicYear,
      ...formData,
      recordedBy: activeRecordedBy
    });

    // Completely reset the form to un-inputted state
    setSelectedStudentId('');
    setSearchTerm('');
    setFormData({
      date: new Date().toISOString().split('T')[0],
      term: '全年' as AcademicTerm,
      category: 'subject' as Category,
      subCategory: subCategories['subject']?.[0] || DefaultCategorySubcategories['subject']?.[0] || '',
      awardType: 'advantage' as AwardType,
      count: 1,
      description: '表現良好',
      position: '',
      recordedBy: '登入老師'
    });
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">學生獎勵紀錄</h2>
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-slate-500">新增學生獎勵紀錄 ({currentAcademicYear})</p>
            {userRole === 'admin' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">目前操作戶口:</span>
                <select 
                  value={impersonatedUserEmail} 
                  onChange={(e) => setImpersonatedUserEmail(e.target.value)}
                  className="text-sm border border-slate-300 rounded-md px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">(本人/顯示全部紀錄)</option>
                  {appUsers.filter(u => u.role === 'editor' || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.email}>{u.displayName || u.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end items-center mt-2 md:mt-0">
          {userRole === 'admin' && (
            <div className="flex gap-2 mr-2 pr-4 border-r border-slate-200">
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                ref={adminFileInputRef} 
                onChange={handleAdminFileUpload} 
              />
              <button 
                onClick={handleAdminTemplateDownload}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"
              >
                <Download size={16} />
                活動類型範本
              </button>
              <button 
                onClick={() => adminFileInputRef.current?.click()}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"
              >
                <Settings size={16} />
                匯入活動類型
              </button>
              <button 
                onClick={() => setDeleteOldRecordsModal({ isOpen: true, step: 1 })}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm ml-2 border border-red-200"
              >
                <Trash2 size={16} />
                清空舊學年紀錄
              </button>
            </div>
          )}
          {canEditOrAdd && (
            <div className="flex gap-2 flex-wrap justify-end">
              {selectedRecordIds.size > 0 && (
                <>
                  {userRole === 'admin' && (
                    <button 
                      onClick={handleBulkApprove}
                      className="bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"
                    >
                      <CheckCircle size={16} />
                      大量確認 ({selectedRecordIds.size})
                    </button>
                  )}
                  <button 
                    onClick={handleBulkDelete}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"
                  >
                    <Trash2 size={16} />
                    大量刪除 ({selectedRecordIds.size})
                  </button>
                </>
              )}
              
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"
              >
                <Upload size={16} />
                批量匯入
              </button>
              <button 
                onClick={handleDownloadTemplate}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm"
              >
                <Download size={16} />
                下載範本
              </button>
            </div>
          )}
        </div>
      </header>


      <div className="space-y-8">
        
        {/* Left Column: Form */}
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
              {filteredStudents.length > 0 ? (
                filteredStudents.map(student => (
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
              ) : (
                <div className="p-4 text-sm text-slate-500 text-center">找不到學生</div>
              )}
            </div>
          </div>


          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 opacity-100 transition-opacity">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              2. 獎勵內容 {selectedStudent && <span className="text-indigo-600">({selectedStudent.chineseName})</span>}
            </h3>
            
            <fieldset disabled={!selectedStudentId} className="space-y-4 disabled:opacity-50">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">獲獎學期</label>
                  <select 
                    value={formData.term}
                    onChange={e => setFormData({...formData, term: e.target.value as AcademicTerm})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                  >
                    <option value="第一學期">第一學期</option>
                    <option value="第二學期">第二學期</option>
                    <option value="全年">全年</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">活動類型</label>
                  <select 
                    value={formData.category}
                    onChange={e => {
                      const newCat = e.target.value as Category;
                      const subCatList = subCategories[newCat] || DefaultCategorySubcategories[newCat] || [];
                      setFormData({
                        ...formData, 
                        category: newCat,
                        subCategory: subCatList[0] || ''
                      });
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                  >
                    {Object.entries(CategoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">負責單位</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.subCategory}
                      onChange={e => setFormData({...formData, subCategory: e.target.value})}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      placeholder="請選擇或輸入負責單位..."
                      className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                  {showDropdown && (
                    <ul className="absolute z-10 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {(() => {
                        const allOptions = subCategories[formData.category] || DefaultCategorySubcategories[formData.category] || [];
                        const isExactMatch = allOptions.includes(formData.subCategory);
                        const displayOptions = isExactMatch 
                          ? allOptions 
                          : allOptions.filter(sub => sub.toLowerCase().includes(formData.subCategory.toLowerCase()));
                        
                        if (displayOptions.length === 0) {
                          return <li className="px-4 py-2 text-sm text-slate-500 italic">無符合項目，將直接建立新單位</li>;
                        }
                        
                        return displayOptions.map(sub => (
                          <li 
                            key={sub} 
                            className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur
                              setFormData({...formData, subCategory: sub});
                              setShowDropdown(false);
                            }}
                          >
                            {sub}
                          </li>
                        ));
                      })()}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">獎勵類型</label>
                  <select 
                    value={formData.awardType}
                    onChange={e => setFormData({...formData, awardType: e.target.value as AwardType})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                  >
                    {Object.entries(AwardTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">負責崗位 (選填)</label>
                  <select
                    value={formData.position}
                    onChange={e => setFormData({...formData, position: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                  >
                    <option value="">無 / 不適用</option>
                    {['主席', '副主席', '內副主席', '外副主席', '幹事', '總隊長', '副隊長', '小隊隊長', '隊長', '隊員', '組長', '副組長', '總務', '文書', '康樂', '財政', '美術', '班長', '科長', '班務助理', '工作人員', '會員'].map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">所獲獎勵數目</label>
                  <select
                    value={formData.count}
                    onChange={e => setFormData({...formData, count: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">獲獎理由</label>
                <textarea 
                  required
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm resize-none" 
                  placeholder="請輸入獲獎理由..."
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={!selectedStudentId}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                  {showSuccess ? <><CheckCircle size={18} /> 資料已同步至雲端</> : '儲存紀錄'}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
        )}

        {/* Right Column: Recent Records for this student or all */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedStudent ? `${selectedStudent.chineseName} 的近期紀錄` : '您的所有輸入紀錄'}
              </h3>
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
            <div className="p-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0">
                  <tr>
                    {canEditOrAdd && (
                      <th className="px-4 py-3 w-12">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedRecordIds.size > 0 && selectedRecordIds.size === displayedRecords.filter(r => userRole === 'admin' || r.status !== 'approved').length}
                          onChange={() => toggleSelectAll(displayedRecords)}
                        />
                      </th>
                    )}
                    {!selectedStudentId && <th className="px-4 py-3 whitespace-nowrap">學生 (班別)</th>}
                    <th className="px-4 py-3 whitespace-nowrap">日期 / 學期</th>
                    <th className="px-4 py-3 whitespace-nowrap">活動詳情</th>
                    <th className="px-4 py-3 whitespace-nowrap">狀態</th>
                    <th className="px-4 py-3 whitespace-nowrap">獎勵</th>
                    <th className="px-4 py-3 whitespace-nowrap">獲獎理由</th>
                    {canEditOrAdd && <th className="px-4 py-3 text-right whitespace-nowrap">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRecords.map(record => {
                      const student = students.find(s => s.id === record.studentId);
                      const canModify = canEditOrAdd && (userRole === 'admin' || record.status !== 'approved');
                      
                      return (
                        <tr key={record.id} className={`${duplicateRecordIds.has(record.id) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'} ${selectedRecordIds.has(record.id) ? 'bg-indigo-50/50' : ''}`}>
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
                            <div className="text-xs text-slate-500 mt-0.5">{record.term || '全年'}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-slate-800">{CategoryLabels[record.category]}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {record.subCategory || '-'} {record.position ? `[${record.position}]` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {record.status === 'pending' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                待確認
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                已確認
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {AwardTypeLabels[record.awardType]} x{record.count}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={record.description}>
                            {record.description}
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
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      <EditRecordModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, record: null })}
        record={editModal.record}
        onSave={(record) => {
          updateRecord(record);
        }}
        subCategories={subCategories}
      />

      <ConfirmDeleteModal
        isOpen={deleteOldRecordsModal.isOpen && deleteOldRecordsModal.step === 1}
        onClose={() => setDeleteOldRecordsModal({ isOpen: false, step: 0 })}
        onConfirm={() => setDeleteOldRecordsModal({ isOpen: true, step: 2 })}
        title="⚠ 警告：清空舊學年紀錄"
        message={
          <>您確定要刪除 <strong>最新學年（{latestAcademicYear}）之前</strong> 的所有獎勵紀錄嗎？<br/><br/>這將會刪除所有過往學年的資料，這一步驟為<strong>第一次確認</strong>。</>
        }
      />
      <ConfirmDeleteModal
        isOpen={deleteOldRecordsModal.isOpen && deleteOldRecordsModal.step === 2}
        onClose={() => setDeleteOldRecordsModal({ isOpen: false, step: 0 })}
        onConfirm={() => setDeleteOldRecordsModal({ isOpen: true, step: 3 })}
        title="⚠ 嚴重警告：再次確認"
        message={
          <>您即將刪除 <strong>最新學年（{latestAcademicYear}）之前</strong> 的所有獎勵紀錄。<br/><br/>刪除後資料將<strong>無法復原</strong>！您真的確定要執行這個操作嗎？（第二次確認）</>
        }
      />
      <ConfirmDeleteModal
        isOpen={deleteOldRecordsModal.isOpen && deleteOldRecordsModal.step === 3}
        onClose={() => setDeleteOldRecordsModal({ isOpen: false, step: 0 })}
        onConfirm={handleDeleteOldRecords}
        title="🚨 最終警告：無法復原的操作"
        message={
          <>這是最後一次確認。<br/><br/>按下確認後，<strong>最新學年（{latestAcademicYear}）之前</strong>的所有獎勵紀錄將被永久刪除！</>
        }
      />

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={() => {
          if (deleteModal.type === 'bulk') {
            bulkDeleteRecords(Array.from(selectedRecordIds));
            setSelectedRecordIds(new Set());
          } else if (deleteModal.id) {
            deleteRecord(deleteModal.id);
            const next = new Set(selectedRecordIds);
            next.delete(deleteModal.id);
            setSelectedRecordIds(next);
          }
        }}
        title={deleteModal.type === 'bulk' ? '大量刪除紀錄' : '刪除獎勵紀錄'}
        message={
          deleteModal.type === 'bulk' 
            ? <>您確定要刪除選取的 <strong>{deleteModal.count}</strong> 筆紀錄嗎？<br/>此操作無法復原！</>
            : <>您確定要刪除這筆紀錄嗎？<br/>此操作無法復原！</>
        }
      />
    </div>
  );
};
