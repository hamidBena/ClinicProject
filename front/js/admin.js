'use strict';

/* ─── Seed data ────────────────────────────────────────────── */
let doctors = [
    { id: 1, first: 'Hireche',  last: 'Anes',    email: 'hireche@clinic.dz',  phone: '+213 550 111 111', speciality: 'Cardiology',       clinic: '12 Rue Didouche, Alger',  status: 'active' },
    { id: 2, first: 'Belfatmi', last: 'Ilyes',   email: 'belfatmi@clinic.dz', phone: '+213 550 222 222', speciality: 'Orthopedics',      clinic: '8 Bd Zighoud, Alger',     status: 'active' },
    { id: 3, first: 'Amrani',   last: 'Sonia',   email: 'amrani@clinic.dz',   phone: '+213 550 333 333', speciality: 'Neurology',        clinic: '3 Rue Ibn Badis, Alger',  status: 'active' },
    { id: 4, first: 'Meziani',  last: 'Karim',   email: 'meziani@clinic.dz',  phone: '+213 550 444 444', speciality: 'Dermatology',      clinic: '22 Bd Krim Belkacem',     status: 'blocked' },
    { id: 5, first: 'Benali',   last: 'Sara',    email: 'benali@clinic.dz',   phone: '+213 550 555 555', speciality: 'Psychiatry',       clinic: '5 Rue Larbi Ben Mhidi',   status: 'active' },
    { id: 6, first: 'Oukaci',   last: 'Rachid',  email: 'oukaci@clinic.dz',   phone: '+213 550 666 666', speciality: 'Gastroenterology', clinic: '17 Rue Hassiba Ben Ali',  status: 'active' },
];

let staffList = [
    { id: 1, first: 'Ferhat',   last: 'Lila',    username: 'lila.f',   email: 'lila@clinic.dz',   phone: '+213 551 100 100', status: 'active' },
    { id: 2, first: 'Ouali',    last: 'Nassim',  username: 'nassim.o', email: 'nassim@clinic.dz', phone: '+213 551 200 200', status: 'active' },
    { id: 3, first: 'Brahim',   last: 'Yasmine', username: 'yasmine.b',email: 'yasmine@clinic.dz',phone: '+213 551 300 300', status: 'blocked' },
];

let patients = [
    { id: 1, first: 'Messallem', last: 'Ouail',  email: 'ouail@mail.com',   phone: '+213 770 001 001', insurance: 'INS-001', status: 'active' },
    { id: 2, first: 'Cherif',    last: 'Anis',   email: 'anis@mail.com',    phone: '+213 770 002 002', insurance: 'INS-002', status: 'active' },
    { id: 3, first: 'Bouzidi',   last: 'Lina',   email: 'lina@mail.com',    phone: '+213 770 003 003', insurance: 'INS-003', status: 'active' },
    { id: 4, first: 'Hamadi',    last: 'Youcef', email: 'youcef@mail.com',  phone: '+213 770 004 004', insurance: 'INS-004', status: 'blocked' },
    { id: 5, first: 'Talbi',     last: 'Nadia',  email: 'nadia@mail.com',   phone: '+213 770 005 005', insurance: 'INS-005', status: 'active' },
    { id: 6, first: 'Khelifi',   last: 'Omar',   email: 'omar@mail.com',    phone: '+213 770 006 006', insurance: 'INS-006', status: 'active' },
];

let nextDoctorId  = 7;
let nextStaffId   = 4;

// Pending confirm action
let pendingConfirm = null;

/* ─── Helpers ──────────────────────────────────────────────── */
const $   = id  => document.getElementById(id);
const esc = s   => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fullName = p => `${esc(p.first)} ${esc(p.last)}`;
const initials = p => `${p.first[0]}${p.last[0]}`.toUpperCase();

const COLORS = ['#23957f','#1a5fa8','#9a6a10','#6a3f9a','#b64242','#2e7d8c'];
const colorFor = id => COLORS[id % COLORS.length];

function badge(status) {
    return `<span class="badge badge-${status}">${status === 'active' ? 'Active' : 'Blocked'}</span>`;
}

function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

/* ─── Date ─────────────────────────────────────────────────── */
function initDate() {
    const now    = new Date();
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    setText('weekdayText', DAYS[now.getDay()]);
    setText('dateText', `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
}

/* ─── Navigation ───────────────────────────────────────────── */
function navigateTo(page) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('is-active', l.dataset.page === page);
    });

    const view = $(page);
    if (view) view.style.display = 'block';

    if (page === 'home')     renderHome();
    if (page === 'doctors')  renderDoctors();
    if (page === 'staff')    renderStaff();
    if (page === 'patients') renderPatients();
}

function initNav() {
    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
}

function handleAction(action) {
    if (action === 'add-doctor') openModal('addDoctorModal');
    if (action === 'add-staff')  openModal('addStaffModal');
}

/* ─── HOME ─────────────────────────────────────────────────── */
function renderHome() {
    const blocked = [...doctors, ...staffList, ...patients].filter(x => x.status === 'blocked').length;
    setText('statDoctors',  doctors.length);
    setText('statStaff',    staffList.length);
    setText('statPatients', patients.length);
    setText('statBlocked',  blocked);

    const listEl = $('recentAccountsList');
    if (!listEl) return;

    const recent = [
        ...doctors.slice(-2).map(d => ({ ...d, type: 'Doctor', sub: d.speciality })),
        ...staffList.slice(-2).map(s => ({ ...s, type: 'Staff', sub: s.username })),
        ...patients.slice(-2).map(p => ({ ...p, type: 'Patient', sub: p.email })),
    ].reverse().slice(0, 6);

    listEl.innerHTML = recent.map(r => `
        <div class="recent-item">
            <div class="recent-avatar" style="background:${colorFor(r.id)}">${initials(r)}</div>
            <div style="min-width:0;">
                <strong>${fullName(r)}</strong>
                <span>${esc(r.type)} · ${esc(r.sub)}</span>
            </div>
            <span class="badge badge-${r.status}" style="margin-left:auto;flex-shrink:0;">${r.status === 'active' ? 'Active' : 'Blocked'}</span>
        </div>`
    ).join('');
}

/* ─── DOCTORS ──────────────────────────────────────────────── */
function renderDoctors() {
    const search  = ($('doctorSearch')?.value || '').toLowerCase();
    const statusF = $('doctorStatusFilter')?.value || 'all';

    const filtered = doctors.filter(d => {
        const name = `${d.first} ${d.last}`.toLowerCase();
        return (name.includes(search) || d.speciality.toLowerCase().includes(search)) &&
               (statusF === 'all' || d.status === statusF);
    });

    const tbody = $('doctorTableBody');
    const empty = $('doctorEmpty');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td>
                <div class="cell-name">
                    <div class="cell-avatar" style="background:${colorFor(d.id)}">${initials(d)}</div>
                    Dr. ${fullName(d)}
                </div>
            </td>
            <td>${esc(d.speciality)}</td>
            <td>${esc(d.email)}</td>
            <td>${esc(d.phone)}</td>
            <td>${badge(d.status)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-secondary button-sm edit-doc-btn" data-id="${d.id}">Edit</button>
                    <button class="button button-sm ${d.status === 'active' ? 'button-danger block-btn' : 'button-primary unblock-btn'}" data-id="${d.id}">
                        ${d.status === 'active' ? 'Block' : 'Unblock'}
                    </button>
                </div>
            </td>
        </tr>`
    ).join('');

    tbody.querySelectorAll('.edit-doc-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditDoctor(Number(btn.dataset.id)));
    });

    tbody.querySelectorAll('.block-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            confirmAction(
                'Block doctor',
                `Are you sure you want to block this doctor's account?`,
                () => { const d = doctors.find(x => x.id === id); if (d) d.status = 'blocked'; renderDoctors(); renderHome(); }
            );
        });
    });

    tbody.querySelectorAll('.unblock-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const d = doctors.find(x => x.id === id);
            if (d) { d.status = 'active'; renderDoctors(); renderHome(); }
        });
    });
}

/* ─── STAFF ────────────────────────────────────────────────── */
function renderStaff() {
    const search  = ($('staffSearch')?.value || '').toLowerCase();
    const statusF = $('staffStatusFilter')?.value || 'all';

    const filtered = staffList.filter(s => {
        const name = `${s.first} ${s.last}`.toLowerCase();
        return (name.includes(search) || s.email.toLowerCase().includes(search)) &&
               (statusF === 'all' || s.status === statusF);
    });

    const tbody = $('staffTableBody');
    const empty = $('staffEmpty');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>
                <div class="cell-name">
                    <div class="cell-avatar" style="background:${colorFor(s.id + 10)}">${initials(s)}</div>
                    ${fullName(s)}
                </div>
            </td>
            <td>${esc(s.username)}</td>
            <td>${esc(s.email)}</td>
            <td>${esc(s.phone)}</td>
            <td>${badge(s.status)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-sm ${s.status === 'active' ? 'button-danger block-staff-btn' : 'button-primary unblock-staff-btn'}" data-id="${s.id}">
                        ${s.status === 'active' ? 'Block' : 'Unblock'}
                    </button>
                </div>
            </td>
        </tr>`
    ).join('');

    tbody.querySelectorAll('.block-staff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            confirmAction(
                'Block staff',
                'Are you sure you want to block this staff account?',
                () => { const s = staffList.find(x => x.id === id); if (s) s.status = 'blocked'; renderStaff(); renderHome(); }
            );
        });
    });

    tbody.querySelectorAll('.unblock-staff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const s = staffList.find(x => x.id === id);
            if (s) { s.status = 'active'; renderStaff(); renderHome(); }
        });
    });
}

/* ─── PATIENTS ─────────────────────────────────────────────── */
function renderPatients() {
    const search  = ($('patientSearch')?.value || '').toLowerCase();
    const statusF = $('patientStatusFilter')?.value || 'all';

    const filtered = patients.filter(p => {
        const name = `${p.first} ${p.last}`.toLowerCase();
        return (name.includes(search) || p.email.toLowerCase().includes(search)) &&
               (statusF === 'all' || p.status === statusF);
    });

    const tbody = $('patientTableBody');
    const empty = $('patientEmpty');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <div class="cell-name">
                    <div class="cell-avatar" style="background:${colorFor(p.id + 20)}">${initials(p)}</div>
                    ${fullName(p)}
                </div>
            </td>
            <td>${esc(p.email)}</td>
            <td>${esc(p.phone)}</td>
            <td>${esc(p.insurance)}</td>
            <td>${badge(p.status)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-sm ${p.status === 'active' ? 'button-danger block-patient-btn' : 'button-primary unblock-patient-btn'}" data-id="${p.id}">
                        ${p.status === 'active' ? 'Block' : 'Unblock'}
                    </button>
                </div>
            </td>
        </tr>`
    ).join('');

    tbody.querySelectorAll('.block-patient-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            confirmAction(
                'Block patient',
                'Are you sure you want to block this patient account?',
                () => { const p = patients.find(x => x.id === id); if (p) p.status = 'blocked'; renderPatients(); renderHome(); }
            );
        });
    });

    tbody.querySelectorAll('.unblock-patient-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            const p = patients.find(x => x.id === id);
            if (p) { p.status = 'active'; renderPatients(); renderHome(); }
        });
    });
}

/* ─── ADD DOCTOR FORM ──────────────────────────────────────── */
function initAddDoctorForm() {
    $('addDoctorForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let ok = true;

        const get = id => $(id)?.value.trim() || '';
        const fields = [
            ['docFirst', 'First name is required.'],
            ['docLast',  'Last name is required.'],
            ['docEmail', 'Email is required.'],
            ['docPhone', 'Phone is required.'],
            ['docSpeciality', 'Please select a speciality.'],
            ['docClinic', 'Clinic address is required.'],
            ['docPassword', 'Password is required.'],
        ];

        fields.forEach(([id, msg]) => {
            if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id);
        });

        const email = get('docEmail');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('docEmail', 'Enter a valid email.'); ok = false; }

        if (!ok) return;

        doctors.push({
            id: nextDoctorId++,
            first: get('docFirst'), last: get('docLast'),
            email, phone: get('docPhone'),
            speciality: get('docSpeciality'), clinic: get('docClinic'),
            status: 'active',
        });

        showStatus('addDoctorStatus', 'Doctor added successfully.', true);
        setTimeout(() => { closeModal('addDoctorModal'); renderDoctors(); renderHome(); }, 800);
    });
}

/* ─── ADD STAFF FORM ───────────────────────────────────────── */
function initAddStaffForm() {
    $('addStaffForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let ok = true;

        const get = id => $(id)?.value.trim() || '';
        const fields = [
            ['stFirst',    'First name is required.'],
            ['stLast',     'Last name is required.'],
            ['stUsername', 'Username is required.'],
            ['stEmail',    'Email is required.'],
            ['stPhone',    'Phone is required.'],
            ['stPassword', 'Password is required.'],
        ];

        fields.forEach(([id, msg]) => {
            if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id);
        });

        const email = get('stEmail');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('stEmail', 'Enter a valid email.'); ok = false; }

        if (!ok) return;

        staffList.push({
            id: nextStaffId++,
            first: get('stFirst'), last: get('stLast'),
            username: get('stUsername'), email,
            phone: get('stPhone'), status: 'active',
        });

        showStatus('addStaffStatus', 'Staff member added successfully.', true);
        setTimeout(() => { closeModal('addStaffModal'); renderStaff(); renderHome(); }, 800);
    });
}

/* ─── EDIT DOCTOR ──────────────────────────────────────────── */
function openEditDoctor(id) {
    const d = doctors.find(x => x.id === id);
    if (!d) return;

    $('editDoctorId').value         = id;
    $('editDocFirst').value         = d.first;
    $('editDocLast').value          = d.last;
    $('editDocEmail').value         = d.email;
    $('editDocPhone').value         = d.phone;
    $('editDocSpeciality').value    = d.speciality;
    $('editDocClinic').value        = d.clinic;

    openModal('editDoctorModal');
}

function initEditDoctorForm() {
    $('editDoctorForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let ok = true;

        const get  = id => $(id)?.value.trim() || '';
        const fields = [['editDocFirst','First name required.'],['editDocLast','Last name required.'],['editDocEmail','Email required.'],['editDocPhone','Phone required.']];
        fields.forEach(([id, msg]) => { if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id); });
        if (!ok) return;

        const id = Number($('editDoctorId').value);
        const d  = doctors.find(x => x.id === id);
        if (!d) return;

        d.first      = get('editDocFirst');
        d.last       = get('editDocLast');
        d.email      = get('editDocEmail');
        d.phone      = get('editDocPhone');
        d.speciality = get('editDocSpeciality');
        d.clinic     = get('editDocClinic');

        showStatus('editDoctorStatus', 'Doctor updated successfully.', true);
        setTimeout(() => { closeModal('editDoctorModal'); renderDoctors(); }, 700);
    });
}

/* ─── Modal helpers ────────────────────────────────────────── */
function openModal(id) {
    const el = $(id); if (el) el.style.display = 'block';
    const ov = $('modalOverlay'); if (ov) ov.style.display = 'block';
}

function closeModal(id) {
    const el = $(id); if (el) { el.style.display = 'none'; el.querySelector('form')?.reset(); }
    const modals = ['addDoctorModal','addStaffModal','editDoctorModal'];
    const anyOpen = modals.filter(m => m !== id).some(m => { const e = $(m); return e && e.style.display === 'block'; });
    if (!anyOpen && !$('confirmDialog').style.display.includes('block')) {
        const ov = $('modalOverlay'); if (ov) ov.style.display = 'none';
    }
}

function initModalCloseButtons() {
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    $('modalOverlay')?.addEventListener('click', () => {
        ['addDoctorModal','addStaffModal','editDoctorModal'].forEach(closeModal);
        closeConfirm();
    });
}

/* ─── Confirm dialog ───────────────────────────────────────── */
function confirmAction(title, message, onConfirm) {
    setText('confirmTitle', title);
    setText('confirmMessage', message);
    pendingConfirm = onConfirm;
    const dlg = $('confirmDialog'); if (dlg) dlg.style.display = 'block';
    const ov  = $('modalOverlay');  if (ov)  ov.style.display  = 'block';
}

function closeConfirm() {
    const dlg = $('confirmDialog'); if (dlg) dlg.style.display = 'none';
    pendingConfirm = null;
    const anyModal = ['addDoctorModal','addStaffModal','editDoctorModal']
        .some(m => { const e = $(m); return e && e.style.display === 'block'; });
    if (!anyModal) { const ov = $('modalOverlay'); if (ov) ov.style.display = 'none'; }
}

function initConfirmDialog() {
    $('confirmYesBtn')?.addEventListener('click', () => {
        if (pendingConfirm) pendingConfirm();
        closeConfirm();
    });
    $('confirmNoBtn')?.addEventListener('click', closeConfirm);
}

/* ─── Form helpers ─────────────────────────────────────────── */
function setErr(fieldId, msg) { const e = $(fieldId + 'Err'); if (e) e.textContent = msg; }
function clearErr(fieldId)    { const e = $(fieldId + 'Err'); if (e) e.textContent = ''; }

function showStatus(id, msg, success) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = `form-status ${success ? 'is-success' : 'is-error'}`;
}

/* ─── Filters ──────────────────────────────────────────────── */
function initFilters() {
    $('doctorSearch')?.addEventListener('input', renderDoctors);
    $('doctorStatusFilter')?.addEventListener('change', renderDoctors);
    $('staffSearch')?.addEventListener('input', renderStaff);
    $('staffStatusFilter')?.addEventListener('change', renderStaff);
    $('patientSearch')?.addEventListener('input', renderPatients);
    $('patientStatusFilter')?.addEventListener('change', renderPatients);
}

/* ─── Boot ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // Hide all views, show home
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const home = $('home'); if (home) home.style.display = 'block';

    // Hide modals and overlay
    ['addDoctorModal','addStaffModal','editDoctorModal','confirmDialog','modalOverlay']
        .forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });

    initDate();
    initNav();
    initFilters();
    initAddDoctorForm();
    initAddStaffForm();
    initEditDoctorForm();
    initModalCloseButtons();
    initConfirmDialog();

    renderHome();
});

/* ─── SERVICES ─────────────────────────────────────────────── */
let services = [
    { id: 'SVC-001', name: 'Blood Test' },
    { id: 'SVC-002', name: 'X-Ray' },
    { id: 'SVC-003', name: 'ECG' },
    { id: 'SVC-004', name: 'Ultrasound' },
];
let nextServiceNum = 5;

function renderServices() {
    const search   = ($('serviceSearch')?.value || '').toLowerCase();
    const filtered = services.filter(s => s.name.toLowerCase().includes(search));
    const tbody    = $('serviceTableBody');
    const empty    = $('serviceEmpty');
    if (!tbody) return;
    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>${esc(s.id)}</td>
            <td>${esc(s.name)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-danger button-sm del-service-btn" data-id="${esc(s.id)}">Delete</button>
                </div>
            </td>
        </tr>`).join('');
    tbody.querySelectorAll('.del-service-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            confirmAction('Delete service', 'Are you sure you want to delete this service?', () => {
                services = services.filter(s => s.id !== btn.dataset.id);
                renderServices();
            });
        });
    });
}

function initAddServiceForm() {
    $('addServiceForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const name = $('serviceName')?.value.trim();
        if (!name) { setErr('serviceName', 'Service name is required.'); return; }
        clearErr('serviceName');
        const id = `SVC-${String(nextServiceNum++).padStart(3, '0')}`;
        services.push({ id, name });
        showStatus('addServiceStatus', 'Service added successfully.', true);
        setTimeout(() => { closeModal('addServiceModal'); renderServices(); }, 700);
    });
}

/* ─── CERTIFICATES ─────────────────────────────────────────── */
let certificates = [
    { id: 1, title: 'Board Certification in Cardiology', doctorId: 1, organization: 'Algerian Medical Board', date: '2020-06-15', file: 'cert_cardiology.pdf' },
    { id: 2, title: 'Advanced Neurology Diploma',        doctorId: 3, organization: 'University of Algiers',  date: '2019-03-22', file: 'cert_neuro.pdf' },
];
let nextCertId = 3;

function renderCertificates() {
    const search   = ($('certSearch')?.value || '').toLowerCase();
    const filtered = certificates.filter(c => {
        const doc = doctors.find(d => d.id === c.doctorId);
        return c.title.toLowerCase().includes(search) || (doc && `${doc.first} ${doc.last}`.toLowerCase().includes(search));
    });
    const tbody = $('certTableBody');
    const empty = $('certEmpty');
    if (!tbody) return;
    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map(c => {
        const doc = doctors.find(d => d.id === c.doctorId);
        return `<tr>
            <td>${esc(c.title)}</td>
            <td>${doc ? `Dr. ${esc(doc.first)} ${esc(doc.last)}` : '—'}</td>
            <td>${esc(c.organization)}</td>
            <td>${formatDate(c.date)}</td>
            <td><span class="badge badge-active">${esc(c.file)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="button button-danger button-sm del-cert-btn" data-id="${c.id}">Delete</button>
                </div>
            </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('.del-cert-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            confirmAction('Delete certificate', 'Are you sure you want to delete this certificate?', () => {
                certificates = certificates.filter(c => c.id !== Number(btn.dataset.id));
                renderCertificates();
            });
        });
    });
}

function populateCertDoctorSelect() {
    const sel = $('certDoctor');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a doctor</option>' +
        doctors.map(d => `<option value="${d.id}">Dr. ${esc(d.first)} ${esc(d.last)} – ${esc(d.speciality)}</option>`).join('');
}

function initAddCertForm() {
    $('addCertForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let ok = true;
        const title  = $('certTitle')?.value.trim();
        const docId  = Number($('certDoctor')?.value);
        const org    = $('certOrganization')?.value.trim();
        const date   = $('certDate')?.value;
        const file   = $('certFile')?.files[0];

        if (!title)  { setErr('certTitle', 'Title is required.');        ok = false; } else clearErr('certTitle');
        if (!docId)  { setErr('certDoctor', 'Select a doctor.');         ok = false; } else clearErr('certDoctor');
        if (!org)    { setErr('certOrganization', 'Organization is required.'); ok = false; } else clearErr('certOrganization');
        if (!date)   { setErr('certDate', 'Issue date is required.');    ok = false; } else clearErr('certDate');
        if (!ok) return;

        certificates.push({ id: nextCertId++, title, doctorId: docId, organization: org, date, file: file ? file.name : 'No file' });
        showStatus('addCertStatus', 'Certificate saved successfully.', true);
        setTimeout(() => { closeModal('addCertModal'); renderCertificates(); }, 700);
    });
}

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

/* ─── Patch navigateTo to handle new views ─────────────────── */
const _origNavigateTo = navigateTo;
// Redefine navigateTo to include new views
window.navigateTo = function(page) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('is-active', l.dataset.page === page);
    });
    const view = $(page);
    if (view) view.style.display = 'block';
    if (page === 'home')         renderHome();
    if (page === 'doctors')      renderDoctors();
    if (page === 'staff')        renderStaff();
    if (page === 'patients')     renderPatients();
    if (page === 'services')     renderServices();
    if (page === 'certificates') { populateCertDoctorSelect(); renderCertificates(); }
};

/* ─── Patch handleAction for new modals ────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // Additional action handlers
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'add-service')     openModal('addServiceModal');
            if (action === 'add-certificate') { populateCertDoctorSelect(); openModal('addCertModal'); }
        });
    });

    // Additional filters
    $('serviceSearch')?.addEventListener('input', renderServices);
    $('certSearch')?.addEventListener('input', renderCertificates);

    // Additional forms
    initAddServiceForm();
    initAddCertForm();

    // Additional doctor fields in add/edit forms
    // (fields are already in HTML; admin.js will collect them on submit)
});