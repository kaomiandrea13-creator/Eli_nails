const firebaseConfig = {
  apiKey: "AIzaSyC5NracBFaVlXWPpy_i3LE6AnSiY-YHi2Y",
  authDomain: "eli-nails-68adc.firebaseapp.com",
  projectId: "eli-nails-68adc",
  storageBucket: "eli-nails-68adc.firebasestorage.app",
  messagingSenderId: "817937573002",
  appId: "1:817937573002:web:d43361a8b25b27b2897973"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

const configRef = db.collection("config").doc("sorteo");
const participantesRef = db.collection("participantes");

const ADMIN_EMAIL = "admin@elinails.com";
