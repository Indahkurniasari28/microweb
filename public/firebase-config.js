const firebaseConfig = {
  apiKey: "AIzaSyBhSWditPBxTSBnX5UMeg91ipBbk2vGe1o",
  authDomain: "pomclear-ec893.firebaseapp.com",
  databaseURL: "https://pomclear-ec893-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pomclear-ec893",
  storageBucket: "pomclear-ec893.firebasestorage.app",
  messagingSenderId: "653956233480",
  appId: "1:653956233480:web:a79de9e542ed77969994bd",
  measurementId: "G-PSWZX25Q6F"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();