import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdBC6pTftHWWGdpmqgoayGG1IuqF7CszQ",
  authDomain: "cfa-dollars.firebaseapp.com",
  projectId: "cfa-dollars",
  storageBucket: "cfa-dollars.firebasestorage.app",
  messagingSenderId: "537521664253",
  appId: "1:537521664253:web:04e138a314491ca3ca0e94",
  measurementId: "G-XV40KPG38G"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
