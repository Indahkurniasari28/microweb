// experiments-dashboard.js
// Modern Firebase modular SDK via CDN (version matches package.json dependency)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Use the firebaseConfig you provided for microwat-iot
const firebaseConfig = {
  apiKey: "AIzaSyD93tcxcKWxhNoq5sL7S-fiaA9rsA9Tox0",
  authDomain: "microwat-iot.firebaseapp.com",
  projectId: "microwat-iot",
  storageBucket: "microwat-iot.firebasestorage.app",
  messagingSenderId: "565711056431",
  appId: "1:565711056431:web:c7ce39356f2d93675560da"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let unsubscribeFn = null;

function $(id) { return document.getElementById(id); }

async function loadCycles(experimentId) {
  if (!experimentId) throw new Error('experimentId required');

  const q = query(
    collection(db, 'experiments', experimentId, 'cycles'),
    orderBy('cycle')
  );

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTable(data);
  return data;
}

function subscribeCycles(experimentId, onUpdate) {
  if (!experimentId) throw new Error('experimentId required');

  const q = query(
    collection(db, 'experiments', experimentId, 'cycles'),
    orderBy('cycle')
  );

  const unsub = onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(rows);
  }, (err) => {
    console.error('Realtime listener error', err);
  });

  return unsub;
}

async function getFileUrls(cycle) {
  if (!cycle) return {};
  const urls = {};
  try {
    if (cycle.csvPath) {
      const csvRef = ref(storage, cycle.csvPath);
      urls.csvUrl = await getDownloadURL(csvRef);
    }
    if (cycle.plotPath) {
      const plotRef = ref(storage, cycle.plotPath);
      urls.plotUrl = await getDownloadURL(plotRef);
    }
  } catch (err) {
    console.warn('Error getting file URLs', err);
  }
  return urls;
}

function renderTable(rows) {
  const tbody = $('cycleTableBody');
  tbody.innerHTML = '';

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.cycle ?? ''}</td>
      <td>${row.elapsedMinutes ?? ''}</td>
      <td>${row.lambdaMax ?? ''}</td>
      <td>${row.absorbanceMax ?? ''}</td>
      <td>${row.timestamp ?? ''}</td>
      <td><button data-cycle-id="${row.id}">View details</button></td>
    `;
    // attach the data for later retrieval
    tr.querySelector('button').dataset.row = JSON.stringify(row);
    tbody.appendChild(tr);
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-cycle-id]');
  if (!button) return;

  const cycleId = button.dataset.cycleId;
  const experimentId = $('experimentId').value.trim();
  if (!experimentId) return alert('Enter the Experiment ID first.');

  const cycleDocRef = doc(db, 'experiments', experimentId, 'cycles', cycleId);
  const cycleSnap = await getDoc(cycleDocRef);
  if (!cycleSnap.exists()) return alert('Cycle document not found');

  const cycle = cycleSnap.data();
  const files = await getFileUrls(cycle);

  $('detail').innerHTML = `
    <h3>Siklus ${cycle.cycle}</h3>
    <p><strong>Waktu:</strong> ${cycle.timestamp ?? ''}</p>
    <p><strong>elapsedMinutes:</strong> ${cycle.elapsedMinutes ?? ''}</p>
    <p><strong>lambdaMax:</strong> ${cycle.lambdaMax ?? ''} nm</p>
    <p><strong>absorbanceMax:</strong> ${cycle.absorbanceMax ?? ''}</p>
    <p>
      ${files.csvUrl ? `<a href="${files.csvUrl}" target="_blank" download>Download CSV</a>` : 'CSV tidak tersedia'}
    </p>
    <div>
      ${files.plotUrl ? `<img src="${files.plotUrl}" alt="Plot Siklus ${cycle.cycle}" style="max-width:600px" />` : 'Plot tidak tersedia'}
    </div>
  `;
});

// Controls
$('btnLoad').addEventListener('click', async () => {
  const experimentId = $('experimentId').value.trim();
  if (!experimentId) return alert('Please enter Experiment ID');
  await loadCycles(experimentId);
});

$('btnSubscribe').addEventListener('click', () => {
  const experimentId = $('experimentId').value.trim();
  if (!experimentId) return alert('Please enter Experiment ID');
  if (unsubscribeFn) unsubscribeFn();
  unsubscribeFn = subscribeCycles(experimentId, (rows) => {
    renderTable(rows);
  });
  $('btnUnsub').disabled = false;
});

$('btnUnsub').addEventListener('click', () => {
  if (unsubscribeFn) {
    unsubscribeFn();
    unsubscribeFn = null;
  }
  $('btnUnsub').disabled = true;
});

// Auto-fill example experiment id from URL param or default
const params = new URLSearchParams(location.search);
const defaultId = params.get('experiment') || 'exp_20260819_001';
$('experimentId').value = defaultId;

// Auto-load once on page open (non-realtime)
loadCycles(defaultId).catch(err => console.warn('Load cycles failed', err));
