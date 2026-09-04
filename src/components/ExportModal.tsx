import React, { useState, useMemo } from 'react';
import { X, Download } from 'lucide-react';
import { Student } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (recordType: 'awards' | 'activities', filterType: 'all' | 'grade' | 'class', filterValue: string) => void;
  students: Student[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen, onClose, onExport, students
}) => {
  const [recordType, setRecordType] = useState<'awards' | 'activities'>('awards');
  const [filterType, setFilterType] = useState<'all' | 'grade' | 'class'>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(students.map(s => s.className))).filter(Boolean).sort();
  }, [students]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    uniqueClasses.forEach(c => {
      // Typically class names are like "1A", "2B", "3C", "中一A"
      // We extract everything except the last character if the last character is a letter
      const match = c.match(/^(.*?)[A-Za-z]$/);
      if (match && match[1]) {
        grades.add(match[1].trim());
      } else {
        // Fallback: use the first character(s) if it's a number
        const numMatch = c.match(/^(\d+)/);
        if (numMatch) grades.add(numMatch[1]);
        else grades.add(c.charAt(0));
      }
    });
    return Array.from(grades).filter(Boolean).sort();
  }, [uniqueClasses]);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(recordType, filterType, filterValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-8">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Download size={20} className="text-indigo-600" />
              匯出本學年紀錄 (Excel)
            </h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">匯出資料類型</label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as 'awards' | 'activities')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="awards">全校獎勵紀錄清單</option>
                <option value="activities">全校課外活動／比賽紀錄清單</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">匯出範圍</label>
              <select
                value={filterType}
                onChange={(e) => {
                  const type = e.target.value as 'all' | 'grade' | 'class';
                  setFilterType(type);
                  if (type === 'class') setFilterValue(uniqueClasses[0] || '');
                  else if (type === 'grade') setFilterValue(uniqueGrades[0] || '');
                  else setFilterValue('');
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">全校所有紀錄</option>
                <option value="grade">按年級匯出</option>
                <option value="class">按班別匯出</option>
              </select>
            </div>

            {filterType === 'grade' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">選擇年級</label>
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {uniqueGrades.length === 0 && <option value="">無年級資料</option>}
                  {uniqueGrades.map(g => (
                    <option key={g} value={g}>{g} 年級</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">提示：系統自動根據班別名稱擷取年級 (例如從 1A 擷取 1)。</p>
              </div>
            )}

            {filterType === 'class' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">選擇班別</label>
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {uniqueClasses.length === 0 && <option value="">無班別資料</option>}
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>{c} 班</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2"
            >
              <Download size={16} />
              確認匯出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
