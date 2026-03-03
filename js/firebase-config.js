// js/firebase-config.js

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAO5xb4Xtu9JN0_mlGeOK5VzNMubpNS6VM",
  authDomain: "smart-attendance-system-02.firebaseapp.com",
  projectId: "smart-attendance-system-02",
  storageBucket: "smart-attendance-system-02.firebasestorage.app",
  messagingSenderId: "1004162494049",
  appId: "1:1004162494049:web:bd1a9ddc9b418ce0f80420",
  measurementId: "G-GZXE77CMS3"
};

// Initialize Firebase (using compat version for easier syntax)
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('The current browser doesn\'t support persistence.');
        }
    });

// Teacher verification code (change this to your secret code)
const TEACHER_VERIFICATION_CODE = "TEACH2024SECURE";