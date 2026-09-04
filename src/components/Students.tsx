import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../context';
import { Student } from '../types';
import { Search, Plus, Trash2, Edit2, X, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export const Students = () => {
  const { students, currentAcademicYear, addStudent, deleteStudent, bulkUpsertStudents, updateStudent, bulkDeleteStudents } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, type: 'single'|'bulk', id?: string, count?: number, name?: string}>({isOpen: false, type: 'single'});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const wsData = [
      ['校內編號', '班別', '學號', '英文姓名', '中文姓名', '學生電郵'],
      ['2025-001', '1A', '1', 'Chan Tai Man', '陳大文', 'chantaiman@example.com'],
      ['2025-002', '1A', '2', 'Lee Siu Ming', '李小明', 'leesiouming@example.com']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '學生名單範本');
    XLSX.writeFile(wb, '學生名單匯入範本.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const newStudents: Omit<Student, 'id'>[] = [];
        const failedRows: string[] = [];
        
        data.forEach((row: any, index: number) => {
          const schoolId = String(row['校內編號'] || '');
          const chineseName = String(row['中文姓名'] || '');
          
          if (!schoolId || !chineseName) {
            failedRows.push(`第 ${index + 2} 行 (缺少校內編號或中文姓名)`);
            return;
          }
          
          newStudents.push({
            schoolId,
            chineseName,
            englishName: String(row['英文姓名'] || ''),
            className: String(row['班別'] || ''),
            classNumber: Number(row['學號'] || 1),
            email: String(row['學生電郵'] || ''),
            academicYear: currentAcademicYear
          });
        });

        if (newStudents.length > 0) {
          bulkUpsertStudents(newStudents);
          let msg = `成功匯入或更新 ${newStudents.length} 筆學生資料！`;
          if (failedRows.length > 0) {
            msg += `\n\n有 ${failedRows.length} 筆資料匯入失敗：\n${failedRows.slice(0, 10).join('\n')}`;
            if (failedRows.length > 10) msg += `\n...等共 ${failedRows.length} 筆`;
          }
          alert(msg);
        } else {
          alert('找不到有效的學生資料，請確認格式是否與範本相符。');
        }
      } catch (error) {
        console.error("Error parsing Excel file", error);
        alert('讀取檔案時發生錯誤。');
      }
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredStudents = students.filter(s => 
    s.academicYear === currentAcademicYear &&
    (s.chineseName.includes(searchTerm) || 
     s.englishName.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.schoolId.includes(searchTerm))
  ).sort((a, b) => {
    if (a.className === b.className) {
      return (a.classNumber || 0) - (b.classNumber || 0);
    }
    return a.className.localeCompare(b.className);
  });

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteModal({ isOpen: true, type: 'bulk', count: selectedIds.size });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">學生管理</h2>
          <p className="text-slate-500 mt-1">管理 {currentAcademicYear} 學年的學生資料</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
            >
              <Trash2 size={18} />
              大量刪除 ({selectedIds.size})
            </button>
          )}
          <button 
            onClick={handleDownloadTemplate}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            <Download size={18} />
            下載範本
          </button>
          
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            <Upload size={18} />
            匯入 Excel
          </button>

          <button 
            onClick={() => {
              setEditingStudent(null);
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            <Plus size={18} />
            新增學生
          </button>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="搜尋姓名、校內編號或班別..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">校內編號</th>
                <th className="px-6 py-4">班別 (學號)</th>
                <th className="px-6 py-4">中文姓名</th>
                <th className="px-6 py-4">英文姓名</th>
                <th className="px-6 py-4">學生電郵</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(student.id) ? 'bg-indigo-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleSelect(student.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{student.schoolId}</td>
                    <td className="px-6 py-4">{student.className} ({student.classNumber})</td>
                    <td className="px-6 py-4">{student.chineseName}</td>
                    <td className="px-6 py-4">{student.englishName}</td>
                    <td className="px-6 py-4">{student.email || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setEditingStudent(student);
                          setIsModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-2 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setDeleteModal({ isOpen: true, type: 'single', id: student.id, name: student.chineseName });
                        }}
                        className="text-slate-400 hover:text-red-600 p-2 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    找不到符合的學生資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <StudentFormModal 
          onClose={() => setIsModalOpen(false)} 
          onAdd={addStudent}
          onUpdate={updateStudent}
          academicYear={currentAcademicYear}
          initialData={editingStudent}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={() => {
          if (deleteModal.type === 'bulk') {
            bulkDeleteStudents(Array.from(selectedIds));
            setSelectedIds(new Set());
          } else if (deleteModal.id) {
            deleteStudent(deleteModal.id);
            const next = new Set(selectedIds);
            next.delete(deleteModal.id);
            setSelectedIds(next);
          }
        }}
        title={deleteModal.type === 'bulk' ? '大量刪除學生' : '刪除學生'}
        message={
          deleteModal.type === 'bulk' 
            ? <>您確定要刪除選取的 <strong>{deleteModal.count}</strong> 位學生嗎？<br/>這將同時刪除他們在該學年的所有獎勵紀錄，且無法復原！</>
            : <>您確定要刪除學生 <strong>{deleteModal.name}</strong> 嗎？<br/>這將同時刪除他在該學年的所有獎勵紀錄，且無法復原！</>
        }
        requireInputText="刪除"
      />
    </div>
  );
};

const StudentFormModal = ({ onClose, onAdd, onUpdate, academicYear, initialData }: { 
  onClose: () => void, 
  onAdd: (s: Omit<Student, 'id'>) => void, 
  onUpdate: (s: Student) => void,
  academicYear: string,
  initialData: Student | null
}) => {
  const [formData, setFormData] = useState({
    schoolId: initialData?.schoolId || '',
    chineseName: initialData?.chineseName || '',
    englishName: initialData?.englishName || '',
    className: initialData?.className || '',
    classNumber: initialData?.classNumber || 1,
    email: initialData?.email || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData) {
      onUpdate({
        ...initialData,
        ...formData,
      });
    } else {
      onAdd({
        ...formData,
        academicYear
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? '編輯學生' : '新增學生'} ({academicYear})
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">校內編號</label>
            <input required type="text" value={formData.schoolId} onChange={e => setFormData({...formData, schoolId: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">中文姓名</label>
              <input required type="text" value={formData.chineseName} onChange={e => setFormData({...formData, chineseName: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">英文姓名</label>
              <input type="text" value={formData.englishName} onChange={e => setFormData({...formData, englishName: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">班別</label>
              <input required type="text" value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} placeholder="例如: 1A" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">學號</label>
              <input required type="number" min={1} value={formData.classNumber} onChange={e => setFormData({...formData, classNumber: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">學生電郵</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="例如: student@example.com" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">儲存</button>
          </div>
        </form>
      </div>
    </div>
  );
};
