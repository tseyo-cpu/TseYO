import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // After sign-in, check if user document exists, if not create it
    const userRef = doc(db, 'users', result.user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      let role = 'editor';
      let teacherAbbreviation = '';
      
      if (result.user.email === 'tseyo@pochiu.edu.hk') {
        role = 'admin';
      }
      
      // Check if user is pre-approved in pending_users collection
      if (result.user.email) {
        const pendingRef = doc(db, 'pending_users', result.user.email.toLowerCase().trim());
        const pendingSnap = await getDoc(pendingRef);
        if (pendingSnap.exists()) {
          role = pendingSnap.data().role;
          teacherAbbreviation = pendingSnap.data().teacherAbbreviation || '';
        }
      }

      const userData: any = {
        email: result.user.email,
        displayName: result.user.displayName,
        role: role
      };
      if (teacherAbbreviation) {
        userData.teacherAbbreviation = teacherAbbreviation;
      }

      await setDoc(userRef, userData);
    }
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the login popup.');
      return;
    }
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);
