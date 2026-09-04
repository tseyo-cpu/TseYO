export type AcademicYear = string; // e.g., '2025-2026'

export interface Student {
  id: string;
  schoolId: string; // 校內編號
  chineseName: string; // 中文姓名
  englishName: string; // 英文姓名
  className: string; // 班別
  classNumber: number; // 學號
  email?: string; // 學生電郵
  academicYear: AcademicYear;
}

export type AwardType = 'major_merit' | 'minor_merit' | 'advantage' | 'point';

export const AwardTypeLabels: Record<AwardType, string> = {
  major_merit: '大功',
  minor_merit: '小功',
  advantage: '優點',
  point: '積點',
};

// Points equivalence (assuming standard: 1大功 = 3小功 = 9優點 = 9積點 - wait, usually 1優點 = x積點 depending on school, let's assume 1優點=10積點 or we just calculate them independently as requested, and a weighted total).
// Let's use a simple weight: 1 大功 = 9, 1 小功 = 3, 1 優點 = 1, 1 積點 = 1
export const AwardWeights: Record<AwardType, number> = {
  major_merit: 48,
  minor_merit: 12,
  advantage: 3,
  point: 1,
};

export type Category = 
  | 'subject' 
  | 'competition' 
  | 'club' 
  | 'service' 
  | 'committee' 
  | 'class_association' 
  | 'working_group' 
  | 'event' 
  | 'other';

export const CategoryLabels: Record<Category, string> = {
  subject: '科目',
  competition: '校外比賽',
  club: '學會及會社',
  service: '服務及制服隊伍',
  committee: '委員會',
  class_association: '班會',
  working_group: '工作小組',
  event: '大型活動',
  other: '其他',
};

export const DefaultCategorySubcategories: Record<Category, string[]> = {
  subject: ['中文科', '英文科', '數學科', '生活與社會科', '公民與社會發展科', '科學科', '歷史科', '電腦科', '普通話科', '體育科', '視覺藝術科', '戲劇教育', '中國歷史科', '經濟科', '生物科', '化學科', '物理科', '宗教教育科', '倫理與宗教科', '企業、會計及財務概論', '音樂科', '旅遊與款待', '地理科', '公民、經濟與社會科'],
  competition: ['戲劇比賽', '英文比賽', '視藝比賽', '足球隊', '籃球隊', '羽毛球隊', '排球隊', '乒乓球隊', '欖球隊', '田徑隊', '校際朗誦節', '舞蹈比賽', '校內設計比賽', '中文比賽', '棋藝比賽', '校際音樂節', 'STEAM比賽'],
  club: ['中文學會', '英文學會', '數學學會', '視覺藝術學會', '電腦學會', '普通話學會', '愛閱讀學會', '地理學會', '創新科技學會', '棋藝學會', '3D打印模型班', '化學學會', '電影欣賞學會', '日文學會', '劍擊學會', '劇社', '舞蹈學會', '合唱團', '流行音學合奏班', '節目製作組', '御宅藝學會', '學生會', '領袖訓練', '種籽領袖計劃', '天主教同學會'],
  service: ['女童軍', '紅十字青年團', '海事青年團', '義工隊', '長者學苑', '環保學會', '少年警訊', '賣旗(OLE)', '護老先鋒(OLE)', '圖書館風紀隊', '風紀隊', '課外活動大使', '國歌領唱員', '公民教育大使', '圖書館'],
  committee: ['教務委員會', '輔導委員會', '訓導委員會', '課外活動委員會', '學生事務委員會', '學習支援統籌委員會', '升學及擇業輔導委員會', '宗教及公民教育委員會', '資訊科技統籌委員會'],
  class_association: ['1A班', '1B班', '1C班', '1D班', '2A班', '2B班', '2C班', '2D班', '3A班', '3B班', '3C班', '3D班', '4A班', '4B班', '4C班', '4D班', '5A班', '5B班', '5C班', '5D班', '6A班', '6B班', '6C班', '6D班'],
  working_group: ['個人發展獎勵計劃', '中一新生註冊', '學校發展', '學校推廣'],
  event: ['新星歌唱比賽', '聖誕聯歡', '報春暉晚會', '觀塘巡禮表演', '家長日表演', '中華文化週', '天星海港遊義工服務', '普照年宵樂繽紛', '龍騰觀塘新春夜巿，學生才藝大匯演', '油塘中心BGCA嘉年華表演', '觀塘區賀中秋迎國慶青年文化晚會演出', '「夢想。共享」音樂會演出', '聖愛德華science fun fair', '天竺鼠車車萬向車挑戰賽', '科學日', '陸運會', '畢業禮', '趁墟做老闆'],
  other: ['勤到 / 守時', '宗教禮儀']
};

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'editor' | 'viewer' | 'student';
  teacherAbbreviation?: string;
}

export interface PendingUser {
  email: string;
  role: 'admin' | 'editor' | 'viewer' | 'student';
  teacherAbbreviation?: string;
}

export type AcademicTerm = '第一學期' | '第二學期' | '全年';

export interface AwardRecord {
  id: string;
  studentId: string;
  academicYear: AcademicYear;
  term?: AcademicTerm;
  date: string; // YYYY-MM-DD
  category: Category;
  subCategory?: string;
  awardType: AwardType;
  count: number;
  description: string;
  position?: string;
  recordedBy: string; // Teacher name
  status?: 'pending' | 'approved';
  createdAt?: number;
  updatedAt?: number;
}

export interface ActivityRecord {
  id: string;
  studentId: string;
  academicYear: AcademicYear;
  date?: string;
  chineseName: string;
  englishName?: string;
  organizer: string;
  description: string;
  awardObtained?: string;
  recordedBy: string;
  createdAt?: number;
  updatedAt?: number;
}
