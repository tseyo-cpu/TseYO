import React from 'react';
import { useAppContext } from '../context';
import { AwardTypeLabels, CategoryLabels } from '../types';
import { calculateTotalScore, aggregateAwards } from '../utils';
import { Trophy, Award, TrendingUp, Users } from 'lucide-react';

export const Dashboard = () => {
  const { students, records, activityRecords, currentAcademicYear, setCurrentAcademicYear } = useAppContext();

  const currentRecords = records.filter(r => r.academicYear === currentAcademicYear);
  const currentStudents = React.useMemo(() => {
    return students
      .filter(s => s.academicYear === currentAcademicYear)
      .sort((a, b) => {
        if (a.className !== b.className) {
          return a.className.localeCompare(b.className);
        }
        return (a.classNumber || 0) - (b.classNumber || 0);
      });
  }, [students, currentAcademicYear]);
  const currentActivityRecords = activityRecords?.filter(r => r.academicYear === currentAcademicYear) || [];

  const totalAwardsGiven = currentRecords.length;
  const aggregated = aggregateAwards(currentRecords);

  const honorRollByGrade = React.useMemo(() => {
    const withScores = currentStudents.map(student => {
      const studentRecords = currentRecords.filter(r => r.studentId === student.id);
      const breakdown = studentRecords.reduce((acc, r) => {
        acc[r.awardType] = (acc[r.awardType] || 0) + r.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        ...student,
        score: calculateTotalScore(studentRecords),
        awardBreakdown: breakdown,
        totalAwards: studentRecords.reduce((acc, r) => acc + r.count, 0)
      };
    }).filter(s => s.score > 0);

    const grouped: Record<string, typeof withScores> = {};
    withScores.forEach(student => {
      const match = student.className.match(/\d+/);
      let grade = '其他';
      if (match) {
        const num = parseInt(match[0], 10);
        const map: Record<number, string> = { 1: '中一', 2: '中二', 3: '中三', 4: '中四', 5: '中五', 6: '中六' };
        grade = map[num] || `中${num}`;
      } else {
        grade = student.className.charAt(0) || '其他';
      }
      if (!grouped[grade]) grouped[grade] = [];
      grouped[grade].push(student);
    });

    const result: { grade: string, students: (typeof withScores[0] & { displayRank: number })[] }[] = [];

    const sortedGrades = Object.keys(grouped).sort((a, b) => {
      const gradeOrder = ['中一', '中二', '中三', '中四', '中五', '中六'];
      const indexA = gradeOrder.indexOf(a);
      const indexB = gradeOrder.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    sortedGrades.forEach(grade => {
      const studentsInGrade = grouped[grade].sort((a, b) => b.score - a.score);
      
      const scoreGroups: { score: number, students: typeof studentsInGrade }[] = [];
      studentsInGrade.forEach(s => {
        if (scoreGroups.length === 0 || scoreGroups[scoreGroups.length - 1].score !== s.score) {
          scoreGroups.push({ score: s.score, students: [s] });
        } else {
          scoreGroups[scoreGroups.length - 1].students.push(s);
        }
      });

      const topStudents: (typeof withScores[0] & { displayRank: number })[] = [];
      let currentCount = 0;
      let currentRank = 1;

      for (let i = 0; i < scoreGroups.length; i++) {
        const group = scoreGroups[i];
        const nextCount = currentCount + group.students.length;
        
        if (currentCount > 0) {
          const currentDistance = Math.abs(currentCount - 3);
          const nextDistance = Math.abs(nextCount - 3);
          if (nextDistance > currentDistance) {
            break;
          }
        }
        
        group.students.forEach(s => {
          topStudents.push({ ...s, displayRank: currentRank });
        });
        
        currentCount = nextCount;
        currentRank++; 
      }
      
      if (topStudents.length > 0) {
        result.push({ grade, students: topStudents });
      }
    });

    return result;
  }, [currentStudents, currentRecords]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">系統儀表板</h2>
          <p className="text-slate-500 mt-1">總覽本學年的學生獎勵狀況</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Users className="text-blue-600" />} title="學生總數" value={currentStudents.length} bgColor="bg-blue-100" />
        <StatCard icon={<Award className="text-emerald-600" />} title="已頒發獎勵總數" value={totalAwardsGiven} bgColor="bg-emerald-100" />
        <StatCard icon={<Trophy className="text-amber-600" />} title="已輸入課外活動／比賽總數" value={currentActivityRecords.length} bgColor="bg-amber-100" />
        <StatCard icon={<TrendingUp className="text-purple-600" />} title="總積分產出" value={calculateTotalScore(currentRecords)} bgColor="bg-purple-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6">各級榮譽榜 (最高分首三名)</h3>
            {honorRollByGrade.length > 0 ? (
              <div className="space-y-8">
                {honorRollByGrade.map(({ grade, students }) => (
                  <div key={grade}>
                    <h4 className="text-md font-semibold text-slate-700 mb-3 border-l-4 border-indigo-500 pl-3">{grade}級</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                          <tr>
                            <th className="px-4 py-2 w-16">排名</th>
                            <th className="px-4 py-2 w-24">班別</th>
                            <th className="px-4 py-2">姓名</th>
                            <th className="px-4 py-2">獎勵明細</th>
                            <th className="px-4 py-2 w-24">總積分</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((student) => (
                            <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 font-medium text-slate-900">
                                {student.displayRank}
                              </td>
                              <td className="px-4 py-2">{student.className} ({student.classNumber})</td>
                              <td className="px-4 py-2">{student.chineseName} {student.englishName}</td>
                              <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {(Object.keys(AwardTypeLabels) as (keyof typeof AwardTypeLabels)[]).map(type => {
                                    const count = student.awardBreakdown[type];
                                    if (!count) return null;
                                    return (
                                      <span key={type} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                        {AwardTypeLabels[type]} x{count}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-2 font-bold text-indigo-600">{student.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">此學年尚無數據</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">最新紀錄</h3>
          <div className="space-y-4">
            {currentRecords.slice().reverse().slice(0, 5).map(record => {
              const student = students.find(s => s.id === record.studentId);
              return (
                <div key={record.id} className="flex gap-3 items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500 mt-1">
                    <Award size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {student?.chineseName} 獲得 {record.count} 個 {AwardTypeLabels[record.awardType]}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{record.description}</p>
                    <p className="text-xs text-slate-400 mt-1">{record.date} • {record.term || '全年'} • {CategoryLabels[record.category]}{record.subCategory ? ` (${record.subCategory})` : ''}{record.position ? ` [${record.position}]` : ''}</p>
                  </div>
                </div>
              );
            })}
            {currentRecords.length === 0 && (
              <div className="text-center py-4 text-slate-500">尚無紀錄</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, bgColor }: { icon: React.ReactNode, title: string, value: number | string, bgColor: string }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center gap-4">
    <div className={`p-4 rounded-xl ${bgColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);
