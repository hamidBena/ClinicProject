'use strict';

const API_URL = window.location.origin && window.location.origin !== 'null'
    ? window.location.origin : 'http://localhost:8080';

/* ── State ─────────────────────────────────────────────────── */
let doctors = [];
let staffList = [];
let patients = [];
let specialities = [];
let services = [];
let pendingConfirm = null;

/* ── Helpers ───────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);
const COLORS = ['#23957f', '#1a5fa8', '#9a6a10', '#6a3f9a', '#b64242', '#2e7d8c'];
const colorFor = id => COLORS[id % COLORS.length];
const initials = p => `${(p.first_name || '?')[0]}${(p.last_name || '?')[0]}`.toUpperCase();
const fullName = p => `${esc(p.first_name)} ${esc(p.last_name)}`;
const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };

function badge(isBlocked) {
    return isBlocked
        ? `<span class="badge badge-blocked">Blocked</span>`
        : `<span class="badge badge-active">Active</span>`;
}

function setErr(id, msg) { const e = $(id + 'Err'); if (e) e.textContent = msg; }
function clearErr(id) { const e = $(id + 'Err'); if (e) e.textContent = ''; }
function showStatus(id, msg, ok) {
    const el = $(id); if (!el) return;
    el.textContent = msg;
    el.className = `form-status ${ok ? 'is-success' : 'is-error'}`;
}

/* ── Date ──────────────────────────────────────────────────── */
function initDate() {
    const now = new Date();
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    setText('weekdayText', DAYS[now.getDay()]);
    setText('dateText', `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
}

/* ── Session guard + logout ─────────────────────────────────── */
async function guardSession() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        if (!res.ok) { window.location.href = 'Welcome.html'; return; }
        const me = await res.json();
        if (me.role !== 'admin') { window.location.href = 'Welcome.html'; return; }

        const meRes = await fetch(`${API_URL}/admin/me`, { credentials: 'include' });
        if (meRes.ok) {
            const info = await meRes.json();
            setText('sidebarAdminName', `${info.first_name} ${info.last_name}`.trim() || 'Administrator');
        }
    } catch (_) { window.location.href = 'Welcome.html'; }
}

document.getElementById('logoutBtn')?.addEventListener('click', async e => {
    e.preventDefault();
    try { await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch (_) { }
    window.location.href = 'Welcome.html';
});

/* ── Fetch all data ─────────────────────────────────────────── */
async function fetchAll() {
    const [dRes, sRes, pRes, spRes] = await Promise.all([
        fetch(`${API_URL}/admin/doctors`, { credentials: 'include' }),
        fetch(`${API_URL}/admin/staff`, { credentials: 'include' }),
        fetch(`${API_URL}/admin/patients`, { credentials: 'include' }),
        fetch(`${API_URL}/specialities`),
    ]);
    doctors = dRes.ok ? await dRes.json() : [];
    staffList = sRes.ok ? await sRes.json() : [];
    patients = pRes.ok ? await pRes.json() : [];
    specialities = spRes.ok ? await spRes.json() : [];

    try {
        const aSpRes = await fetch(`${API_URL}/admin/specialities`, { credentials: 'include' });
        if (aSpRes.ok) specialities = await aSpRes.json();
    } catch (_) { }

    // fetch services separately so it can't crash the rest
    try {
        const svRes = await fetch(`${API_URL}/admin/services`, { credentials: 'include' });
        services = svRes.ok ? await svRes.json() : [];
    } catch (_) {
        services = [];
    }
}

/* ── Navigation ─────────────────────────────────────────────── */
function navigateTo(page) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l =>
        l.classList.toggle('is-active', l.dataset.page === page));
    const view = $(page);
    if (view) view.style.display = 'block';

    if (page === 'home') renderHome();
    if (page === 'doctors') renderDoctors();
    if (page === 'staff') renderStaff();
    if (page === 'patients') renderPatients();
    if (page === 'services') renderServices();
    if (page === 'certificates') { populateCertDoctorSelect(); renderCertificates(); }
    if (page === 'specialities') renderSpecialities();
}

function initNav() {
    document.querySelectorAll('[data-page]').forEach(btn =>
        btn.addEventListener('click', () => navigateTo(btn.dataset.page)));
    document.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', () => handleAction(btn.dataset.action)));
}

function handleAction(action) {
    if (action === 'add-doctor') { populateSpecialitySelect('docSpeciality'); openModal('addDoctorModal'); }
    if (action === 'add-staff') openModal('addStaffModal');
    if (action === 'add-service') openModal('addServiceModal');
    if (action === 'add-certificate') { populateCertDoctorSelect(); openModal('addCertModal'); }
    if (action === 'add-speciality') openModal('addSpecialityModal');

}

/* ── HOME ───────────────────────────────────────────────────── */
function renderHome() {
    const blocked = [...doctors, ...staffList, ...patients].filter(x => x.is_blocked).length;
    setText('statDoctors', doctors.length);
    setText('statStaff', staffList.length);
    setText('statPatients', patients.length);
    setText('statBlocked', blocked);

    const listEl = $('recentAccountsList');
    if (!listEl) return;

    const recent = [
        ...doctors.slice(-2).map(d => ({ ...d, _type: 'Doctor', _sub: d.speciality })),
        ...staffList.slice(-2).map(s => ({ ...s, _type: 'Staff', _sub: s.username })),
        ...patients.slice(-2).map(p => ({ ...p, _type: 'Patient', _sub: p.email })),
    ].reverse().slice(0, 6);

    listEl.innerHTML = recent.map(r => `
        <div class="recent-item">
            <div class="recent-avatar" style="background:${colorFor(r.account_id)}">${initials(r)}</div>
            <div style="min-width:0;">
                <strong>${fullName(r)}</strong>
                <span>${esc(r._type)} · ${esc(r._sub || '')}</span>
            </div>
            ${r.is_blocked ? badge(true) : r._type === 'Doctor' && r.availability === 'Unavailable'
            ? `<span class="badge badge-blocked">Unavailable</span>`
            : badge(false)}
        </div>`).join('');
}

/* ── DOCTORS ─────────────────────────────────────────────────── */
function renderDoctors() {
    const search = ($('doctorSearch')?.value || '').toLowerCase();
    const statusF = $('doctorStatusFilter')?.value || 'all';

    const filtered = doctors.filter(d => {
        const name = `${d.first_name} ${d.last_name}`.toLowerCase();
        const matchSearch = name.includes(search) || (d.speciality || '').toLowerCase().includes(search);
        const matchStatus = statusF === 'all'
            || (statusF === 'blocked' && d.is_blocked)
            || (statusF === 'active' && !d.is_blocked);
        return matchSearch && matchStatus;
    });

    const tbody = $('doctorTableBody');
    const empty = $('doctorEmpty');
    if (!tbody) return;

    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td>
                <div class="cell-name">
                    <div class="cell-avatar" style="background:${colorFor(d.account_id)}">${initials(d)}</div>
                    Dr. ${fullName(d)}
                </div>
            </td>
            <td>${esc(d.speciality || '—')}</td>
            <td>${esc(d.address || '—')}</td>
            <td>${esc(d.email)}</td>
            <td>${esc(d.phone_number)}</td>
            <td>${esc(d.birthday || '—')}</td>
            <td>${d.is_blocked ? badge(true) : d.availability === 'Unavailable'
            ? `<span class="badge badge-blocked">Unavailable</span>`
            : badge(false)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-secondary button-sm view-certs-btn" data-id="${d.account_id}" data-name="Dr. ${esc(d.first_name)} ${esc(d.last_name)}">
                        Certificates
                    </button>
                    <button class="button button-secondary button-sm edit-doc-btn" data-id="${d.account_id}">Edit</button>
                    <button class="button button-sm ${d.is_blocked ? 'button-primary unblock-btn' : 'button-danger block-btn'}" data-id="${d.account_id}">
                        ${d.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                </div>
            </td>
        </tr>`).join('');

    tbody.querySelectorAll('.edit-doc-btn').forEach(btn =>
        btn.addEventListener('click', () => openEditDoctor(Number(btn.dataset.id)))
    );

    tbody.querySelectorAll('.view-certs-btn').forEach(btn =>
        btn.addEventListener('click', () => openCertificatesModal(Number(btn.dataset.id), btn.dataset.name))
    );

    tbody.querySelectorAll('.block-btn').forEach(btn =>
        btn.addEventListener('click', () => confirmAction('Block doctor', 'Block this doctor\'s account?', () => blockAccount(Number(btn.dataset.id), true, renderDoctors)))
    );

    tbody.querySelectorAll('.unblock-btn').forEach(btn =>
        btn.addEventListener('click', () => blockAccount(Number(btn.dataset.id), false, renderDoctors))
    );
}

/* ── STAFF ───────────────────────────────────────────────────── */
function renderStaff() {
    const search = ($('staffSearch')?.value || '').toLowerCase();
    const statusF = $('staffStatusFilter')?.value || 'all';

    const filtered = staffList.filter(s => {
        const name = `${s.first_name} ${s.last_name}`.toLowerCase();
        const matchSearch = name.includes(search) || s.email.toLowerCase().includes(search);
        const matchStatus = statusF === 'all'
            || (statusF === 'blocked' && s.is_blocked)
            || (statusF === 'active' && !s.is_blocked);
        return matchSearch && matchStatus;
    });

    const tbody = $('staffTableBody');
    const empty = $('staffEmpty');
    if (!tbody) return;

    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>
                <div class="cell-name">
                    <div class="cell-avatar" style="background:${colorFor(s.account_id + 10)}">${initials(s)}</div>
                    ${fullName(s)}
                </div>
            </td>
            <td>${esc(s.username)}</td>
            <td>${esc(s.email)}</td>
            <td>${esc(s.phone_number)}</td>
            <td>${badge(s.is_blocked)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-secondary button-sm edit-staff-btn" data-id="${s.account_id}">Edit</button>
                    <button class="button button-sm ${s.is_blocked ? 'button-primary unblock-staff-btn' : 'button-danger block-staff-btn'}" data-id="${s.account_id}">
                        ${s.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                </div>
            </td>
        </tr>`).join('');

    tbody.querySelectorAll('.edit-staff-btn').forEach(btn =>
        btn.addEventListener('click', () => openEditStaff(Number(btn.dataset.id)))
    );

    tbody.querySelectorAll('.block-staff-btn').forEach(btn =>
        btn.addEventListener('click', () => confirmAction('Block staff', 'Block this staff account?', () =>
            blockAccount(Number(btn.dataset.id), true, renderStaff))
        )
    );

    tbody.querySelectorAll('.unblock-staff-btn').forEach(btn =>
        btn.addEventListener('click', () =>
            blockAccount(Number(btn.dataset.id), false, renderStaff)
        )
    );
}

/* ── PATIENTS ────────────────────────────────────────────────── */
function renderPatients() {
    const search = ($('patientSearch')?.value || '').toLowerCase();
    const statusF = $('patientStatusFilter')?.value || 'all';

    const filtered = patients.filter(p => {
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const matchSearch = name.includes(search) || p.email.toLowerCase().includes(search);
        const matchStatus = statusF === 'all'
            || (statusF === 'blocked' && p.is_blocked)
            || (statusF === 'active' && !p.is_blocked);
        return matchSearch && matchStatus;
    });

    const tbody = $('patientTableBody');
    const empty = $('patientEmpty');
    if (!tbody) return;

    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <div class="cell-name">
                    <div class="cell-avatar" style="background:${colorFor(p.account_id + 20)}">${initials(p)}</div>
                    ${fullName(p)}
                </div>
            </td>
            <td>${esc(p.email)}</td>
            <td>${esc(p.phone_number)}</td>
            <td>${esc(p.insurance_number || '—')}</td>
            <td>${badge(p.is_blocked)}</td>
            <td>
                <div class="action-btns">
                    <button class="button button-sm ${p.is_blocked ? 'button-primary unblock-patient-btn' : 'button-danger block-patient-btn'}" data-id="${p.account_id}">
                        ${p.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                </div>
            </td>
        </tr>`).join('');

    tbody.querySelectorAll('.block-patient-btn').forEach(btn =>
        btn.addEventListener('click', () =>
            confirmAction('Block patient', 'Block this patient account?',
                () => blockAccount(Number(btn.dataset.id), true, renderPatients))));

    tbody.querySelectorAll('.unblock-patient-btn').forEach(btn =>
        btn.addEventListener('click', () =>
            blockAccount(Number(btn.dataset.id), false, renderPatients)));
}

/* ── Block / Unblock ────────────────────────────────────────── */
async function blockAccount(accountId, block, refreshFn) {
    const action = block ? 'block' : 'unblock';
    try {
        const res = await fetch(`${API_URL}/admin/accounts/${accountId}/${action}`, {
            method: 'PATCH', credentials: 'include'
        });
        if (!res.ok) throw new Error(await res.text());
        await fetchAll();
        refreshFn();
        renderHome();
    } catch (err) {
        alert('Failed: ' + err.message);
    }
}

/* ── ADD DOCTOR ─────────────────────────────────────────────── */
function populateSpecialitySelect(selectId) {
    const sel = $(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select speciality</option>' +
        specialities.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
}

function initAddDoctorForm() {
    $('addDoctorForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const get = id => $(id)?.value.trim() || '';
        let ok = true;

        [['docFirst', 'First name required.'], ['docLast', 'Last name required.'],
        ['docUsername', 'Username required.'],
        ['docEmail', 'Email required.'], ['docPhone', 'Phone required.'],
        ['docSpeciality', 'Select a speciality.'], ['docClinic', 'Address required.'],
        ['docPassword', 'Password required.']
        ].forEach(([id, msg]) => {
            if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id);
        });
        if (!ok) return;

        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/admin/doctors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: get('docUsername'),
                    first_name: get('docFirst'),
                    last_name: get('docLast'),
                    email: get('docEmail'),
                    phone_number: get('docPhone'),
                    gender: $('docGender')?.value || '',
                    birthday: $('docBirthday')?.value || '',
                    password: get('docPassword'),
                    address: get('docClinic'),
                    speciality_id: Number($('docSpeciality').value),
                    working_day_description: Array.from(
                        document.querySelectorAll('input[name="docWorkingDays"]:checked')
                    ).map(cb => cb.value).join(', '),
                    num_agrement: get('docNumAgrement'),
                    recruitment_date: $('docRecruitmentDate')?.value || '',
                })
            });
            if (!res.ok) throw new Error(await res.text());
            showStatus('addDoctorStatus', 'Doctor added successfully.', true);
            await fetchAll();
            setTimeout(() => { closeModal('addDoctorModal'); renderDoctors(); renderHome(); }, 800);
        } catch (err) {
            showStatus('addDoctorStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── ADD STAFF ──────────────────────────────────────────────── */
function initAddStaffForm() {
    $('addStaffForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const get = id => $(id)?.value.trim() || '';
        let ok = true;

        [['stFirst', 'First name required.'], ['stLast', 'Last name required.'],
        ['stUsername', 'Username required.'], ['stEmail', 'Email required.'],
        ['stPhone', 'Phone required.'], ['stPassword', 'Password required.']
        ].forEach(([id, msg]) => {
            if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id);
        });
        if (!ok) return;

        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/admin/staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: get('stUsername'),
                    first_name: get('stFirst'),
                    last_name: get('stLast'),
                    email: get('stEmail'),
                    phone_number: get('stPhone'),
                    gender: $('stGender')?.value || '',
                    password: get('stPassword'),
                    post: get('stPost') || '',
                    recruitment_date: $('stRecruitmentDate')?.value || '',
                })
            });
            if (!res.ok) throw new Error(await res.text());
            showStatus('addStaffStatus', 'Staff added successfully.', true);
            await fetchAll();
            setTimeout(() => { closeModal('addStaffModal'); renderStaff(); renderHome(); }, 800);
        } catch (err) {
            showStatus('addStaffStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── EDIT DOCTOR ────────────────────────────────────────────── */
function openEditDoctor(accountId) {
    const d = doctors.find(x => x.account_id === accountId);
    if (!d) return;

    populateSpecialitySelect('editDocSpeciality');
    populateServiceSelect('editDocService', d.service_id || 0);
    $('editDoctorId').value = accountId;
    $('editDocUsername').value = d.username || '';
    $('editDocFirst').value = d.first_name || '';
    $('editDocLast').value = d.last_name || '';
    $('editDocEmail').value = d.email || '';
    $('editDocPhone').value = d.phone_number || '';
    $('editDocClinic').value = d.address || '';
    $('editDocNumAgrement').value = d.num_agrement || '';
    $('editDocAvailability').value = d.availability || 'Available';

    // Set speciality
    const sel = $('editDocSpeciality');
    if (sel) {
        const sp = specialities.find(s => s.name === d.speciality);
        if (sp) sel.value = sp.id;
    }

    // Pre-check working days
    const days = (d.working_day_description || '').split(',').map(s => s.trim());
    document.querySelectorAll('input[name="editDocWorkingDays"]').forEach(cb => {
        cb.checked = days.includes(cb.value);
    });

    openModal('editDoctorModal');
}

function initEditDoctorForm() {
    $('editDoctorForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const get = id => $(id)?.value.trim() || '';
        let ok = true;

        [['editDocFirst', 'First name required.'],
        ['editDocLast', 'Last name required.'],
        ['editDocUsername', 'Username required.'],
        ['editDocEmail', 'Email required.'], ['editDocPhone', 'Phone required.']
        ].forEach(([id, msg]) => {
            if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id);
        });
        if (!ok) return;

        const accountId = Number($('editDoctorId').value);
        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/admin/doctors/${accountId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: get('editDocUsername'),
                    first_name: get('editDocFirst'),
                    last_name: get('editDocLast'),
                    email: get('editDocEmail'),
                    phone_number: get('editDocPhone'),
                    address: get('editDocClinic'),
                    speciality_id: Number($('editDocSpeciality')?.value || 0),
                    working_day_description: Array.from(
                        document.querySelectorAll('input[name="editDocWorkingDays"]:checked')
                    ).map(cb => cb.value).join(', '),
                    num_agrement: get('editDocNumAgrement'),
                    availability: $('editDocAvailability')?.value || 'Available',
                    service_id: Number($('editDocService')?.value || 0),
                })
            });
            if (!res.ok) throw new Error(await res.text());
            showStatus('editDoctorStatus', 'Doctor updated successfully.', true);
            await fetchAll();
            setTimeout(() => { closeModal('editDoctorModal'); renderDoctors(); }, 700);
        } catch (err) {
            showStatus('editDoctorStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── EDIT STAFF ─────────────────────────────────────────────── */
function openEditStaff(accountId) {
    const s = staffList.find(x => x.account_id === accountId);
    if (!s) return;

    populateServiceSelect('editStService', s.service_id || 0);
    $('editStaffId').value = accountId;
    $('editStUsername').value = s.username || '';
    $('editStFirst').value = s.first_name || '';
    $('editStLast').value = s.last_name || '';
    $('editStEmail').value = s.email || '';
    $('editStPhone').value = s.phone_number || '';
    $('editStPost').value = s.post || '';
    $('editStRecruitmentDate').value = s.recruitment_date || '';

    openModal('editStaffModal');
}

function initEditStaffForm() {
    $('editStaffForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const get = id => $(id)?.value.trim() || '';
        let ok = true;

        [['editStFirst', 'First name required.'],
        ['editStLast', 'Last name required.'],
        ['editStUsername', 'Username required.'],
        ['editStEmail', 'Email required.'],
        ].forEach(([id, msg]) => {
            if (!get(id)) { setErr(id, msg); ok = false; } else clearErr(id);
        });
        if (!ok) return;

        const accountId = Number($('editStaffId').value);
        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/admin/staff/${accountId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: get('editStUsername'),
                    first_name: get('editStFirst'),
                    last_name: get('editStLast'),
                    email: get('editStEmail'),
                    phone_number: get('editStPhone'),
                    post: get('editStPost'),
                    recruitment_date: $('editStRecruitmentDate')?.value || '',
                    service_id: Number($('editStService')?.value || 0),
                })
            });
            if (!res.ok) throw new Error(await res.text());
            showStatus('editStaffStatus', 'Staff updated successfully.', true);
            await fetchAll();
            setTimeout(() => { closeModal('editStaffModal'); renderStaff(); }, 700);
        } catch (err) {
            showStatus('editStaffStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── SERVICES ────────────────────────────────────────────────── */
function renderServices() {
    const search = ($('serviceSearch')?.value || '').toLowerCase();
    const filtered = services.filter(s => s.name_service.toLowerCase().includes(search));
    const tbody = $('serviceTableBody');
    const empty = $('serviceEmpty');
    if (!tbody) return;
    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>${esc(s.id_service)}</td>
            <td>${esc(s.name_service)}</td>
            <td><div class="action-btns">
                <button class="button button-danger button-sm del-service-btn" data-id="${s.id_service}">Delete</button>
            </div></td>
        </tr>`).join('');
    tbody.querySelectorAll('.del-service-btn').forEach(btn =>
        btn.addEventListener('click', () =>
            confirmAction('Delete service', 'Delete this service?', async () => {
                try {
                    const res = await fetch(`${API_URL}/admin/services/${btn.dataset.id}`, {
                        method: 'DELETE', credentials: 'include'
                    });
                    if (!res.ok) throw new Error(await res.text());
                    await fetchAll();
                    renderServices();
                } catch (err) { alert('Failed: ' + err.message); }
            })
        )
    );
}

function populateServiceSelect(selectId, currentServiceId) {
    const sel = $(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="0">No service</option>' +
        services.map(s => `<option value="${s.id_service}" ${s.id_service === currentServiceId ? 'selected' : ''}>${esc(s.name_service)}</option>`).join('');
}

function initAddServiceForm() {
    $('addServiceForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const name = $('serviceName')?.value.trim();
        if (!name) { setErr('serviceName', 'Service name is required.'); return; }
        clearErr('serviceName');
        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            const res = await fetch(`${API_URL}/admin/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name_service: name })
            });
            if (!res.ok) throw new Error(await res.text());
            showStatus('addServiceStatus', 'Service added.', true);
            await fetchAll();
            setTimeout(() => { closeModal('addServiceModal'); renderServices(); }, 700);
        } catch (err) {
            showStatus('addServiceStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── CERTIFICATES ────────────────────────────────────────────── */
async function fetchCertificates() {
    // Fetch certs for all doctors and flatten into one list
    const results = await Promise.all(
        doctors.map(d =>
            fetch(`${API_URL}/admin/doctors/${d.account_id}/certificates`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : [])
                .then(certs => certs.map(c => ({ ...c, doctorId: d.account_id, doctorName: `Dr. ${d.first_name} ${d.last_name}` })))
        )
    );
    return results.flat();
}

async function renderCertificates() {
    const tbody = $('certTableBody');
    const empty = $('certEmpty');
    if (!tbody) return;

    const search = ($('certSearch')?.value || '').toLowerCase();
    const allCerts = await fetchCertificates();

    const filtered = allCerts.filter(c =>
        c.title.toLowerCase().includes(search) ||
        c.doctorName.toLowerCase().includes(search)
    );

    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(c => `
        <tr>
            <td>${esc(c.title)}</td>
            <td>${esc(c.doctorName)}</td>
            <td>${esc(c.organization)}</td>
            <td>${esc(c.date)}</td>
            <td>${c.file_url
            ? `<a href="${API_URL}${esc(c.file_url)}" target="_blank" class="button button-secondary button-sm">View file</a>`
            : '<span style="color:var(--muted);font-size:.85rem">No file</span>'
        }</td>
            <td><div class="action-btns">
                <button class="button button-danger button-sm del-cert-btn" data-id="${c.id}">Delete</button>
            </div></td>
        </tr>`).join('');

    tbody.querySelectorAll('.del-cert-btn').forEach(btn =>
        btn.addEventListener('click', () =>
            confirmAction('Delete certificate', 'Delete this certificate?', async () => {
                try {
                    const res = await fetch(`${API_URL}/admin/certificates/${btn.dataset.id}`, {
                        method: 'DELETE', credentials: 'include'
                    });
                    if (!res.ok) throw new Error(await res.text());
                    renderCertificates();
                } catch (err) {
                    alert('Failed: ' + err.message);
                }
            })
        )
    );
}

function populateCertDoctorSelect() {
    const sel = $('certDoctor');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select a doctor</option>' +
        doctors.map(d => `<option value="${d.account_id}">Dr. ${esc(d.first_name)} ${esc(d.last_name)} – ${esc(d.speciality || '')}</option>`).join('');
}

function initAddCertForm() {
    $('addCertForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        let ok = true;

        const title = $('certTitle')?.value.trim();
        const docId = $('certDoctor')?.value;
        const org = $('certOrganization')?.value.trim();
        const date = $('certDate')?.value;
        const file = $('certFile')?.files[0];

        if (!title) { setErr('certTitle', 'Title required.'); ok = false; } else clearErr('certTitle');
        if (!docId) { setErr('certDoctor', 'Select a doctor.'); ok = false; } else clearErr('certDoctor');
        if (!org) { setErr('certOrganization', 'Org required.'); ok = false; } else clearErr('certOrganization');
        if (!date) { setErr('certDate', 'Date required.'); ok = false; } else clearErr('certDate');
        if (!ok) return;

        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('doctor_id', docId);
            formData.append('organization', org);
            formData.append('date', date);
            if (file) formData.append('file', file);

            const res = await fetch(`${API_URL}/admin/certificates`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            if (!res.ok) throw new Error(await res.text());

            showStatus('addCertStatus', 'Certificate saved successfully.', true);
            setTimeout(() => {
                closeModal('addCertModal');
                $('addCertForm').reset();
                renderCertificates();
            }, 700);
        } catch (err) {
            showStatus('addCertStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── Specialities ────────────────────────────────────────────── */
function renderSpecialities() {
    const search = ($('specialitySearch')?.value || '').toLowerCase();
    const filtered = specialities.filter(s => s.name.toLowerCase().includes(search));
    const tbody = $('specialityTableBody');
    const empty = $('specialityEmpty');
    if (!tbody) return;
    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>${esc(s.name)}</td>
            <td>${esc(s.desc || '—')}</td>
            <td>${s.doctor_count ?? 0}</td>
            <td><div class="action-btns">
                <button class="button button-danger button-sm del-speciality-btn"
                    data-id="${s.id}" data-count="${s.doctor_count ?? 0}">Delete</button>
            </div></td>
        </tr>`).join('');
    tbody.querySelectorAll('.del-speciality-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            if (Number(btn.dataset.count) > 0) {
                alert('Cannot delete a speciality that has assigned doctors.');
                return;
            }
            confirmAction('Delete speciality', 'Delete this speciality? This cannot be undone.', async () => {
                try {
                    const res = await fetch(`${API_URL}/admin/specialities/${btn.dataset.id}`, {
                        method: 'DELETE', credentials: 'include'
                    });
                    if (!res.ok) throw new Error(await res.text());
                    await fetchAll();
                    renderSpecialities();
                } catch (err) { alert('Failed: ' + err.message); }
            });
        })
    );
}

function initAddSpecialityForm() {
    $('addSpecialityForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const name = $('specialityName')?.value.trim();
        if (!name) { setErr('specialityName', 'Speciality name is required.'); return; }
        clearErr('specialityName');
        const submitBtn = e.target.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            const res = await fetch(`${API_URL}/admin/specialities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, desc: $('specialityDesc')?.value.trim() || '' })
            });
            if (!res.ok) throw new Error(await res.text());
            showStatus('addSpecialityStatus', 'Speciality added.', true);
            await fetchAll();
            setTimeout(() => { closeModal('addSpecialityModal'); renderSpecialities(); }, 700);
        } catch (err) {
            showStatus('addSpecialityStatus', err.message, false);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/* ── Modal helpers ───────────────────────────────────────────── */
function openModal(id) {
    const el = $(id);
    if (el) el.style.display = 'block';
    const ov = $('modalOverlay');
    if (ov) ov.style.display = 'block';
}

function closeModal(id) {
    const el = $(id);
    if (el) { el.style.display = 'none'; el.querySelector('form')?.reset(); }
    const modals = ['addDoctorModal', 'addStaffModal', 'editDoctorModal', 'addServiceModal', 'addCertModal', 'editStaffModal', 'addSpecialityModal'];
    const anyOpen = modals.filter(m => m !== id).some(m => {
        const e = $(m); return e && e.style.display === 'block';
    });
    if (!anyOpen && $('confirmDialog')?.style.display !== 'block') {
        const ov = $('modalOverlay'); if (ov) ov.style.display = 'none';
    }
}

function initModalCloseButtons() {
    document.querySelectorAll('[data-close]').forEach(btn =>
        btn.addEventListener('click', () => closeModal(btn.dataset.close)));
    $('modalOverlay')?.addEventListener('click', () => {
        ['addDoctorModal', 'addStaffModal', 'editDoctorModal', 'addServiceModal', 'addCertModal', 'doctorCertsModal', 'addSpecialityModal']
            .forEach(closeModal);
        closeConfirm();
    });
}

/* ── Confirm dialog ──────────────────────────────────────────── */
function confirmAction(title, message, onConfirm) {
    setText('confirmTitle', title);
    setText('confirmMessage', message);
    pendingConfirm = onConfirm;
    const dlg = $('confirmDialog'); if (dlg) dlg.style.display = 'block';
    const ov = $('modalOverlay'); if (ov) ov.style.display = 'block';
}

function closeConfirm() {
    const dlg = $('confirmDialog'); if (dlg) dlg.style.display = 'none';
    pendingConfirm = null;
    const anyModal = ['addDoctorModal', 'addStaffModal', 'editDoctorModal', 'addServiceModal', 'addCertModal', 'doctorCertsModal', 'editStaffModal', 'addSpecialityModal']
        .some(m => { const e = $(m); return e && e.style.display === 'block'; });
    if (!anyModal) { const ov = $('modalOverlay'); if (ov) ov.style.display = 'none'; }
}

function initConfirmDialog() {
    $('confirmYesBtn')?.addEventListener('click', () => { if (pendingConfirm) pendingConfirm(); closeConfirm(); });
    $('confirmNoBtn')?.addEventListener('click', closeConfirm);
}

async function openCertificatesModal(accountId, doctorName) {
    setText('certModalDoctorName', doctorName);
    $('certModalBody').innerHTML = '<p style="color:var(--muted)">Loading...</p>';
    openModal('doctorCertsModal');

    try {
        const res = await fetch(`${API_URL}/admin/doctors/${accountId}/certificates`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to load certificates');
        const certs = await res.json();

        if (!certs.length) {
            $('certModalBody').innerHTML = '<p style="color:var(--muted)">No certificates found.</p>';
            return;
        }

        $('certModalBody').innerHTML = certs.map(c => `
            <div class="cert-item">
                <div class="cert-info">
                    <strong>${esc(c.title)}</strong>
                    <span>${esc(c.organization)}</span>
                    <small>${esc(c.date)}</small>
                </div>
                ${c.file_url
                ? `<a href="${API_URL}${esc(c.file_url)}" target="_blank" class="button button-secondary button-sm">View file</a>`
                : '<span style="color:var(--muted);font-size:.85rem">No file</span>'
            }
            </div>
        `).join('');
    } catch (err) {
        $('certModalBody').innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`;
    }
}

/* ── Filters ─────────────────────────────────────────────────── */
function initFilters() {
    $('doctorSearch')?.addEventListener('input', renderDoctors);
    $('doctorStatusFilter')?.addEventListener('change', renderDoctors);
    $('staffSearch')?.addEventListener('input', renderStaff);
    $('staffStatusFilter')?.addEventListener('change', renderStaff);
    $('patientSearch')?.addEventListener('input', renderPatients);
    $('patientStatusFilter')?.addEventListener('change', renderPatients);
    $('serviceSearch')?.addEventListener('input', renderServices);
    $('certSearch')?.addEventListener('input', renderCertificates);
    $('specialitySearch')?.addEventListener('input', renderSpecialities);
}

/* ── Boot ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    await guardSession();

    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    $('home').style.display = 'block';

    initDate();
    initNav();
    initFilters();
    initAddDoctorForm();
    initAddStaffForm();
    initEditDoctorForm();
    initEditStaffForm();
    initAddServiceForm();
    initAddCertForm();
    initAddSpecialityForm();
    initModalCloseButtons();
    initConfirmDialog();

    await fetchAll();
    renderHome();
    handleAction
});