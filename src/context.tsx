import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Student, AwardRecord, ActivityRecord, AcademicYear, AppUser, PendingUser, DefaultCategorySubcategories, Category } from './types';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';

interface AppState {
  students: Student[];
  records: AwardRecord[];
  activityRecords: ActivityRecord[];
  currentAcademicYear: AcademicYear;
  academicYears: AcademicYear[];
  subCategories: Record<Category, string[]>;
  user: User | null;
  userRole: 'admin' | 'editor' | 'viewer' | 'student' | null;
  appUsers: AppUser[];
  pendingUsers: PendingUser[];
  loading: boolean;
}

interface AppContextType extends AppState {
  addStudent: (student: Omit<Student, 'id'>) => void;
  bulkUpsertStudents: (students: Omit<Student, 'id'>[]) => void;
  updateStudent: (student: Student) => void;
  deleteStudent: (id: string) => void;
  bulkDeleteStudents: (ids: string[]) => void;
  addRecord: (record: Omit<AwardRecord, 'id'>) => void;
  updateRecord: (record: AwardRecord) => void;
  bulkAddRecords: (records: Omit<AwardRecord, 'id'>[]) => void;
  deleteRecord: (id: string) => void;
  bulkDeleteRecords: (ids: string[]) => void;
  approveRecords: (ids: string[]) => void;
  
  addActivityRecord: (record: Omit<ActivityRecord, 'id'>) => Promise<void>;
  updateActivityRecord: (record: ActivityRecord) => Promise<void>;
  deleteActivityRecord: (id: string) => Promise<void>;
  bulkAddActivityRecords: (records: Omit<ActivityRecord, 'id'>[]) => Promise<void>;
  bulkDeleteActivityRecords: (ids: string[]) => Promise<void>;

  setCurrentAcademicYear: (year: AcademicYear) => void;
  addAcademicYear: (year: AcademicYear) => void;
  deleteAcademicYear: (year: AcademicYear) => void;
  updateSubCategories: (subCategories: Record<Category, string[]>) => Promise<void>;
  updateUserRole: (id: string, role: 'admin' | 'editor' | 'viewer' | 'student') => Promise<void>;
  updateUserAbbreviation: (id: string, abbreviation: string) => Promise<void>;
  deleteAppUser: (id: string) => Promise<void>;
  addPendingUser: (email: string, role: 'admin' | 'editor' | 'viewer' | 'student', abbreviation?: string) => Promise<void>;
  deletePendingUser: (email: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    students: [],
    records: [],
    activityRecords: [],
    currentAcademicYear: '2025-2026',
    academicYears: ['2024-2025', '2025-2026', '2026-2027'],
    subCategories: {} as Record<Category, string[]>,
    user: null,
    userRole: null,
    appUsers: [],
    pendingUsers: [],
    loading: true
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user role
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        let role: 'admin' | 'editor' | 'viewer' | 'student' = 'viewer';
        let needToUpdateDb = false;
        
        if (userSnap.exists()) {
          role = userSnap.data().role;
        } else {
          // Check pending_users
          const pendingRef = doc(db, 'pending_users', user.email?.toLowerCase().trim() || '');
          const pendingSnap = await getDoc(pendingRef);
          if (pendingSnap.exists()) {
            role = pendingSnap.data().role;
            needToUpdateDb = true;
            deleteDoc(pendingRef).catch(console.error);
          } else {
            // Check students
            const studentsQuery = query(collection(db, 'students'), where('email', '==', user.email));
            const studentsSnap = await getDocs(studentsQuery);
            if (!studentsSnap.empty) {
              role = 'student';
            }
            needToUpdateDb = true;
          }
        }
        
        // Auto-upgrade root admin
        if (user.email === 'tseyo@pochiu.edu.hk') {
          if (role !== 'admin') {
            role = 'admin';
            needToUpdateDb = true;
          }
        }
        
        if (needToUpdateDb) {
          // We can silently update the DB so the UI matches for others as well.
          // Fire and forget since we are guaranteed permission by the updated firestore rules.
          setDoc(userRef, { role, email: user.email, displayName: user.displayName }, { merge: true }).catch(console.error);
        }
        
        setState(prev => ({ ...prev, user, userRole: role, loading: false }));
      } else {
        setState(prev => ({ ...prev, user: null, userRole: null, loading: false }));
      }
    });
    return unsubscribe;
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!state.user) return;
    
    // Listen to config
    const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.academicYears) {
          setState(prev => ({ ...prev, academicYears: data.academicYears }));
        }
      }
    });

    const unsubSubCategories = onSnapshot(doc(db, 'config', 'subcategories'), (docSnap) => {
      if (docSnap.exists()) {
        setState(prev => ({ ...prev, subCategories: docSnap.data().data as Record<Category, string[]> }));
      } else {
        setDoc(doc(db, 'config', 'subcategories'), { data: DefaultCategorySubcategories }).catch(console.error);
        setState(prev => ({ ...prev, subCategories: DefaultCategorySubcategories }));
      }
    });

    // Listen to students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setState(prev => ({ ...prev, students: studentsData }));
    });

    // Listen to records
    const unsubRecords = onSnapshot(collection(db, 'records'), (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AwardRecord));
      setState(prev => ({ ...prev, records: recordsData }));
    });

    // Listen to activity records
    const unsubActivityRecords = onSnapshot(collection(db, 'activity_records'), (snapshot) => {
      const activityRecordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityRecord));
      setState(prev => ({ ...prev, activityRecords: activityRecordsData }));
    });

    let unsubUsers = () => {};
    let unsubPendingUsers = () => {};
    if (state.userRole) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setState(prev => ({ ...prev, appUsers: usersData }));
      });
    }

    if (state.userRole === 'admin') {
      unsubPendingUsers = onSnapshot(collection(db, 'pending_users'), (snapshot) => {
        const pendingData = snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() } as PendingUser));
        setState(prev => ({ ...prev, pendingUsers: pendingData }));
      });
    }

    return () => {
      unsubConfig();
      unsubSubCategories();
      unsubStudents();
      unsubRecords();
      unsubActivityRecords();
      unsubUsers();
      unsubPendingUsers();
    };
  }, [state.user, state.userRole]);

  const updateSubCategories = async (newSubCategories: Record<Category, string[]>) => {
    if (state.userRole !== 'admin') return;
    await setDoc(doc(db, 'config', 'subcategories'), { data: newSubCategories });
  };

  const updateUserRole = async (id: string, role: 'admin' | 'editor' | 'viewer' | 'student') => {
    if (state.userRole !== 'admin') return;
    await setDoc(doc(db, 'users', id), { role }, { merge: true });
  };

  const updateUserAbbreviation = async (id: string, abbreviation: string) => {
    if (state.userRole !== 'admin') return;
    await setDoc(doc(db, 'users', id), { teacherAbbreviation: abbreviation }, { merge: true });
  };

  const deleteAppUser = async (id: string) => {
    if (state.userRole !== 'admin') return;
    await deleteDoc(doc(db, 'users', id));
  };

  const addPendingUser = async (email: string, role: 'admin' | 'editor' | 'viewer' | 'student', abbreviation?: string) => {
    if (state.userRole !== 'admin') return;
    const payload: any = { email: email.toLowerCase().trim(), role };
    if (abbreviation) {
      payload.teacherAbbreviation = abbreviation;
    }
    await setDoc(doc(db, 'pending_users', email.toLowerCase().trim()), payload);
  };

  const deletePendingUser = async (email: string) => {
    if (state.userRole !== 'admin') return;
    await deleteDoc(doc(db, 'pending_users', email));
  };

  const addStudent = async (studentData: Omit<Student, 'id'>) => {
    if (state.userRole !== 'admin') return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'students', id), { ...studentData, id });
  };

  const bulkUpsertStudents = async (studentsData: Omit<Student, 'id'>[]) => {
    if (state.userRole !== 'admin') return;
    for (let i = 0; i < studentsData.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = studentsData.slice(i, i + 500);
      chunk.forEach(incomingStudent => {
        const existing = state.students.find(s => s.schoolId === incomingStudent.schoolId && s.academicYear === incomingStudent.academicYear);
        if (existing) {
          batch.set(doc(db, 'students', existing.id), { ...existing, ...incomingStudent });
        } else {
          const id = crypto.randomUUID();
          batch.set(doc(db, 'students', id), { ...incomingStudent, id });
        }
      });
      await batch.commit();
    }
  };

  const updateStudent = async (updatedStudent: Student) => {
    if (state.userRole !== 'admin') return;
    await setDoc(doc(db, 'students', updatedStudent.id), updatedStudent);
  };

  const deleteStudent = async (id: string) => {
    if (state.userRole !== 'admin') return;
    await deleteDoc(doc(db, 'students', id));
    // Cascade delete records
    const recordsToDelete = state.records.filter(r => r.studentId === id);
    if (recordsToDelete.length > 0) {
      const batch = writeBatch(db);
      recordsToDelete.forEach(r => batch.delete(doc(db, 'records', r.id)));
      await batch.commit();
    }
  };

  const bulkDeleteStudents = async (ids: string[]) => {
    if (state.userRole !== 'admin') return;
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, 'students', id));
    });
    
    const recordsToDelete = state.records.filter(r => ids.includes(r.studentId));
    recordsToDelete.forEach(r => batch.delete(doc(db, 'records', r.id)));
    
    await batch.commit();
  };

  const addRecord = async (recordData: Omit<AwardRecord, 'id'>) => {
    const id = crypto.randomUUID();
    const status = state.userRole === 'admin' ? 'approved' : 'pending';
    await setDoc(doc(db, 'records', id), { ...recordData, id, status, createdAt: Date.now() });
  };

  const updateRecord = async (record: AwardRecord) => {
    await setDoc(doc(db, 'records', record.id), { ...record, updatedAt: Date.now() }, { merge: true });
  };

  const bulkAddRecords = async (recordsData: Omit<AwardRecord, 'id'>[]) => {
    const status = state.userRole === 'admin' ? 'approved' : 'pending';
    for (let i = 0; i < recordsData.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = recordsData.slice(i, i + 500);
      chunk.forEach(r => {
        const id = crypto.randomUUID();
        batch.set(doc(db, 'records', id), { ...r, id, status, createdAt: Date.now() });
      });
      await batch.commit();
    }
  };

  const deleteRecord = async (id: string) => {
    await deleteDoc(doc(db, 'records', id));
  };

  const bulkDeleteRecords = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + 500);
      chunk.forEach(id => batch.delete(doc(db, 'records', id)));
      await batch.commit();
    }
  };

  const approveRecords = async (ids: string[]) => {
    if (state.userRole !== 'admin') return;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + 500);
      chunk.forEach(id => batch.set(doc(db, 'records', id), { status: 'approved' }, { merge: true }));
      await batch.commit();
    }
  };

  const addActivityRecord = async (recordData: Omit<ActivityRecord, 'id'>) => {
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'activity_records', id), { ...recordData, id, createdAt: Date.now() });
  };

  const updateActivityRecord = async (record: ActivityRecord) => {
    await setDoc(doc(db, 'activity_records', record.id), { ...record, updatedAt: Date.now() }, { merge: true });
  };

  const deleteActivityRecord = async (id: string) => {
    await deleteDoc(doc(db, 'activity_records', id));
  };

  const bulkAddActivityRecords = async (recordsData: Omit<ActivityRecord, 'id'>[]) => {
    for (let i = 0; i < recordsData.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = recordsData.slice(i, i + 500);
      chunk.forEach(record => {
        const id = crypto.randomUUID();
        batch.set(doc(db, 'activity_records', id), { ...record, id, createdAt: Date.now() });
      });
      await batch.commit();
    }
  };

  const bulkDeleteActivityRecords = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + 500);
      chunk.forEach(id => batch.delete(doc(db, 'activity_records', id)));
      await batch.commit();
    }
  };

  const setCurrentAcademicYear = (year: AcademicYear) => {
    setState(prev => ({ ...prev, currentAcademicYear: year }));
  };

  const addAcademicYear = async (year: AcademicYear) => {
    if (state.userRole !== 'admin') return;
    if (state.academicYears.includes(year)) return;
    const newYears = [...state.academicYears, year].sort((a,b) => b.localeCompare(a));
    await setDoc(doc(db, 'config', 'general'), { academicYears: newYears }, { merge: true });
    setCurrentAcademicYear(year);
  };

  const deleteAcademicYear = async (year: AcademicYear) => {
    if (state.userRole !== 'admin') return;
    const newYears = state.academicYears.filter(y => y !== year);
    await setDoc(doc(db, 'config', 'general'), { academicYears: newYears }, { merge: true });
    
    const batch = writeBatch(db);
    state.students.filter(s => s.academicYear === year).forEach(s => batch.delete(doc(db, 'students', s.id)));
    state.records.filter(r => r.academicYear === year).forEach(r => batch.delete(doc(db, 'records', r.id)));
    await batch.commit();
    
    if (state.currentAcademicYear === year) {
      setCurrentAcademicYear(newYears[0] || '');
    }
  };

  return (
    <AppContext.Provider value={{
      ...state,
      addStudent,
      bulkUpsertStudents,
      updateStudent,
      deleteStudent,
      bulkDeleteStudents,
      addRecord,
      updateRecord,
      bulkAddRecords,
      deleteRecord,
      bulkDeleteRecords,
      approveRecords,
      addActivityRecord,
      updateActivityRecord,
      deleteActivityRecord,
      bulkAddActivityRecords,
      bulkDeleteActivityRecords,
      setCurrentAcademicYear,
      addAcademicYear,
      deleteAcademicYear,
      updateSubCategories,
      updateUserRole,
      updateUserAbbreviation,
      deleteAppUser,
      addPendingUser,
      deletePendingUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
