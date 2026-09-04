import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { AwardTypeLabels, CategoryLabels } from '../types';
import { calculateTotalScore, aggregateAwards } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend , LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import { Search, CheckCircle } from 'lucide-react';
import { ExportModal } from './ExportModal';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6'];

export const Reports = () => {
  const { students, records, activityRecords, currentAcademicYear, academicYears, appUsers, user, userRole, approveRecords } = useAppContext();
  
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
  const currentRecords = records.filter(r => r.academicYear === currentAcademicYear && r.status !== 'pending');
  const allCurrentRecords = records.filter(r => r.academicYear === currentAcademicYear);
  const currentActivityRecords = activityRecords?.filter(r => r.academicYear === currentAcademicYear) || [];
  
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const handleExportExcel = (recordType: 'awards' | 'activities', filterType: 'all' | 'grade' | 'class', filterValue: string) => {
    let targetRecords: any[] = recordType === 'awards' ? currentRecords : currentActivityRecords;
    let exportRecords = targetRecords;
    
    if (filterType !== 'all') {
      exportRecords = targetRecords.filter(record => {
        const student = students.find(s => s.id === record.studentId);
        if (!student) return false;
        
        if (filterType === 'class') {
          return student.className === filterValue;
        } else if (filterType === 'grade') {
          return student.className.startsWith(filterValue);
        }
        return true;
      });
    }

    if (exportRecords.length === 0) {
      alert(`所選範圍 (${filterValue || '全部'}) 沒有任何紀錄可供匯出`);
      return;
    }

    let headers: string[] = [];
    let wsData: any[][] = [];

    if (recordType === 'awards') {
      headers = [
        '負責老師', '活動類型', '負責單位', '獲獎學期', 
        '班別', '學號', '校內編號', '獲獎學生姓名', 
        '所獲獎項', '所獲獎項數目', '負責崗位（如有）', '獲獎理由', '日期'
      ];
      
      const data = exportRecords.map(record => {
        const student = students.find(s => s.id === record.studentId);
        let recordedByUser = appUsers?.find(u => u.email === record.recordedBy || u.displayName === record.recordedBy);
        let teacherName = recordedByUser?.teacherAbbreviation || record.recordedBy;
        if (teacherName === '登入老師') {
          const adminUser = appUsers?.find(u => u.role === 'admin' || u.id === user?.uid);
          teacherName = adminUser?.teacherAbbreviation || '管理者';
        }
        
        return [
          teacherName,
          CategoryLabels[record.category as keyof typeof CategoryLabels] || record.category,
          record.subCategory || '',
          record.term || '全年',
          student?.className || '',
          student?.classNumber || '',
          student?.schoolId || '',
          student?.chineseName || '',
          AwardTypeLabels[record.awardType as keyof typeof AwardTypeLabels] || record.awardType,
          record.count,
          record.position || '',
          record.description || '',
          record.date || ''
        ];
      });
      wsData = [headers, ...data];
    } else {
      headers = [
        '負責老師簡稱', '活動中文名稱', '活動英文名稱（如有）', '主辦/合辦機構', '相關資料簡介（如有）', '班別', '學號', '校內編號', '獲獎學生姓名', '獲得獎項（如有）', '日期'
      ];

      const data = exportRecords.map(record => {
        const student = students.find(s => s.id === record.studentId);
        let recordedByUser = appUsers?.find(u => u.email === record.recordedBy || u.displayName === record.recordedBy);
        let teacherName = recordedByUser?.teacherAbbreviation || record.recordedBy;
        if (teacherName === '登入老師') {
          const adminUser = appUsers?.find(u => u.role === 'admin' || u.id === user?.uid);
          teacherName = adminUser?.teacherAbbreviation || '管理者';
        }

        return [
          teacherName,
          record.chineseName || '',
          record.englishName || '',
          record.organizer || '',
          record.description || '',
          student?.className || '',
          student?.classNumber || '',
          student?.schoolId || '',
          student?.chineseName || '',
          record.awardObtained || '',
          record.date || ''
        ];
      });
      wsData = [headers, ...data];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    const sheetName = recordType === 'awards' ? '獎勵紀錄' : '課外活動紀錄';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${currentAcademicYear}.xlsx`);
  };

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


  const isStudentUser = userRole === 'student';

  const [reportType, setReportType] = useState<'overview' | 'student'>(isStudentUser ? 'student' : 'overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentReportYear, setStudentReportYear] = useState<string>(currentAcademicYear);
  const [searchTerm, setSearchTerm] = useState('');
  const [recordSearchTerm, setRecordSearchTerm] = useState('');

  useEffect(() => {
    if (isStudentUser && user?.email) {
      const me = currentStudents.find(s => s.email === user.email);
      if (me) {
        setSelectedStudentId(me.id);
      }
    } else if (!selectedStudentId) {
      setSelectedStudentId(currentStudents[0]?.id || '');
    }
  }, [currentStudents, user?.email, isStudentUser, selectedStudentId]);

  useEffect(() => {
    if (isStudentUser && reportType !== 'student') {
      setReportType('student');
    }
  }, [isStudentUser, reportType]);

  useEffect(() => {
    setStudentReportYear(currentAcademicYear);
  }, [currentAcademicYear]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return currentStudents;
    const term = searchTerm.toLowerCase();
    return currentStudents.filter(s => 
      s.chineseName.includes(term) || 
      s.englishName.toLowerCase().includes(term) || 
      s.className.toLowerCase().includes(term) ||
      s.schoolId.toLowerCase().includes(term)
    );
  }, [currentStudents, searchTerm]);

  useEffect(() => {
    if (isStudentUser) return;
    if (filteredStudents.length > 0 && !filteredStudents.find(s => s.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId, isStudentUser]);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);
  
  const matchingStudentIds = useMemo(() => {
    const selectedSchoolId = selectedStudent?.schoolId;
    return selectedSchoolId 
      ? students.filter(s => s.schoolId === selectedSchoolId).map(s => s.id)
      : [selectedStudentId];
  }, [students, selectedStudent, selectedStudentId]);

  const selectedStudentRecords = useMemo(() => {
    return records.filter(r => {
      if (r.status === 'pending') return false;
      if (!matchingStudentIds.includes(r.studentId)) return false;
      if (studentReportYear === 'all') return true;
      return r.academicYear === studentReportYear;
    });
  }, [records, matchingStudentIds, studentReportYear]);

  const selectedStudentActivityRecords = useMemo(() => {
    return (activityRecords || []).filter(r => {
      if (!matchingStudentIds.includes(r.studentId)) return false;
      if (studentReportYear === 'all') return true;
      return r.academicYear === studentReportYear;
    });
  }, [activityRecords, matchingStudentIds, studentReportYear]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(CategoryLabels).forEach(k => counts[k] = 0);
    
    const relevantRecords = reportType === 'overview' ? currentRecords : selectedStudentRecords;

    relevantRecords.forEach(r => {
      counts[r.category] += calculateTotalScore([r]); // Weight by score impact
    });

    return Object.entries(counts).map(([key, value]) => ({
      name: CategoryLabels[key as keyof typeof CategoryLabels],
      value
    })).filter(d => d.value > 0);
  }, [currentRecords, reportType, selectedStudentRecords]);

  const classData = useMemo(() => {
    if (reportType !== 'overview') return [];
    
    const classScores: Record<string, number> = {};
    currentStudents.forEach(s => {
      if (!classScores[s.className]) classScores[s.className] = 0;
      const sRecords = currentRecords.filter(r => r.studentId === s.id);
      classScores[s.className] += calculateTotalScore(sRecords);
    });

    return Object.entries(classScores).map(([name, score]) => ({
      name,
      score
    })).sort((a, b) => a.score - b.score);
  }, [currentRecords, currentStudents, reportType]);


  const displayedSchoolRecords = useMemo(() => {
    return allCurrentRecords.filter(r => {
      const student = currentStudents.find(s => s.id === r.studentId);
      const searchStr = `${r.description} ${r.subCategory || ''} ${r.position || ''} ${student?.chineseName || ''} ${student?.className || ''}`.toLowerCase();
      return !recordSearchTerm.trim() || searchStr.includes(recordSearchTerm.toLowerCase());
    });
  }, [allCurrentRecords, currentStudents, recordSearchTerm]);

  const displayedSchoolActivityRecords = useMemo(() => {
    return currentActivityRecords.filter(r => {
      const student = currentStudents.find(s => s.id === r.studentId);
      const searchStr = `${r.chineseName} ${r.englishName || ''} ${r.organizer} ${r.description} ${r.awardObtained || ''} ${student?.chineseName || ''} ${student?.className || ''}`.toLowerCase();
      return !recordSearchTerm.trim() || searchStr.includes(recordSearchTerm.toLowerCase());
    });
  }, [currentActivityRecords, currentStudents, recordSearchTerm]);

  const studentTotal = calculateTotalScore(selectedStudentRecords);
  const studentAgg = aggregateAwards(selectedStudentRecords);

  const groupedStudentRecords = useMemo(() => {
    return selectedStudentRecords.reduce((acc, record) => {
      const year = record.academicYear;
      if (!acc[year]) acc[year] = [];
      acc[year].push(record);
      return acc;
    }, {} as Record<string, typeof selectedStudentRecords>);
  }, [selectedStudentRecords]);

  const groupedStudentActivityRecords = useMemo(() => {
    return selectedStudentActivityRecords.reduce((acc, record) => {
      const year = record.academicYear;
      if (!acc[year]) acc[year] = [];
      acc[year].push(record);
      return acc;
    }, {} as Record<string, typeof selectedStudentActivityRecords>);
  }, [selectedStudentActivityRecords]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">表現分析報告</h2>
          <p className="text-slate-500 mt-1">分析 {currentAcademicYear} 學年的獎勵數據</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {userRole === 'admin' && (
            <button
              onClick={() => setExportModalOpen(true)}
              className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              匯出本學年紀錄 (Excel)
            </button>
          )}
          <div className="flex bg-slate-200 p-1 rounded-lg">
            {!isStudentUser && (
              <button 
                onClick={() => setReportType('overview')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${reportType === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                全校總覽
              </button>
            )}
            <button 
              onClick={() => setReportType('student')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${reportType === 'student' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {isStudentUser ? '個人表現報告' : '個人報告'}
            </button>
          </div>
        </div>
      </header>

      {reportType === 'overview' ? (
        <div className="space-y-6">
          {/* 新增: 該學年所有老師輸入的學生獎勵紀錄 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800">全校獎勵紀錄清單 (全學年)</h3>
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
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="border-b border-slate-200 text-sm">
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">學生 (班別)</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">日期 / 學期</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">活動詳情</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">獎勵</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">獲獎理由</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">負責老師</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">狀態 / 操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSchoolRecords.length > 0 ? (
                    displayedSchoolRecords
                      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
                      .map(record => {
                        const student = currentStudents.find(s => s.id === record.studentId);
                        let recordedByUser = appUsers?.find(u => u.email === record.recordedBy || u.displayName === record.recordedBy);
                        let displayTeacher = recordedByUser?.teacherAbbreviation || record.recordedBy;
                        
                        if (displayTeacher === '登入老師') {
                          const adminUser = appUsers?.find(u => u.role === 'admin' || u.id === user?.uid);
                          displayTeacher = adminUser?.teacherAbbreviation || '管理者';
                        }
                        
                        return (
                          <tr key={record.id} className={`${duplicateRecordIds.has(record.id) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'} transition-colors text-sm`}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-900">{student?.chineseName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{student?.className} ({student?.classNumber})</div>
                            </td>
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
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {AwardTypeLabels[record.awardType]} x{record.count}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={record.description}>
                              {record.description}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-[10px]">
                                  {displayTeacher?.[0]?.toUpperCase() || '?'}
                                </div>
                                <span className="truncate max-w-[120px]" title={record.recordedBy}>{displayTeacher}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {record.status === 'pending' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    待確認
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    已確認
                                  </span>
                                )}
                                {record.status === 'pending' && userRole === 'admin' && (
                                  <button
                                    onClick={() => approveRecords([record.id])}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors ml-1"
                                    title="確認"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                        本學年尚無任何獎勵紀錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
              <h3 className="text-lg font-bold text-slate-800">全校課外活動／比賽紀錄清單 (全學年)</h3>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="border-b border-slate-200 text-sm">
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">學生 (班別)</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">日期</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">活動名稱</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">主辦機構</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">獎項</th>
                    <th className="px-4 py-3 font-medium text-slate-600 bg-slate-50 whitespace-nowrap">負責老師</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSchoolActivityRecords.length > 0 ? (
                    displayedSchoolActivityRecords
                      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
                      .map(record => {
                        const student = currentStudents.find(s => s.id === record.studentId);
                        let recordedByUser = appUsers?.find(u => u.email === record.recordedBy || u.displayName === record.recordedBy);
                        let displayTeacher = recordedByUser?.teacherAbbreviation || record.recordedBy;
                        
                        if (displayTeacher === '登入老師') {
                          const adminUser = appUsers?.find(u => u.role === 'admin' || u.id === user?.uid);
                          displayTeacher = adminUser?.teacherAbbreviation || '管理者';
                        }
                        
                        return (
                          <tr key={record.id} className="hover:bg-slate-50 transition-colors text-sm">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-slate-900">{student?.chineseName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{student?.className} ({student?.classNumber})</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">{record.date}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{record.chineseName}</div>
                              {record.englishName && <div className="text-xs text-slate-500">{record.englishName}</div>}
                              <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={record.description}>{record.description}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={record.organizer}>{record.organizer}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {record.awardObtained ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  {record.awardObtained}
                                </span>
                              ) : <span className="text-slate-400 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-[10px]">
                                  {displayTeacher?.[0]?.toUpperCase() || '?'}
                                </div>
                                <span className="truncate max-w-[120px]" title={record.recordedBy}>{displayTeacher}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                        本學年尚無任何課外活動紀錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6">各分類積分分佈 (全校)</h3>
              <div className="h-80">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} 積分`, '總計']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">尚無數據</div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6">各班級總積分排行</h3>
              <div className="h-80">
                {classData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classData} layout="vertical" margin={{ top: 5, right: 50, left: 20, bottom: 5 }}>
                      
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#64748b' }} />
                      <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value: number) => [`${value} 積分`, '總計']} />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={28}>
                        {classData.map((entry, index) => {
                          const n = classData.length;
                          const isTop1 = index === n - 1 && entry.score > 0;
                          const isTop2 = index === n - 2 && entry.score > 0;
                          const isTop3 = index === n - 3 && entry.score > 0;
                          const fillColor = isTop1 ? '#f59e0b' : isTop2 ? '#94a3b8' : isTop3 ? '#b45309' : '#818cf8';
                          return <Cell key={`cell-${index}`} fill={fillColor} />;
                        })}
                        <LabelList dataKey="score" position="right" fill="#64748b" fontSize={13} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">尚無數據</div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {!isStudentUser && (
                <>
                  <label className="font-medium text-slate-700">搜尋學生：</label>
                  <input 
                    type="text" 
                    placeholder="輸入姓名、班別或編號..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none w-48"
                  />
                  <select 
                    value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.chineseName} ({s.schoolId})</option>
                      ))
                    ) : (
                      <option value="" disabled>無符合條件的學生</option>
                    )}
                  </select>
                </>
              )}
              <label className={`font-medium text-slate-700 ${!isStudentUser ? 'ml-4' : ''}`}>檢視學年：</label>
              <select
                value={studentReportYear}
                onChange={e => setStudentReportYear(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">所有年度</option>
                {academicYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {selectedStudent && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  <div className="col-span-2 md:col-span-1 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <p className="text-xs text-indigo-600 font-bold uppercase mb-1">總積分</p>
                    <p className="text-3xl font-black text-indigo-700">{studentTotal}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold mb-1">{AwardTypeLabels.major_merit}</p>
                    <p className="text-xl font-bold text-slate-800">{studentAgg.major_merit}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold mb-1">{AwardTypeLabels.minor_merit}</p>
                    <p className="text-xl font-bold text-slate-800">{studentAgg.minor_merit}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold mb-1">{AwardTypeLabels.advantage}</p>
                    <p className="text-xl font-bold text-slate-800">{studentAgg.advantage}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold mb-1">{AwardTypeLabels.point}</p>
                    <p className="text-xl font-bold text-slate-800">{studentAgg.point}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64">
                    <h4 className="text-sm font-bold text-slate-700 mb-4">各分類積分貢獻</h4>
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value} 積分`, '總計']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">無紀錄</div>
                    )}
                  </div>
                  
                  <div>
                     <h4 className="text-sm font-bold text-slate-700 mb-4">詳細紀錄清單</h4>
                     <div className="max-h-64 overflow-y-auto pr-2">
                        <div className="space-y-3">
                          {Object.keys(groupedStudentRecords).length > 0 ? (
                            Object.entries(groupedStudentRecords).sort((a, b) => b[0].localeCompare(a[0])).map(([year, records]) => (
                              <div key={year} className="mb-4">
                                <h5 className="text-xs font-bold text-slate-500 mb-2 border-b border-slate-100 pb-1">{year} 學年</h5>
                                <div className="space-y-2">
                                  {(records as any[]).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).map((record: any) => {
                                    let recordedByUser = appUsers?.find(u => u.email === record.recordedBy || u.displayName === record.recordedBy);
                                    let displayTeacher = recordedByUser?.teacherAbbreviation || record.recordedBy;
                                    if (displayTeacher === '登入老師') {
                                      const adminUser = appUsers?.find(u => u.role === 'admin' || u.id === user?.uid);
                                      displayTeacher = adminUser?.teacherAbbreviation || '管理者';
                                    }
                                    return (
                                      <div key={record.id} className="bg-white p-3 rounded border border-slate-200 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium text-slate-800">{record.description}</span>
                                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                            {AwardTypeLabels[record.awardType as keyof typeof AwardTypeLabels] || record.awardType} x{record.count}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500">
                                          <span>{record.term || '全年'} • {CategoryLabels[record.category as keyof typeof CategoryLabels] || record.category}{record.subCategory ? ` (${record.subCategory})` : ''}{record.position ? ` [${record.position}]` : ''}</span>
                                          <span>負責老師: {displayTeacher}</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 text-sm text-center py-4">無詳細紀錄</p>
                          )}
                        </div>
                     </div>
                     
                     <div className="mt-8">
                       <h4 className="text-sm font-bold text-slate-700 mb-4">課外活動／比賽詳細紀錄</h4>
                       <div className="max-h-64 overflow-y-auto pr-2">
                          <div className="space-y-3">
                            {Object.keys(groupedStudentActivityRecords).length > 0 ? (
                              Object.entries(groupedStudentActivityRecords).sort((a, b) => b[0].localeCompare(a[0])).map(([year, records]) => (
                                <div key={year} className="mb-4">
                                  <h5 className="text-xs font-bold text-slate-500 mb-2 border-b border-slate-100 pb-1">{year} 學年</h5>
                                  <div className="space-y-2">
                                    {(records as any[]).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).map((record: any) => (
                                      <div key={record.id} className="bg-white p-3 rounded border border-slate-200 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium text-slate-800">{record.chineseName} {record.englishName ? `(${record.englishName})` : ''}</span>
                                          {record.awardObtained && (
                                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                                              {record.awardObtained}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                                          <span>主辦/合辦: {record.organizer}</span>
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">
                                          {record.description}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 text-sm text-center py-4">無課外活動／比賽紀錄</p>
                            )}
                          </div>
                       </div>
                     </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ExportModal 
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExportExcel}
        students={currentStudents}
      />
    </div>
  );
};
