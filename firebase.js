import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// AQUI MUDOU: Adicionei signInWithRedirect
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyArty3paQGfZJYFcVl_ZZXjzlL5V3S2dkg",
  authDomain: "cashflow-app-59115.firebaseapp.com",
  projectId: "cashflow-app-59115",
  storageBucket: "cashflow-app-59115.firebasestorage.app",
  messagingSenderId: "1048011104538",
  appId: "1:1048011104538:web:0318805b992fccf5398ca3",
  measurementId: "G-BFZ74HY3KW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Exportando a nova função
export { auth, db, provider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc };