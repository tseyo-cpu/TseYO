import { AwardType, AwardWeights, AwardRecord } from './types';

// Helper to calculate total score for a list of records
export const calculateTotalScore = (records: AwardRecord[]): number => {
  return records.reduce((total, record) => {
    return total + (AwardWeights[record.awardType] * record.count);
  }, 0);
};

export const aggregateAwards = (records: AwardRecord[]): Record<AwardType, number> => {
  const result: Record<AwardType, number> = {
    major_merit: 0,
    minor_merit: 0,
    advantage: 0,
    point: 0,
  };
  records.forEach(r => {
    result[r.awardType] += r.count;
  });
  return result;
};

export const getAvailableAcademicYears = (records: AwardRecord[], students: {academicYear: string}[]): string[] => {
  const years = new Set<string>();
  records.forEach(r => years.add(r.academicYear));
  students.forEach(s => years.add(s.academicYear));
  years.add('2025-2026'); // Ensure default is there
  return Array.from(years).sort((a, b) => b.localeCompare(a));
};
