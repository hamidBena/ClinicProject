'use strict';

const API_URL = window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'http://localhost:8080';

/* ── State ─────────────────────────────────────────────────── */
let queuesData = [];
let reservationsMap = {};
let myProfile = null;
let activeQueueId = null;
let activeQueueFilter = 'all';
let cancelTargetId = null;

/* ── Helpers ───────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SPECIALITY_IMAGES = {
    cardiology: 'images/Cardiology.png',
    neurology: 'images/Neurology.png',
    dermatology: 'images/Dermatology.png',
    psychiatry: 'images/Psychiatry.png',
    orthopedics: 'images/Orthopedics.png',
    dentistry: 'images/Dentistry.png',
    gastroenterology: 'images/Gastro.png',
    hematology: 'images/Hematology.png',
};

function specialityImage(name) {
    const key = (name || '').toLowerCase();
    for (const [k, v] of Object.entries(SPECIALITY_IMAGES)) {
        if (key.includes(k)) return v;
    }
    return 'images/logo.png';
}

const STATUS_LABEL = { Waiting: 'Waiting', Proccessing: 'In progress', Completed: 'Finished', Cancelled: 'Cancelled' };
const STATUS_CLASS = { Waiting: 'status-waiting', Proccessing: 'status-inProgress', Completed: 'status-finished', Cancelled: 'status-cancelled' };

/* ── Date ──────────────────────────────────────────────────── */
function initDate() {
    const now = new Date();
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const wd = $('weekdayText'); if (wd) wd.textContent = DAYS[now.getDay()];
    const dt = $('dateText'); if (dt) dt.textContent = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/* ── Session guard + logout ────────────────────────────────── */
async function guardSession() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        if (!res.ok) window.location.href = 'Welcome.html';
    } catch (_) {
        window.location.href = 'Welcome.html';
    }
}

$('logoutBtn')?.addEventListener('click', async e => {
    e.preventDefault();
    try { await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch (_) { }
    window.location.href = 'Welcome.html';
});

/* ── Navigation ────────────────────────────────────────────── */
function navigateTo(target) {
    document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
    const view = $(target);
    if (view) view.style.display = 'block';

    document.querySelectorAll('.nav-link').forEach(l => {
        const isActive = l.dataset.pageTarget === target;
        l.classList.toggle('is-active', isActive);
        l.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    if (target === 'home') renderHome();
    if (target === 'reservations') renderReservations();
    if (target === 'queue') renderQueueDoctorTabs();
    if (target === 'doctors') renderDoctors();
    if (target === 'profile') renderProfile();
}

function initNav() {
    document.querySelectorAll('[data-page-target]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.pageTarget));
    });
}

/* ── Data fetching ─────────────────────────────────────────── */
async function fetchAllData() {
    try {
        const res = await fetch(`${API_URL}/queues`, { credentials: 'include' });
        queuesData = res.ok ? await res.json() : [];
    } catch (_) { queuesData = []; }

    reservationsMap = {};
    await Promise.all(queuesData.map(async q => {
        try {
            const res = await fetch(`${API_URL}/reservations/queue/${q.id}`, { credentials: 'include' });
            reservationsMap[q.id] = res.ok ? await res.json() : [];
        } catch (_) {
            reservationsMap[q.id] = [];
        }
    }));
}

async function fetchMyProfile() {
    try {
        const meRes = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        if (!meRes.ok) return;
        const me = await meRes.json();
        console.log('auth/me response:', me); // ← add this to see what comes back
        const role = me.role;

        if (!role) {
            console.warn('Missing role in response', me);
            return;
        }

        const endpoint = role === 'staff' ? `${API_URL}/staff/me` : `${API_URL}/doctors/me`;
        const res = await fetch(endpoint, { credentials: 'include' });

        if (!res.ok) {
            console.warn('Profile fetch failed:', await res.text());
            return;
        }

        myProfile = await res.json();
        myProfile._role = role;
    } catch (err) {
        console.warn('fetchMyProfile error:', err);
    }
}

/* ── HOME ──────────────────────────────────────────────────── */
function renderHome() {
    const allReservations = Object.values(reservationsMap).flat();
    const waiting = allReservations.filter(r => r.status === 'Waiting').length;
    const done = allReservations.filter(r => r.status === 'Completed').length;
    const activeDocs = queuesData.length;

    setText('statReservations', allReservations.length);
    setText('statWaiting', waiting);
    setText('statDone', done);
    setText('statDoctors', activeDocs);

    const list = $('homeRecentList');
    if (!list) return;

    const recent = allReservations.slice(-4).reverse();
    if (!recent.length) {
        list.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No reservations yet.</p>';
        return;
    }

    list.innerHTML = recent.map(r => {
        const queue = queuesData.find(q => q.id === r.queue_id);
        const speciality = queue?.speciality_name || '—';
        const doctor = queue?.doctor_name ? `Dr. ${esc(queue.doctor_name)}` : '—';
        const img = specialityImage(speciality);
        return `<div class="mini-res-item">
            <img src="${img}" alt="">
            <div>
                <strong>${esc(r.patient_name || '—')}</strong>
                <span>${doctor} · ${esc(speciality)}</span>
            </div>
            <span class="status-badge ${STATUS_CLASS[r.status] || ''}" style="margin-left:auto;">
                ${STATUS_LABEL[r.status] || r.status}
            </span>
        </div>`;
    }).join('');
}

/* ── RESERVATIONS ──────────────────────────────────────────── */
function renderReservations() {
    const search = ($('reservationSearch')?.value || '').toLowerCase();
    const statusF = $('reservationStatusFilter')?.value || 'all';

    const allReservations = Object.entries(reservationsMap).flatMap(([qid, entries]) =>
        entries.map(r => ({ ...r, _queue: queuesData.find(q => String(q.id) === String(qid)) }))
    );

    const filtered = allReservations.filter(r => {
        const doctor = r._queue?.doctor_name || '';
        const matchSearch = (r.patient_name || '').toLowerCase().includes(search) ||
            doctor.toLowerCase().includes(search);
        const matchStatus = statusF === 'all' || r.status === statusF;
        return matchSearch && matchStatus;
    });

    const grid = $('reservationGrid');
    const empty = $('reservationEmpty');
    if (!grid) return;

    if (!filtered.length) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = filtered.map(r => {
        const q = r._queue;
        const doctorLabel = q?.doctor_name ? `Dr. ${esc(q.doctor_name)}` : '—';
        const speciality = q?.speciality_name || '—';
        const img = specialityImage(speciality);
        const canCancel = r.status === 'Waiting';
        return `<article class="reservation-card">
            <header>
                <div class="doctor-line">
                    <img src="${img}" alt="">
                    <div>
                        <h3>${doctorLabel}</h3>
                        <p>${esc(speciality)}</p>
                    </div>
                </div>
                <span class="status-badge ${STATUS_CLASS[r.status] || ''}">${STATUS_LABEL[r.status] || r.status}</span>
            </header>
            <dl class="reservation-meta">
                <div><dt>Patient</dt><dd>${esc(r.patient_name || '—')}</dd></div>
                <div><dt>Queue</dt><dd>${esc(speciality)}</dd></div>
            </dl>
            <button type="button" class="button button-danger cancel-res-btn"
                data-res-id="${r.id}" data-queue-id="${r.queue_id}"
                ${canCancel ? '' : 'disabled'}>
                Cancel reservation
            </button>
        </article>`;
    }).join('');

    grid.querySelectorAll('.cancel-res-btn').forEach(btn => {
        btn.addEventListener('click', () =>
            openCancelDialog(Number(btn.dataset.resId), Number(btn.dataset.queueId))
        );
    });
}

/* ── QUEUE ─────────────────────────────────────────────────── */
function renderQueueDoctorTabs() {
    const list = $('doctorTabList');
    if (!list) return;

    if (!queuesData.length) {
        list.innerHTML = '<p style="color:var(--muted);padding:0.5rem;font-size:0.9rem;">No queues available.</p>';
        return;
    }

    list.innerHTML = queuesData.map(q => {
        const label = q.doctor_name ? `Dr. ${esc(q.doctor_name)}` : esc(q.speciality_name || `Queue #${q.id}`);
        const img = specialityImage(q.speciality_name);
        return `
        <button type="button" class="doctor-tab${String(activeQueueId) === String(q.id) ? ' is-active' : ''}"
            data-queue-id="${q.id}">
            <img src="${img}" alt="">
            <span>
                <strong>${label}</strong>
                <small>${esc(q.speciality_name || '')}</small>
            </span>
        </button>`;
    }).join('');

    list.querySelectorAll('.doctor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activeQueueId = Number(tab.dataset.queueId);
            activeQueueFilter = 'all';
            document.querySelectorAll('[data-status-filter]').forEach(b => b.classList.remove('is-active'));
            document.querySelector('[data-status-filter="all"]')?.classList.add('is-active');
            renderQueueDoctorTabs();
            renderQueueTable();
        });
    });

    if (activeQueueId) renderQueueTable();
}

function renderQueueTable() {
    const queue = queuesData.find(q => q.id === activeQueueId);
    if (!queue) return;

    const entries = reservationsMap[activeQueueId] || [];
    const statusMap = { Waiting: 'waiting', Proccessing: 'inProgress', Completed: 'finished', Cancelled: 'cancelled' };
    const filtered = activeQueueFilter === 'all'
        ? entries
        : entries.filter(e => statusMap[e.status] === activeQueueFilter);

    const doctorLabel = queue.doctor_name ? `Dr. ${queue.doctor_name}` : queue.speciality_name;
    setText('queueDoctorTitle', `${doctorLabel} — queue`);
    setText('queueCount', `${filtered.length} patient${filtered.length !== 1 ? 's' : ''}`);

    const inProgress = entries.find(e => e.status === 'Proccessing');
    setText('currentPatientName', inProgress ? inProgress.patient_name : 'No patient in progress');

    const tbody = $('queueTableBody');
    const empty = $('queueEmpty');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = filtered.map((r, index) => {
        const raw = r.timedue || r.timecreated;
        const time = (() => {
            if (!raw) return "—";
            const d = new Date(String(raw).replace(" ", "T"));
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            }
            if (/^\d{2}:\d{2}/.test(raw)) return String(raw).slice(0, 5);
            return "—";
        })();

        return `<tr>
            <td>${index + 1}</td>
            <td>${esc(r.patient_name || `#${r.id}`)}</td>
            <td>${time}</td>
            <td><span class="status-badge ${STATUS_CLASS[r.status] || ''}">${STATUS_LABEL[r.status] || r.status}</span></td>
            <td>${r.status === 'Waiting'
                ? `<button class="button button-sm button-primary start-btn" data-res-id="${r.id}">Start</button>`
                : r.status === 'Proccessing'
                ? `<button class="button button-sm button-secondary finish-btn" data-res-id="${r.id}">Finish</button>`
                : '—'}
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.start-btn').forEach(btn => {
        btn.addEventListener('click', () => updateReservationStatus(Number(btn.dataset.resId), 'Proccessing'));
    });
    tbody.querySelectorAll('.finish-btn').forEach(btn => {
        btn.addEventListener('click', () => updateReservationStatus(Number(btn.dataset.resId), 'Completed'));
    });
}

async function updateReservationStatus(reservationId, status) {
    try {
        const res = await fetch(`${API_URL}/reservations/staff/update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: reservationId, status })
        });
        if (!res.ok) throw new Error('Update failed');

        const qRes = await fetch(`${API_URL}/reservations/queue/${activeQueueId}`, { credentials: 'include' });
        if (qRes.ok) reservationsMap[activeQueueId] = await qRes.json();

        renderQueueTable();
        renderHome();
    } catch (err) {
        alert('Could not update reservation: ' + err.message);
    }
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

    $('nextPatientBtn')?.addEventListener('click', async () => {
        if (!activeQueueId) return;
        const entries = reservationsMap[activeQueueId] || [];

        const inProg = entries.find(e => e.status === 'Proccessing');
        if (inProg) await updateReservationStatus(inProg.id, 'Completed');

        const entries2 = reservationsMap[activeQueueId] || [];
        const next = entries2.filter(e => e.status === 'Waiting')[0];
        if (next) await updateReservationStatus(next.id, 'Proccessing');
    });
}

/* ── DOCTORS ───────────────────────────────────────────────── */
function renderDoctors() {
    const search = ($('doctorSearch')?.value || '').toLowerCase();

    const filtered = queuesData.filter(q => {
        const name = (q.doctor_name || '').toLowerCase();
        const spec = (q.speciality_name || '').toLowerCase();
        return name.includes(search) || spec.includes(search);
    });

    const grid = $('doctorGrid');
    const empty = $('doctorEmpty');
    if (!grid) return;

    if (!filtered.length) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = filtered.map(q => {
        const entries = reservationsMap[q.id] || [];
        const waiting = entries.filter(e => e.status === 'Waiting').length;
        const inProgress = entries.filter(e => e.status === 'Proccessing').length;
        const finished = entries.filter(e => e.status === 'Completed').length;
        const doctorLabel = q.doctor_name ? `Dr. ${esc(q.doctor_name)}` : '—';
        const img = specialityImage(q.speciality_name);

        return `<article class="doctor-card">
            <div class="doctor-card-top">
                <img src="${img}" alt="">
                <div>
                    <h3>${doctorLabel}</h3>
                    <p>${esc(q.speciality_name || '—')}</p>
                </div>
            </div>
            <div class="doctor-card-stats">
                <div class="doctor-stat"><strong>${waiting}</strong><span>Waiting</span></div>
                <div class="doctor-stat"><strong>${inProgress}</strong><span>In progress</span></div>
                <div class="doctor-stat"><strong>${finished}</strong><span>Done</span></div>
            </div>
            <div class="doctor-card-actions">
                <button type="button" class="button button-primary button-sm view-queue-btn"
                    data-queue-id="${q.id}" style="flex:1;">View queue</button>
            </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.view-queue-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeQueueId = Number(btn.dataset.queueId);
            navigateTo('queue');
        });
    });
}

/* ── PROFILE ───────────────────────────────────────────────── */
function renderProfile() {
    if (!myProfile) return;

    const isStaff = myProfile._role === 'staff';
    const fullName = `${myProfile.first_name || ''} ${myProfile.last_name || ''}`.trim() || '—';

    setText('profileFullName', fullName);
    setText('sidebarUserName', fullName);
    setText('infoUsername', myProfile.username || '—');
    setText('infoFirstName', myProfile.first_name || '—');
    setText('infoLastName', myProfile.last_name || '—');
    setText('infoEmail', myProfile.email || '—');
    setText('infoPhone', myProfile.phone_number || '—');
    setText('infoAddress', myProfile.address || '—');
    setText('infoGender', myProfile.gender || '—');
    setText('infoRole', myProfile._role || '—');
    setText('infoBirthDate', myProfile.birthday
        ? new Date(`${myProfile.birthday}T00:00:00`).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        })
        : '—');

    // Role-specific fields
    const doctorFields = document.getElementById('doctorProfileFields');
    const staffFields = document.getElementById('staffProfileFields');

    if (isStaff) {
        if (doctorFields) doctorFields.style.display = 'none';
        if (staffFields) staffFields.style.display = 'contents';
        setText('infoPost', myProfile.post || '—');
        setText('infoRecruitmentDate', myProfile.recruitment_date || '—');
    } else {
        if (doctorFields) doctorFields.style.display = 'contents';
        if (staffFields) staffFields.style.display = 'none';
        setText('infoWorkingDays', Array.isArray(myProfile.working_days)
            ? myProfile.working_days.join(', ') : (myProfile.working_day_description || '—'));
        setText('infoAgrementNumber', myProfile.num_agrement || '—');
    }

    // Avatar
    const avatar = myProfile.avatar_url
        ? (myProfile.avatar_url.startsWith('http') ? myProfile.avatar_url : `${API_URL}${myProfile.avatar_url}`)
        : 'images/logo.png';
    document.querySelectorAll('.profile-photo, .user-card img').forEach(img => { img.src = avatar; });

    // Pre-fill edit form
    if ($('pfUsername')) $('pfUsername').value = myProfile.username || '';
    if ($('pfFirstName')) $('pfFirstName').value = myProfile.first_name || '';
    if ($('pfLastName')) $('pfLastName').value = myProfile.last_name || '';
    if ($('pfEmail')) $('pfEmail').value = myProfile.email || '';
    if ($('pfPhone')) $('pfPhone').value = myProfile.phone_number || '';
    if ($('pfAddress')) $('pfAddress').value = myProfile.address || '';
    if ($('pfBirthDate')) $('pfBirthDate').value = myProfile.birthday?.split('T')[0] || '';

    if (isStaff) {
        if ($('pfPost')) $('pfPost').value = myProfile.post || '';
        if ($('pfRecruitmentDate')) $('pfRecruitmentDate').value = myProfile.recruitment_date?.split('T')[0] || '';
        // hide doctor-only edit fields
        document.getElementById('doctorEditFields').style.display = 'none';
        document.getElementById('staffEditFields').style.display = 'contents';
    } else {
        document.getElementById('doctorEditFields').style.display = 'contents';
        document.getElementById('staffEditFields').style.display = 'none';
        document.querySelectorAll('.working-days-grid input[type="checkbox"]').forEach(cb => {
            cb.checked = Array.isArray(myProfile.working_days) && myProfile.working_days.includes(cb.value);
        });
    }

    if ($('profilePhotoPreview')) $('profilePhotoPreview').src = avatar;
}

function initProfileForm() {
    // Image preview
    $('profilePhotoInput')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = ev => {
            $('profilePhotoPreview').src = ev.target.result;
        };

        reader.readAsDataURL(file);
    });

    $('profileForm')?.addEventListener('submit', async e => {
        e.preventDefault();

        clearErrors([
            'pfEmail',
            'pfFirstName',
            'pfLastName'
        ]);

        const email = $('pfEmail').value.trim();

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('pfEmail', 'Enter a valid email.');
            return;
        }

        try {

            // Update profile info
            const isStaff = myProfile?._role === 'staff';
            const endpoint = isStaff ? `${API_URL}/staff/me` : `${API_URL}/doctors/me`;
            const body = isStaff
                ? {
                    username: $('pfUsername').value.trim(),
                    first_name: $('pfFirstName').value.trim(),
                    last_name: $('pfLastName').value.trim(),
                    email: email,
                    phone_number: $('pfPhone').value.trim(),
                    address: $('pfAddress').value.trim(),
                    birthday: $('pfBirthDate').value,
                    post: $('pfPost')?.value.trim() || '',
                    recruitment_date: $('pfRecruitmentDate')?.value || '',
                }
                : {
                    username: $('pfUsername').value.trim(),
                    first_name: $('pfFirstName').value.trim(),
                    last_name: $('pfLastName').value.trim(),
                    email: email,
                    phone_number: $('pfPhone').value.trim(),
                    address: $('pfAddress').value.trim(),
                    birthday: $('pfBirthDate').value,
                    working_days: Array.from(
                        document.querySelectorAll('.working-days-grid input[type="checkbox"]:checked')
                    ).map(cb => cb.value),
                };

            const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || 'Profile update failed');
            }
            // Upload avatar if selected
            const avatarFile = $('profilePhotoInput')?.files?.[0];

            if (avatarFile) {
                const fd = new FormData();
                fd.append('file', avatarFile);

                const avatarRes = await fetch(`${API_URL}/profile/avatar`, {
                    method: 'POST',
                    credentials: 'include',
                    body: fd
                });

                if (!avatarRes.ok) {
                    throw new Error('Avatar upload failed');
                }
            }

            await fetchMyProfile();
            renderProfile();

            const st = $('profileStatus');

            if (st) {
                st.textContent = 'Profile updated successfully.';
                st.className = 'form-status is-success';
            }

        } catch (err) {

            if (err.message.includes('phone number')) {
                setError('pfPhone', err.message);
                return;
            }

            if (err.message.includes('email')) {
                setError('pfEmail', err.message);
                return;
            }

            if (err.message.includes('username')) {
                setError('pfUsername', err.message);
                return;
            }

            const st = $('profileStatus');

            if (st) {
                st.textContent = err.message;
                st.className = 'form-status';
            }
        }
    });

    $('cancelProfileBtn')?.addEventListener('click', () => {
        renderProfile();
        resetStatus('profileStatus');

        document.querySelector('.edit-profile-panel')?.setAttribute('hidden', true);
    });
}

/* ── OPEN EDIT PROFILE FORM ─────────────────────────────────── */
const editBtn = $('editProfileBtn');
if (editBtn) {
    editBtn.addEventListener('click', () => {
        const editForm = document.querySelector('.edit-profile-panel');
        if (editForm) {
            editForm.hidden = false;
            document.getElementById("pfFirstName").focus();
        }
    });
}

/* ── CLOSE EDIT PROFILE FORM ───────────────────────────────── */
const closeEditBtn = $('cancelProfileBtn');
if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => {
        const editForm = document.querySelector('.edit-profile-panel');
        if (editForm) {
            editForm.hidden = true;
            editBtn.focus();
        }
    });
}

/* ── ADD RESERVATION MODAL ─────────────────────────────────── */
function openAddReservationModal() {
    // Populate the queue selector
    const sel = $('resQueue');
    if (sel) {
        sel.innerHTML = '<option value="">Select a doctor / queue</option>' +
            queuesData.map(q => {
                const label = q.doctor_name
                    ? `Dr. ${esc(q.doctor_name)} — ${esc(q.speciality_name || '')}`
                    : esc(q.speciality_name || `Queue #${q.id}`);
                const full = q.queue_current_size >= q.max_size;
                return `<option value="${q.id}" ${full ? 'disabled' : ''}>${label}${full ? ' (full)' : ''}</option>`;
            }).join('');
    }

    // Clear previous input and status
    const patientInput = $('resPatientAccountId');
    if (patientInput) patientInput.value = '';
    clearErrors(['resQueue', 'resPatientAccountId']);
    resetStatus('addResStatus');

    showModal('addReservationModal');
}

function initAddReservationForm() {
    $('addReservationForm')?.addEventListener('submit', async e => {
        e.preventDefault();

        clearErrors(['resQueue', 'resPatientAccountId']);
        resetStatus('addResStatus');

        const queueId = Number($('resQueue')?.value);
        const accountId = Number($('resPatientAccountId')?.value);

        // Validate
        let hasError = false;
        if (!queueId) {
            setError('resQueue', 'Please select a queue.');
            hasError = true;
        }
        if (!accountId || accountId <= 0) {
            setError('resPatientAccountId', 'Please enter a valid patient account ID.');
            hasError = true;
        }
        if (hasError) return;

        // Disable submit while sending
        const submitBtn = $('addReservationForm').querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Booking…'; }

        try {
            const res = await fetch(`${API_URL}/reservations/staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ queue_id: queueId, account_id: accountId })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Server error (${res.status})`);
            }

            // Refresh data for the affected queue
            const qRes = await fetch(`${API_URL}/reservations/queue/${queueId}`, { credentials: 'include' });
            if (qRes.ok) reservationsMap[queueId] = await qRes.json();

            hideModal('addReservationModal');
            renderHome();
            renderReservations();

            // If the queue view is open for this queue, refresh it too
            if (activeQueueId === queueId) renderQueueTable();

        } catch (err) {
            const st = $('addResStatus');
            if (st) {
                st.textContent = `Failed to book: ${err.message}`;
                st.className = 'form-status is-error';
            }
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Book spot'; }
        }
    });
}

/* ── CANCEL DIALOG ─────────────────────────────────────────── */
function openCancelDialog(resId, queueId) {
    cancelTargetId = { resId, queueId };
    const entries = reservationsMap[queueId] || [];
    const res = entries.find(r => r.id === resId);
    setText('cancelPatientName', res?.patient_name || 'this patient');
    showModal('cancelDialog');
}

function closeCancelDialog() {
    hideModal('cancelDialog');
    cancelTargetId = null;
}

/* ── Modal helpers ─────────────────────────────────────────── */
function showModal(id) {
    const el = $(id); if (el) el.removeAttribute('hidden');
    const ov = $('modalOverlay'); if (ov) ov.removeAttribute('hidden');
}

function hideModal(id) {
    const el = $(id); if (el) el.setAttribute('hidden', '');
    const modals = ['addReservationModal', 'updateDoctorModal', 'cancelDialog'];
    const anyOpen = modals.filter(m => m !== id).some(m => {
        const e = $(m); return e && !e.hasAttribute('hidden');
    });
    if (!anyOpen) { const ov = $('modalOverlay'); if (ov) ov.setAttribute('hidden', ''); }
}

/* ── Field helpers ─────────────────────────────────────────── */
function setError(fieldId, msg) { const e = $(fieldId + 'Err'); if (e) e.textContent = msg; }
function clearErrors(ids) { ids.forEach(id => setError(id, '')); }
function resetStatus(id) { const e = $(id); if (e) { e.textContent = ''; e.className = 'form-status'; } }

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    await guardSession();

    document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
    const home = $('home'); if (home) home.style.display = 'block';


    document.querySelectorAll('[data-action="open-add-reservation"]').forEach(btn => {
        btn.addEventListener('click', openAddReservationModal);
    });
    $('openAddReservationBtn')?.addEventListener('click', openAddReservationModal);
    $('closeAddReservationBtn')?.addEventListener('click', () => hideModal('addReservationModal'));
    $('cancelAddResBtn')?.addEventListener('click', () => hideModal('addReservationModal'));
    $('closeUpdateDoctorBtn')?.addEventListener('click', () => hideModal('updateDoctorModal'));
    $('cancelUpdateDoctorBtn')?.addEventListener('click', () => hideModal('updateDoctorModal'));

    initDate();
    initNav();
    initQueueControls();
    initProfileForm();
    initAddReservationForm();

    await fetchMyProfile();
    await fetchAllData();

    renderHome();
    renderProfile();

    $('reservationSearch')?.addEventListener('input', renderReservations);
    $('reservationStatusFilter')?.addEventListener('change', renderReservations);
    $('doctorSearch')?.addEventListener('input', renderDoctors);

    // Cancel dialog
    $('confirmCancelBtn')?.addEventListener('click', async () => {
        if (!cancelTargetId) return;
        try {
            const res = await fetch(`${API_URL}/reservations/staff/update`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: cancelTargetId.resId, status: 'Cancelled' })
            });
            if (!res.ok) throw new Error('Cancel failed');

            const qRes = await fetch(`${API_URL}/reservations/queue/${cancelTargetId.queueId}`, { credentials: 'include' });
            if (qRes.ok) reservationsMap[cancelTargetId.queueId] = await qRes.json();

            closeCancelDialog();
            renderReservations();
            renderHome();
        } catch (err) {
            alert('Could not cancel: ' + err.message);
            closeCancelDialog();
        }
    });
    $('closeCancelDialogBtn')?.addEventListener('click', closeCancelDialog);
    $('modalOverlay')?.addEventListener('click', closeCancelDialog);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCancelDialog();
    });
});

initProfileForm