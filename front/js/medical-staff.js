'use strict';

/* ── Seed data ─────────────────────────────────────────────── */
const DOCTORS = [
    { id: 'hireche',  name: 'Dr. Hireche Anes',    speciality: 'Cardiology',       img: 'images/Cardiology.png',  status: 'available',   waiting: 4, inProgress: 1, finished: 3 },
    { id: 'belfatmi', name: 'Dr. Belfatmi Ilyes',  speciality: 'Orthopedics',      img: 'images/Orthopedics.png', status: 'busy',        waiting: 2, inProgress: 1, finished: 2 },
    { id: 'amrani',   name: 'Dr. Amrani Sonia',    speciality: 'Neurology',        img: 'images/Neurology.png',   status: 'available',   waiting: 3, inProgress: 0, finished: 4 },
    { id: 'meziani',  name: 'Dr. Meziani Karim',   speciality: 'Dermatology',      img: 'images/logo.png',        status: 'unavailable', waiting: 0, inProgress: 0, finished: 0 },
    { id: 'benali',   name: 'Dr. Benali Sara',     speciality: 'Psychiatry',       img: 'images/logo.png',        status: 'available',   waiting: 1, inProgress: 1, finished: 2 },
    { id: 'oukaci',   name: 'Dr. Oukaci Rachid',   speciality: 'Gastroenterology', img: 'images/logo.png',        status: 'busy',        waiting: 3, inProgress: 1, finished: 1 },
];

let reservations = [
    { id: 1, patient: 'Messallem Ouail', doctorId: 'hireche',  date: '2026-05-19', status: 'inProgress', queueNum: 1, estDuration: 20 },
    { id: 2, patient: 'Cherif Anis',     doctorId: 'hireche',  date: '2026-05-19', status: 'waiting',    queueNum: 2, estDuration: 15 },
    { id: 3, patient: 'Bouzidi Lina',    doctorId: 'belfatmi', date: '2026-05-19', status: 'waiting',    queueNum: 1, estDuration: 30 },
    { id: 4, patient: 'Hamadi Youcef',   doctorId: 'amrani',   date: '2026-05-19', status: 'finished',   queueNum: 1, estDuration: 25 },
    { id: 5, patient: 'Talbi Nadia',     doctorId: 'belfatmi', date: '2026-05-19', status: 'inProgress', queueNum: 2, estDuration: 20 },
    { id: 6, patient: 'Khelifi Omar',    doctorId: 'oukaci',   date: '2026-05-19', status: 'waiting',    queueNum: 1, estDuration: 15 },
];

let nextId             = 7;
let activeQueueDoctorId = null;
let activeQueueFilter   = 'all';
let cancelTargetId      = null;
let updateDoctorTarget  = null;

/* ── Helpers ───────────────────────────────────────────────── */
const $      = id  => document.getElementById(id);
const getDoc = id  => DOCTORS.find(d => d.id === id);

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

const STATUS_LABEL = { waiting: 'Waiting', inProgress: 'In progress', finished: 'Finished' };
const STATUS_CLASS = { waiting: 'status-waiting', inProgress: 'status-inProgress', finished: 'status-finished' };
const BADGE_CLASS  = { available: 'badge-available', busy: 'badge-busy', unavailable: 'badge-unavailable' };
const BADGE_LABEL  = { available: 'Available', busy: 'Busy', unavailable: 'Unavailable' };

/* ── Date ──────────────────────────────────────────────────── */
function initDate() {
    const now    = new Date();
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const wd = $('weekdayText'); if (wd) wd.textContent = DAYS[now.getDay()];
    const dt = $('dateText');    if (dt) dt.textContent = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/* ── Navigation ────────────────────────────────────────────── */
function navigateTo(target) {
    // hide all views
    document.querySelectorAll('.view').forEach(v => {
        v.style.display = 'none';
    });

    // show target view
    const view = $(target);
    if (view) view.style.display = 'block';

    // update nav active state
    document.querySelectorAll('.nav-link').forEach(l => {
        const isActive = l.dataset.pageTarget === target;
        l.classList.toggle('is-active', isActive);
        l.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // render view content
    if (target === 'home')         renderHome();
    if (target === 'reservations') renderReservations();
    if (target === 'queue')        renderQueueDoctorTabs();
    if (target === 'doctors')      renderDoctors();
}

function initNav() {
    document.querySelectorAll('[data-page-target]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.pageTarget));
    });
    document.querySelectorAll('[data-action="open-add-reservation"]').forEach(btn => {
        btn.addEventListener('click', openAddReservationModal);
    });
}

/* ── HOME ──────────────────────────────────────────────────── */
function renderHome() {
    const today   = new Date().toISOString().slice(0, 10);
    const todayR  = reservations.filter(r => r.date === today);
    const waiting = todayR.filter(r => r.status === 'waiting').length;
    const done    = todayR.filter(r => r.status === 'finished').length;
    const active  = DOCTORS.filter(d => d.status !== 'unavailable').length;

    setText('statReservations', todayR.length);
    setText('statWaiting',      waiting);
    setText('statDone',         done);
    setText('statDoctors',      active);

    const list = $('homeRecentList');
    if (!list) return;
    const recent = [...reservations].reverse().slice(0, 4);
    if (!recent.length) { list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No reservations yet.</p>'; return; }

    list.innerHTML = recent.map(r => {
        const doc = getDoc(r.doctorId);
        return `<div class="mini-res-item">
            <img src="${doc ? doc.img : 'images/logo.png'}" alt="">
            <div>
                <strong>${esc(r.patient)}</strong>
                <span>${doc ? esc(doc.name) : '—'} · ${formatDate(r.date)}</span>
            </div>
            <span class="status-badge ${STATUS_CLASS[r.status] || ''}" style="margin-left:auto;">${STATUS_LABEL[r.status] || r.status}</span>
        </div>`;
    }).join('');
}

function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ── RESERVATIONS ──────────────────────────────────────────── */
function renderReservations() {
    const search  = ($('reservationSearch')?.value || '').toLowerCase();
    const statusF = $('reservationStatusFilter')?.value || 'all';

    const filtered = reservations.filter(r => {
        const doc = getDoc(r.doctorId);
        const matchSearch = r.patient.toLowerCase().includes(search) || (doc && doc.name.toLowerCase().includes(search));
        const matchStatus = statusF === 'all' || r.status === statusF;
        return matchSearch && matchStatus;
    });

    const grid  = $('reservationGrid');
    const empty = $('reservationEmpty');
    if (!grid) return;

    if (!filtered.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = filtered.map(r => {
        const doc = getDoc(r.doctorId);
        return `<article class="reservation-card">
            <header>
                <div class="doctor-line">
                    <img src="${doc ? doc.img : 'images/logo.png'}" alt="">
                    <div>
                        <h3>${doc ? esc(doc.name) : '—'}</h3>
                        <p>${doc ? esc(doc.speciality) : '—'}</p>
                    </div>
                </div>
                <span class="status-badge ${STATUS_CLASS[r.status] || ''}">${STATUS_LABEL[r.status] || r.status}</span>
            </header>
            <dl class="reservation-meta">
                <div><dt>Patient</dt><dd>${esc(r.patient)}</dd></div>
                <div><dt>Queue #</dt><dd>#${r.queueNum}</dd></div>
                <div><dt>Date</dt><dd>${formatDate(r.date)}</dd></div>
            </dl>
            <button type="button" class="button button-danger cancel-res-btn" data-res-id="${r.id}">Cancel reservation</button>
        </article>`;
    }).join('');

    grid.querySelectorAll('.cancel-res-btn').forEach(btn => {
        btn.addEventListener('click', () => openCancelDialog(Number(btn.dataset.resId)));
    });
}

/* ── QUEUE ─────────────────────────────────────────────────── */
function renderQueueDoctorTabs() {
    const list = $('doctorTabList');
    if (!list) return;

    list.innerHTML = DOCTORS.map(d => `
        <button type="button" class="doctor-tab${activeQueueDoctorId === d.id ? ' is-active' : ''}" data-doctor-id="${d.id}">
            <img src="${d.img}" alt="">
            <span>
                <strong>${esc(d.name)}</strong>
                <small>${esc(d.speciality)}</small>
            </span>
        </button>`
    ).join('');

    list.querySelectorAll('.doctor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activeQueueDoctorId = tab.dataset.doctorId;
            renderQueueDoctorTabs();
            renderQueueTable();
        });
    });

    if (activeQueueDoctorId) renderQueueTable();
}

function renderQueueTable() {
    const doc = getDoc(activeQueueDoctorId);
    if (!doc) return;

    setText('queueDoctorTitle', `${doc.name} — queue`);

    const doctorRes = reservations.filter(r => r.doctorId === activeQueueDoctorId);
    const filtered  = activeQueueFilter === 'all' ? doctorRes : doctorRes.filter(r => r.status === activeQueueFilter);

    setText('queueCount', `${doctorRes.length} patient${doctorRes.length !== 1 ? 's' : ''}`);

    const inProgress = doctorRes.find(r => r.status === 'inProgress');
    const nextBar    = $('nextPatientBar');
    if (nextBar) nextBar.style.display = doc.status === 'unavailable' ? 'none' : 'flex';
    setText('currentPatientName', inProgress ? inProgress.patient : 'No patient in progress');

    const tbody = $('queueTableBody');
    const empty = $('queueEmpty');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = filtered.map(r => `
        <tr>
            <td>${r.queueNum}</td>
            <td>${esc(r.patient)}</td>
            <td>${formatDate(r.date)}</td>
            <td>${r.estDuration ? `${r.estDuration} min` : '—'}</td>
            <td><span class="status-badge ${STATUS_CLASS[r.status] || ''}">${STATUS_LABEL[r.status] || r.status}</span></td>
            <td>
                ${r.status === 'waiting'
                    ? `<button class="button button-sm button-primary start-btn" data-res-id="${r.id}">Start</button>`
                    : r.status === 'inProgress'
                    ? `<button class="button button-sm button-secondary finish-btn" data-res-id="${r.id}">Finish</button>`
                    : '—'}
            </td>
        </tr>`
    ).join('');

    tbody.querySelectorAll('.start-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const res = reservations.find(r => r.id === Number(btn.dataset.resId));
            if (res) res.status = 'inProgress';
            renderQueueTable(); renderHome();
        });
    });
    tbody.querySelectorAll('.finish-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const res = reservations.find(r => r.id === Number(btn.dataset.resId));
            if (res) res.status = 'finished';
            renderQueueTable(); renderHome();
        });
    });
}

function initQueueControls() {
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            activeQueueFilter = btn.dataset.statusFilter;
            renderQueueTable();
        });
    });

    $('nextPatientBtn')?.addEventListener('click', () => {
        if (!activeQueueDoctorId) return;
        const doctorRes = reservations.filter(r => r.doctorId === activeQueueDoctorId);
        const inProg    = doctorRes.find(r => r.status === 'inProgress');
        if (inProg) inProg.status = 'finished';
        const next = doctorRes.filter(r => r.status === 'waiting').sort((a, b) => a.queueNum - b.queueNum)[0];
        if (next) next.status = 'inProgress';
        renderQueueTable(); renderHome();
    });
}

/* ── DOCTORS ───────────────────────────────────────────────── */
function renderDoctors() {
    const search  = ($('doctorSearch')?.value || '').toLowerCase();
    const statusF = $('doctorStatusFilter')?.value || 'all';

    const filtered = DOCTORS.filter(d => {
        const matchSearch = d.name.toLowerCase().includes(search) || d.speciality.toLowerCase().includes(search);
        const matchStatus = statusF === 'all' || d.status === statusF;
        return matchSearch && matchStatus;
    });

    const grid  = $('doctorGrid');
    const empty = $('doctorEmpty');
    if (!grid) return;

    if (!filtered.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = filtered.map(d => `
        <article class="doctor-card">
            <div class="doctor-card-top">
                <img src="${d.img}" alt="">
                <div>
                    <h3>${esc(d.name)}</h3>
                    <p>${esc(d.speciality)}</p>
                    <span class="chip ${BADGE_CLASS[d.status] || ''}" style="margin-top:0.3rem;">${BADGE_LABEL[d.status] || d.status}</span>
                </div>
            </div>
            <div class="doctor-card-stats">
                <div class="doctor-stat"><strong>${d.waiting}</strong><span>Waiting</span></div>
                <div class="doctor-stat"><strong>${d.inProgress}</strong><span>In progress</span></div>
                <div class="doctor-stat"><strong>${d.finished}</strong><span>Done</span></div>
            </div>
            <div class="doctor-card-actions">
                <button type="button" class="button button-secondary button-sm update-doc-btn" data-doctor-id="${d.id}" style="flex:1;">Update status</button>
                <button type="button" class="button button-primary button-sm view-queue-btn" data-doctor-id="${d.id}" style="flex:1;">View queue</button>
            </div>
        </article>`
    ).join('');

    grid.querySelectorAll('.update-doc-btn').forEach(btn => {
        btn.addEventListener('click', () => openUpdateDoctorModal(btn.dataset.doctorId));
    });
    grid.querySelectorAll('.view-queue-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeQueueDoctorId = btn.dataset.doctorId;
            navigateTo('queue');
        });
    });
}

/* ── ADD RESERVATION MODAL ─────────────────────────────────── */
function openAddReservationModal() {
    const sel = $('resDoctor');
    if (sel) sel.innerHTML = '<option value="">Select a doctor</option>' +
        DOCTORS.map(d => `<option value="${d.id}">${esc(d.name)} – ${esc(d.speciality)}</option>`).join('');
    const di = $('resDate');
    if (di) di.value = new Date().toISOString().slice(0, 10);
    showModal('addReservationModal');
    $('resPatientFirst')?.focus();
}

function closeAddReservationModal() {
    hideModal('addReservationModal');
    $('addReservationForm')?.reset();
    clearErrors(['resPatientFirst','resPatientLast','resDoctor','resDate']);
    resetStatus('addResStatus');
}

function handleAddReservation(e) {
    e.preventDefault();
    let ok = true;
    const fName = $('resPatientFirst').value.trim();
    const lName = $('resPatientLast').value.trim();
    const docId = $('resDoctor').value;
    const date  = $('resDate').value;

    if (!fName) { setError('resPatientFirst', 'First name is required.'); ok = false; } else clearErrors(['resPatientFirst']);
    if (!lName) { setError('resPatientLast',  'Last name is required.');  ok = false; } else clearErrors(['resPatientLast']);
    if (!docId) { setError('resDoctor', 'Please select a doctor.');       ok = false; } else clearErrors(['resDoctor']);
    if (!date)  { setError('resDate',   'Please pick a date.');           ok = false; } else clearErrors(['resDate']);
    if (!ok) return;

    const queueNum = reservations.filter(r => r.doctorId === docId && r.date === date).length + 1;
    reservations.push({ id: nextId++, patient: `${fName} ${lName}`, doctorId: docId, date, status: 'waiting', queueNum, notes: $('resNotes')?.value.trim() || '' });

    const st = $('addResStatus');
    if (st) { st.textContent = 'Reservation added successfully.'; st.className = 'form-status is-success'; }
    setTimeout(() => { closeAddReservationModal(); renderHome(); renderReservations(); }, 900);
}

/* ── UPDATE DOCTOR MODAL ───────────────────────────────────── */
function openUpdateDoctorModal(doctorId) {
    const doc = getDoc(doctorId);
    if (!doc) return;
    updateDoctorTarget = doctorId;

    const info = $('doctorModalInfo');
    if (info) info.innerHTML = `<img src="${doc.img}" alt=""><div><strong>${esc(doc.name)}</strong><span>${esc(doc.speciality)}</span></div>`;

    $('doctorStatusSelect').value = doc.status;
    $('doctorQueueAction').value  = 'none';
    showModal('updateDoctorModal');
}

function closeUpdateDoctorModal() {
    hideModal('updateDoctorModal');
    updateDoctorTarget = null;
    resetStatus('updateDoctorStatus');
}

/* ── CANCEL DIALOG ─────────────────────────────────────────── */
function openCancelDialog(resId) {
    cancelTargetId = resId;
    const res = reservations.find(r => r.id === resId);
    if (res) setText('cancelPatientName', res.patient);
    showModal('cancelDialog');
}

function closeCancelDialog() {
    hideModal('cancelDialog');
    cancelTargetId = null;
}

/* ── Modal helpers ─────────────────────────────────────────── */
function showModal(id) {
    const el = $(id); if (el) el.style.display = 'block';
    const ov = $('modalOverlay'); if (ov) ov.style.display = 'block';
}

function hideModal(id) {
    const el = $(id); if (el) el.style.display = 'none';
    // hide overlay only if no other modal is open
    const modals = ['addReservationModal','updateDoctorModal','cancelDialog'];
    const anyOpen = modals.filter(m => m !== id).some(m => { const e = $(m); return e && e.style.display === 'block'; });
    if (!anyOpen) { const ov = $('modalOverlay'); if (ov) ov.style.display = 'none'; }
}

/* ── Profile ───────────────────────────────────────────────── */
function initProfileForm() {
    $('profileForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const email = $('pfEmail').value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('pfEmail', 'Enter a valid email.'); return; }
        clearErrors(['pfEmail']);

        const fullName = [$('pfFirstName').value.trim(), $('pfLastName').value.trim()].filter(Boolean).join(' ');
        if (fullName) { setText('profileFullName', fullName); setText('sidebarUserName', fullName); }
        if (email)    setText('infoEmail', email);
        const phone = $('pfPhone').value.trim();
        if (phone) setText('infoPhone', phone);

        const st = $('profileStatus');
        if (st) { st.textContent = 'Profile updated successfully.'; st.className = 'form-status is-success'; }
    });

    $('cancelProfileBtn')?.addEventListener('click', () => {
        $('profileForm')?.reset();
        resetStatus('profileStatus');
    });
}

/* ── Field helpers ─────────────────────────────────────────── */
function setError(fieldId, msg) { const e = $(fieldId + 'Err'); if (e) e.textContent = msg; }
function clearErrors(ids)       { ids.forEach(id => setError(id, '')); }
function resetStatus(id)        { const e = $(id); if (e) { e.textContent = ''; e.className = 'form-status'; } }

/* ── Wire everything ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // Set initial view states via style (not hidden attribute)
    document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
    const home = $('home'); if (home) home.style.display = 'block';

    // Also hide modals/overlay via style
    ['addReservationModal','updateDoctorModal','cancelDialog','modalOverlay'].forEach(id => {
        const el = $(id); if (el) el.style.display = 'none';
    });

    initDate();
    initNav();
    renderHome();

    // Reservation filters
    $('reservationSearch')?.addEventListener('input', renderReservations);
    $('reservationStatusFilter')?.addEventListener('change', renderReservations);

    // Doctor filters
    $('doctorSearch')?.addEventListener('input', renderDoctors);
    $('doctorStatusFilter')?.addEventListener('change', renderDoctors);

    // Queue controls
    initQueueControls();

    // Add reservation modal
    $('openAddReservationBtn')?.addEventListener('click', openAddReservationModal);
    $('closeAddReservationBtn')?.addEventListener('click', closeAddReservationModal);
    $('cancelAddResBtn')?.addEventListener('click', closeAddReservationModal);
    $('addReservationForm')?.addEventListener('submit', handleAddReservation);

    // Update doctor modal
    $('closeUpdateDoctorBtn')?.addEventListener('click', closeUpdateDoctorModal);
    $('cancelUpdateDoctorBtn')?.addEventListener('click', closeUpdateDoctorModal);
    $('saveDoctorUpdateBtn')?.addEventListener('click', () => {
        const doc = getDoc(updateDoctorTarget); if (!doc) return;
        doc.status = $('doctorStatusSelect').value;
        const action = $('doctorQueueAction').value;
        if (action === 'create' || action === 'reset') {
            doc.waiting = 0; doc.inProgress = 0; doc.finished = 0;
            if (action === 'reset') reservations = reservations.filter(r => r.doctorId !== updateDoctorTarget);
        }
        const st = $('updateDoctorStatus');
        if (st) { st.textContent = 'Doctor updated.'; st.className = 'form-status is-success'; }
        setTimeout(() => { closeUpdateDoctorModal(); renderDoctors(); renderHome(); }, 700);
    });

    // Cancel dialog
    $('confirmCancelBtn')?.addEventListener('click', () => {
        if (cancelTargetId !== null) reservations = reservations.filter(r => r.id !== cancelTargetId);
        closeCancelDialog(); renderReservations(); renderHome();
    });
    $('closeCancelDialogBtn')?.addEventListener('click', closeCancelDialog);

    // Overlay click closes all modals
    $('modalOverlay')?.addEventListener('click', () => {
        closeAddReservationModal();
        closeUpdateDoctorModal();
        closeCancelDialog();
    });

    // Profile
    initProfileForm();
});