import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDVBEy1KMkhTR-Oa_7Ot3e-pWfCOt0Pfe8",
  authDomain: "audioanalysisdb.firebaseapp.com",
  projectId: "audioanalysisdb",
  storageBucket: "audioanalysisdb.firebasestorage.app",
  messagingSenderId: "911226358765",
  appId: "1:911226358765:web:2b942203d54a4e089275e4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
