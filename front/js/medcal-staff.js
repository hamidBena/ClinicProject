/* =============================================================
   medicalStaff.js
   Healthcare Management System – Medical Staff dashboard
   ============================================================= */

'use strict';

/* ── Seed data ──────────────────────────────────────────────── */
const DOCTORS = [
    { id: 'hireche',    name: 'Dr. Hireche Anes',    speciality: 'Cardiology',      img: 'images/Cardiology.png',    status: 'available', waiting: 4, inProgress: 1, finished: 3 },
    { id: 'belfatmi',   name: 'Dr. Belfatmi Ilyes',  speciality: 'Orthopedics',     img: 'images/Orthopedics.png',   status: 'busy',      waiting: 2, inProgress: 1, finished: 2 },
    { id: 'amrani',     name: 'Dr. Amrani Sonia',    speciality: 'Neurology',       img: 'images/Neurology.png',     status: 'available', waiting: 3, inProgress: 0, finished: 4 },
    { id: 'meziani',    name: 'Dr. Meziani Karim',   speciality: 'Dermatology',     img: 'images/Dermatology.png',   status: 'unavailable', waiting: 0, inProgress: 0, finished: 0 },
    { id: 'benali',     name: 'Dr. Benali Sara',     speciality: 'Psychiatry',      img: 'images/Psychiatry.png',   status: 'available', waiting: 1, inProgress: 1, finished: 2 },
    { id: 'oukaci',     name: 'Dr. Oukaci Rachid',   speciality: 'Gastroenterology',img: 'images/Gastro.png',        status: 'busy',      waiting: 3, inProgress: 1, finished: 1 },
];

let reservations = [
    { id: 1,  patient: 'Messallem Ouail',  doctorId: 'hireche',  date: '2026-05-19', status: 'inProgress', queueNum: 1 },
    { id: 2,  patient: 'Cherif Anis',      doctorId: 'hireche',  date: '2026-05-19', status: 'waiting',    queueNum: 2 },
    { id: 3,  patient: 'Bouzidi Lina',     doctorId: 'belfatmi', date: '2026-05-19', status: 'waiting',    queueNum: 1 },
    { id: 4,  patient: 'Hamadi Youcef',    doctorId: 'amrani',   date: '2026-05-19', status: 'finished',   queueNum: 1 },
    { id: 5,  patient: 'Talbi Nadia',      doctorId: 'belfatmi', date: '2026-05-19', status: 'inProgress', queueNum: 2 },
    { id: 6,  patient: 'Khelifi Omar',     doctorId: 'oukaci',   date: '2026-05-19', status: 'waiting',    queueNum: 1 },
];

let nextReservationId = 7;
let activeQueueDoctorId = null;
let activeQueueFilter   = 'all';
let cancelTargetId      = null;
let updateDoctorTarget  = null;

/* ── Helpers ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const doctor = id => DOCTORS.find(d => d.id === id);

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function statusLabel(s) {
    return { waiting: 'Waiting', inProgress: 'In progress', finished: 'Finished' }[s] || s;
}

function statusClass(s) {
    return { waiting: 'status-waiting', inProgress: 'status-inProgress', finished: 'status-finished' }[s] || '';
}

function badgeClass(s) {
    return { available: 'badge-available', busy: 'badge-busy', unavailable: 'badge-unavailable' }[s] || '';
}

function badgeLabel(s) {
    return { available: 'Available', busy: 'Busy', unavailable: 'Unavailable' }[s] || s;
}

/* ── Date display ─────────────────────────────────────────────── */
function initDate() {
    const now = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const weekday = $('weekdayText');
    const dateEl  = $('dateText');
    if (weekday) weekday.textContent = days[now.getDay()];
    if (dateEl)  dateEl.textContent  = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

/* ── Navigation ───────────────────────────────────────────────── */
function initNav() {
    document.querySelectorAll('[data-page-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.pageTarget;
            navigateTo(target);
        });
    });
}

function navigateTo(target) {
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('is-active');
        v.hidden = true;
    });
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('is-active', l.dataset.pageTarget === target);
        l.setAttribute('aria-current', l.dataset.pageTarget === target ? 'page' : 'false');
    });

    const view = $(target);
    if (view) {
        view.hidden = false;
        view.classList.add('is-active');
    }

    // Lazy-render views
    if (target === 'home')         renderHome();
    if (target === 'reservations') renderReservations();
    if (target === 'queue')        renderQueueDoctorTabs();
    if (target === 'doctors')      renderDoctors();
}

/* ── HOME ─────────────────────────────────────────────────────── */
function renderHome() {
    const today = new Date().toISOString().slice(0, 10);
    const todayRes = reservations.filter(r => r.date === today);
    const waiting  = todayRes.filter(r => r.status === 'waiting').length;
    const done     = todayRes.filter(r => r.status === 'finished').length;
    const active   = DOCTORS.filter(d => d.status !== 'unavailable').length;

    const s = id => { const el = $(id); if (el) el.textContent = id === 'statDoctors' ? active : (id === 'statWaiting' ? waiting : (id === 'statDone' ? done : todayRes.length)); };
    s('statReservations'); s('statWaiting'); s('statDone'); s('statDoctors');

    // Recent reservations list
    const list = $('homeRecentList');
    if (!list) return;
    const recent = [...reservations].reverse().slice(0, 4);
    if (recent.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No reservations yet.</p>';
        return;
    }
    list.innerHTML = recent.map(r => {
        const doc = doctor(r.doctorId);
        return `
        <div class="mini-res-item">
            <img src="${doc ? doc.img : 'images/logo.png'}" alt="${doc ? doc.speciality : ''}">
            <div>
                <strong>${r.patient}</strong>
                <span>${doc ? doc.name : '—'} · ${formatDate(r.date)}</span>
            </div>
            <span class="status-badge ${statusClass(r.status)}" style="margin-left:auto;">${statusLabel(r.status)}</span>
        </div>`;
    }).join('');
}

/* ── RESERVATIONS ─────────────────────────────────────────────── */
function renderReservations() {
    const search = ($('reservationSearch')?.value || '').toLowerCase();
    const statusF = $('reservationStatusFilter')?.value || 'all';

    const filtered = reservations.filter(r => {
        const doc = doctor(r.doctorId);
        const matchSearch = r.patient.toLowerCase().includes(search) ||
                            (doc && doc.name.toLowerCase().includes(search));
        const matchStatus = statusF === 'all' || r.status === statusF;
        return matchSearch && matchStatus;
    });

    const grid  = $('reservationGrid');
    const empty = $('reservationEmpty');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    grid.innerHTML = filtered.map(r => {
        const doc = doctor(r.doctorId);
        return `
        <article class="reservation-card" data-res-id="${r.id}">
            <header>
                <div class="doctor-line">
                    <img src="${doc ? doc.img : 'images/logo.png'}" alt="${doc ? doc.speciality : ''}">
                    <div>
                        <h3>${doc ? doc.name : '—'}</h3>
                        <p>${doc ? doc.speciality : '—'}</p>
                    </div>
                </div>
                <span class="status-badge ${statusClass(r.status)}">${statusLabel(r.status)}</span>
            </header>
            <dl class="reservation-meta">
                <div><dt>Patient</dt><dd>${r.patient}</dd></div>
                <div><dt>Queue number</dt><dd>#${r.queueNum}</dd></div>
                <div><dt>Date</dt><dd>${formatDate(r.date)}</dd></div>
            </dl>
            <button type="button" class="button button-danger cancel-res-btn" data-res-id="${r.id}">
                Cancel reservation
            </button>
        </article>`;
    }).join('');

    grid.querySelectorAll('.cancel-res-btn').forEach(btn => {
        btn.addEventListener('click', () => openCancelDialog(Number(btn.dataset.resId)));
    });
}

function initReservationFilters() {
    $('reservationSearch')?.addEventListener('input', renderReservations);
    $('reservationStatusFilter')?.addEventListener('change', renderReservations);
}

/* ── QUEUE ────────────────────────────────────────────────────── */
function renderQueueDoctorTabs() {
    const list = $('doctorTabList');
    if (!list) return;

    list.innerHTML = DOCTORS.map(d => `
        <button type="button" class="doctor-tab${activeQueueDoctorId === d.id ? ' is-active' : ''}" data-doctor-id="${d.id}">
            <img src="${d.img}" alt="${d.speciality} icon">
            <span>
                <strong>${d.name}</strong>
                <small>${d.speciality}</small>
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
    const doc = doctor(activeQueueDoctorId);
    if (!doc) return;

    $('queueDoctorTitle').textContent = `${doc.name} queue`;

    const doctorRes = reservations.filter(r => r.doctorId === activeQueueDoctorId);
    const filtered  = activeQueueFilter === 'all' ? doctorRes : doctorRes.filter(r => r.status === activeQueueFilter);

    $('queueCount').textContent = `${doctorRes.length} patient${doctorRes.length !== 1 ? 's' : ''}`;

    // Next patient bar
    const inProgress = doctorRes.find(r => r.status === 'inProgress');
    const nextBar    = $('nextPatientBar');
    nextBar.hidden   = doc.status === 'unavailable';
    if (inProgress) {
        $('currentPatientName').textContent = inProgress.patient;
    } else {
        $('currentPatientName').textContent = 'No patient in progress';
    }

    const tbody = $('queueTableBody');
    const empty = $('queueEmpty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    tbody.innerHTML = filtered.map(r => `
        <tr>
            <td>${r.queueNum}</td>
            <td>${r.patient}</td>
            <td>${formatDate(r.date)}</td>
            <td><span class="status-badge ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
            <td>
                ${r.status === 'waiting'
                    ? `<button type="button" class="button button-sm button-primary start-btn" data-res-id="${r.id}">Start</button>`
                    : r.status === 'inProgress'
                    ? `<button type="button" class="button button-sm button-secondary finish-btn" data-res-id="${r.id}">Finish</button>`
                    : '—'}
            </td>
        </tr>`
    ).join('');

    tbody.querySelectorAll('.start-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.resId);
            const res = reservations.find(r => r.id === id);
            if (res) { res.status = 'inProgress'; }
            renderQueueTable();
            renderHome();
        });
    });

    tbody.querySelectorAll('.finish-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.resId);
            const res = reservations.find(r => r.id === id);
            if (res) { res.status = 'finished'; }
            renderQueueTable();
            renderHome();
        });
    });
}

function initQueueControls() {
    // Status filter segmented control
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            activeQueueFilter = btn.dataset.statusFilter;
            renderQueueTable();
        });
    });

    // Next patient button
    $('nextPatientBtn')?.addEventListener('click', () => {
        if (!activeQueueDoctorId) return;
        const doctorRes = reservations.filter(r => r.doctorId === activeQueueDoctorId);

        // Finish current in-progress
        const inProg = doctorRes.find(r => r.status === 'inProgress');
        if (inProg) inProg.status = 'finished';

        // Start next waiting
        const nextWaiting = doctorRes
            .filter(r => r.status === 'waiting')
            .sort((a, b) => a.queueNum - b.queueNum)[0];
        if (nextWaiting) nextWaiting.status = 'inProgress';

        renderQueueTable();
        renderHome();
    });
}

/* ── DOCTORS ──────────────────────────────────────────────────── */
function renderDoctors() {
    const search  = ($('doctorSearch')?.value || '').toLowerCase();
    const statusF = $('doctorStatusFilter')?.value || 'all';

    const filtered = DOCTORS.filter(d => {
        const matchSearch = d.name.toLowerCase().includes(search) ||
                            d.speciality.toLowerCase().includes(search);
        const matchStatus = statusF === 'all' || d.status === statusF;
        return matchSearch && matchStatus;
    });

    const grid  = $('doctorGrid');
    const empty = $('doctorEmpty');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    grid.innerHTML = filtered.map(d => `
        <article class="doctor-card">
            <div class="doctor-card-top">
                <img src="${d.img}" alt="${d.speciality} icon">
                <div>
                    <h3>${d.name}</h3>
                    <p>${d.speciality}</p>
                    <span class="chip ${badgeClass(d.status)}" style="margin-top:0.3rem;">${badgeLabel(d.status)}</span>
                </div>
            </div>
            <div class="doctor-card-stats">
                <div class="doctor-stat">
                    <strong>${d.waiting}</strong>
                    <span>Waiting</span>
                </div>
                <div class="doctor-stat">
                    <strong>${d.inProgress}</strong>
                    <span>In progress</span>
                </div>
                <div class="doctor-stat">
                    <strong>${d.finished}</strong>
                    <span>Done</span>
                </div>
            </div>
            <div class="doctor-card-actions">
                <button type="button" class="button button-secondary button-sm update-doc-btn" data-doctor-id="${d.id}" style="flex:1;">
                    Update status
                </button>
                <button type="button" class="button button-primary button-sm view-queue-btn" data-doctor-id="${d.id}" style="flex:1;">
                    View queue
                </button>
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

function initDoctorFilters() {
    $('doctorSearch')?.addEventListener('input', renderDoctors);
    $('doctorStatusFilter')?.addEventListener('change', renderDoctors);
}

/* ── ADD RESERVATION MODAL ────────────────────────────────────── */
function initAddReservationModal() {
    const openBtns = [
        $('openAddReservationBtn'),
    ];
    openBtns.forEach(b => b?.addEventListener('click', openAddReservationModal));

    $('closeAddReservationBtn')?.addEventListener('click', closeAddReservationModal);
    $('cancelAddResBtn')?.addEventListener('click', closeAddReservationModal);
    $('addReservationForm')?.addEventListener('submit', handleAddReservation);

    // Quick action btn
    document.querySelectorAll('[data-action="open-add-reservation"]').forEach(btn => {
        btn.addEventListener('click', openAddReservationModal);
    });
}

function openAddReservationModal() {
    // Populate doctor select
    const sel = $('resDoctor');
    if (sel) {
        sel.innerHTML = '<option value="">Select a doctor</option>' +
            DOCTORS.map(d => `<option value="${d.id}">${d.name} – ${d.speciality}</option>`).join('');
    }

    // Default date = today
    const dateInput = $('resDate');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    $('addReservationModal').hidden = false;
    $('modalOverlay').hidden = false;
    $('resPatientFirst')?.focus();
}

function closeAddReservationModal() {
    $('addReservationModal').hidden = true;
    closeOverlayIfAlone();
    $('addReservationForm')?.reset();
    clearFieldError(['resPatientFirst', 'resPatientLast', 'resDoctor', 'resDate']);
    const st = $('addResStatus');
    if (st) { st.textContent = ''; st.className = 'form-status'; }
}

function handleAddReservation(e) {
    e.preventDefault();
    let valid = true;

    const fName  = $('resPatientFirst').value.trim();
    const lName  = $('resPatientLast').value.trim();
    const docId  = $('resDoctor').value;
    const date   = $('resDate').value;

    if (!fName) { showFieldError('resPatientFirst', 'First name is required.'); valid = false; }
    else clearFieldError(['resPatientFirst']);
    if (!lName) { showFieldError('resPatientLast', 'Last name is required.'); valid = false; }
    else clearFieldError(['resPatientLast']);
    if (!docId) { showFieldError('resDoctor', 'Please select a doctor.'); valid = false; }
    else clearFieldError(['resDoctor']);
    if (!date)  { showFieldError('resDate', 'Please pick a date.'); valid = false; }
    else clearFieldError(['resDate']);

    if (!valid) return;

    // Assign queue number
    const sameQueue = reservations.filter(r => r.doctorId === docId && r.date === date);
    const queueNum  = sameQueue.length + 1;

    reservations.push({
        id: nextReservationId++,
        patient: `${fName} ${lName}`,
        doctorId: docId,
        date,
        status: 'waiting',
        queueNum,
        notes: $('resNotes')?.value.trim() || '',
    });

    const st = $('addResStatus');
    st.textContent = 'Reservation added successfully.';
    st.className   = 'form-status is-success';

    setTimeout(() => {
        closeAddReservationModal();
        renderHome();
        renderReservations();
    }, 900);
}

/* ── UPDATE DOCTOR STATUS MODAL ───────────────────────────────── */
function openUpdateDoctorModal(doctorId) {
    const doc = doctor(doctorId);
    if (!doc) return;
    updateDoctorTarget = doctorId;

    const info = $('doctorModalInfo');
    if (info) {
        info.innerHTML = `
            <img src="${doc.img}" alt="${doc.speciality}">
            <div>
                <strong>${doc.name}</strong>
                <span>${doc.speciality}</span>
            </div>`;
    }

    $('doctorStatusSelect').value = doc.status;
    $('doctorQueueAction').value  = 'none';

    $('updateDoctorModal').hidden = false;
    $('modalOverlay').hidden      = false;
}

function closeUpdateDoctorModal() {
    $('updateDoctorModal').hidden = true;
    closeOverlayIfAlone();
    updateDoctorTarget = null;
    const st = $('updateDoctorStatus');
    if (st) { st.textContent = ''; st.className = 'form-status'; }
}

function initUpdateDoctorModal() {
    $('closeUpdateDoctorBtn')?.addEventListener('click', closeUpdateDoctorModal);
    $('cancelUpdateDoctorBtn')?.addEventListener('click', closeUpdateDoctorModal);

    $('saveDoctorUpdateBtn')?.addEventListener('click', () => {
        const doc = doctor(updateDoctorTarget);
        if (!doc) return;

        doc.status = $('doctorStatusSelect').value;

        const action = $('doctorQueueAction').value;
        if (action === 'create') {
            doc.waiting    = 0;
            doc.inProgress = 0;
            doc.finished   = 0;
        } else if (action === 'reset') {
            doc.waiting    = 0;
            doc.inProgress = 0;
            doc.finished   = 0;
            // Remove queue reservations for this doctor
            reservations = reservations.filter(r => r.doctorId !== updateDoctorTarget);
        }

        const st = $('updateDoctorStatus');
        st.textContent = 'Doctor updated successfully.';
        st.className   = 'form-status is-success';

        setTimeout(() => {
            closeUpdateDoctorModal();
            renderDoctors();
            renderHome();
        }, 700);
    });
}

/* ── CANCEL RESERVATION DIALOG ────────────────────────────────── */
function openCancelDialog(resId) {
    cancelTargetId = resId;
    const res = reservations.find(r => r.id === resId);
    if (res) $('cancelPatientName').textContent = res.patient;
    $('cancelDialog').hidden = false;
    $('modalOverlay').hidden = false;
}

function closeCancelDialog() {
    $('cancelDialog').hidden = true;
    closeOverlayIfAlone();
    cancelTargetId = null;
}

function initCancelDialog() {
    $('confirmCancelBtn')?.addEventListener('click', () => {
        if (cancelTargetId !== null) {
            reservations = reservations.filter(r => r.id !== cancelTargetId);
        }
        closeCancelDialog();
        renderReservations();
        renderHome();
    });
    $('closeCancelDialogBtn')?.addEventListener('click', closeCancelDialog);
}

/* ── Overlay / modal helpers ──────────────────────────────────── */
function closeOverlayIfAlone() {
    const modals = [
        $('addReservationModal'),
        $('updateDoctorModal'),
        $('cancelDialog'),
    ];
    const anyOpen = modals.some(m => m && !m.hidden);
    if (!anyOpen) $('modalOverlay').hidden = true;
}

$('modalOverlay')?.addEventListener('click', () => {
    closeAddReservationModal();
    closeUpdateDoctorModal();
    closeCancelDialog();
});

/* ── Profile form ─────────────────────────────────────────────── */
function initProfileForm() {
    $('profileForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let valid = true;

        const email = $('pfEmail').value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('pfEmail', 'Enter a valid email address.');
            valid = false;
        } else clearFieldError(['pfEmail']);

        if (!valid) return;

        const st = $('profileStatus');
        st.textContent = 'Profile updated successfully.';
        st.className   = 'form-status is-success';

        const fullName = [
            $('pfFirstName').value.trim(),
            $('pfLastName').value.trim(),
        ].filter(Boolean).join(' ');

        if (fullName) {
            $('profileFullName').textContent = fullName;
            $('sidebarUserName').textContent  = fullName;
        }
        if (email) $('infoEmail').textContent = email;
        const phone = $('pfPhone').value.trim();
        if (phone) $('infoPhone').textContent = phone;
    });

    $('cancelProfileBtn')?.addEventListener('click', () => {
        $('profileForm')?.reset();
        const st = $('profileStatus');
        if (st) { st.textContent = ''; st.className = 'form-status'; }
    });
}

/* ── Field error helpers ──────────────────────────────────────── */
function showFieldError(fieldId, msg) {
    const errEl = document.getElementById(fieldId + 'Err');
    if (errEl) errEl.textContent = msg;
}

function clearFieldError(fieldIds) {
    fieldIds.forEach(id => {
        const errEl = document.getElementById(id + 'Err');
        if (errEl) errEl.textContent = '';
    });
}

/* ── Bootstrap ────────────────────────────────────────────────── */
function init() {
    initDate();
    initNav();
    initReservationFilters();
    initQueueControls();
    initDoctorFilters();
    initAddReservationModal();
    initUpdateDoctorModal();
    initCancelDialog();
    initProfileForm();

    // Initial render
    renderHome();
}

document.addEventListener('DOMContentLoaded', init);