"use strict";

const API_URL =
    window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : "http://localhost:8080";

const pageButtons = document.querySelectorAll("[data-page-target]");
const views = document.querySelectorAll(".view");
const specialitySearch = document.getElementById("specialitySearch");
const specialityEmpty = document.getElementById("specialityEmpty");
const specialityGrid = document.getElementById("specialityGrid");
const weekdayText = document.getElementById("weekdayText");
const dateText = document.getElementById("dateText");
const editProfileBtn = document.getElementById("editProfileBtn");
const cancelProfileEditBtn = document.getElementById("cancelProfileEditBtn");
const profileForm = document.getElementById("profileForm");
const profileFormStatus = document.getElementById("profileFormStatus");
const reservationList = document.getElementById("reservationList");
const reservationEmpty = document.getElementById("reservationEmpty");
const modalOverlay = document.getElementById("modalOverlay");
const cancelDialog = document.getElementById("cancelDialog");
const cancelDoctorName = document.getElementById("cancelDoctorName");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const closeCancelDialogBtn = document.getElementById("closeCancelDialogBtn");
const filterButtons = document.querySelectorAll("[data-status-filter]");
const queueDoctorTitle = document.getElementById("queueDoctorTitle");
const queueCount = document.getElementById("queueCount");
const queueTableBody = document.getElementById("queueTableBody");
const queueEmpty = document.getElementById("queueEmpty");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const profilePhotoPreview = document.getElementById("profilePhotoPreview");
const profilePhoto = document.getElementById("profilePhoto");
const logoutBtn = document.getElementById("logoutBtn");

// ─── State ───────────────────────────────────────────────────
let reservationToCancel = null;
let selectedProfilePhoto = null;
let activeStatusFilter = "all";

// queues loaded from API: { [queueId]: { doctorLabel, entries[] } }
let queuesData = {};
let activeQueueId = null;

// image map for specialities (matched by name, case-insensitive)
const SPECIALITY_IMAGES = {
    cardiology: "images/Cardiology.png",
    neurology: "images/Neurology.png",
    dermatology: "images/Dermatology.png",
    psychiatry: "images/Psychiatry.png",
    orthopedics: "images/Orthopedics.png",
    dentistry: "images/Dentistry.png",
    gastroenterology: "images/Gastro.png",
    hematology: "images/Hematology.png",
};

function specialityImage(name) {
    const key = (name || "").toLowerCase();
    for (const [k, v] of Object.entries(SPECIALITY_IMAGES)) {
        if (key.includes(k)) return v;
    }
    return "images/Cardiology.png"; // fallback
}

// ─── Navigation ──────────────────────────────────────────────
function showPage(pageId) {
    views.forEach((view) => {
        const isTarget = view.id === pageId;
        view.classList.toggle("is-active", isTarget);
        view.hidden = !isTarget;
    });
    pageButtons.forEach((btn) => {
        const isTarget = btn.dataset.pageTarget === pageId;
        btn.classList.toggle("is-active", isTarget);
        if (isTarget) btn.setAttribute("aria-current", "page");
        else btn.removeAttribute("aria-current");
    });

    // Lazy-load data when navigating to a section
    if (pageId === "reservations") loadReservations();
    if (pageId === "queue") loadQueues();
    if (pageId === "profile") loadProfile();
}

pageButtons.forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.pageTarget));
});

// ─── Date ────────────────────────────────────────────────────
function updateCurrentDate() {
    const today = new Date();
    weekdayText.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);
    dateText.textContent = new Intl.DateTimeFormat("en-US", {
        day: "numeric", month: "long", year: "numeric"
    }).format(today);
}

// ─── Specialities (loaded from API) ──────────────────────────
function filterSpecialities() {
    const query = specialitySearch.value.trim().toLowerCase();
    const cards = specialityGrid.querySelectorAll(".speciality-card");
    let visible = 0;
    cards.forEach((card) => {
        const text = `${card.textContent} ${card.dataset.specialty || ""}`.toLowerCase();
        const show = text.includes(query);
        card.hidden = !show;
        if (show) visible++;
    });
    specialityEmpty.hidden = visible > 0;
}

specialitySearch.addEventListener("input", filterSpecialities);

async function loadSpecialities() {
    try {
        const res = await fetch(`${API_URL}/specialities`);
        if (!res.ok) return; // fall back to hardcoded HTML cards already in DOM
        const list = await res.json();
        if (!Array.isArray(list) || !list.length) return;

        // Replace hardcoded cards with API data
        specialityGrid.innerHTML = list.map((s) => {
            const imgSrc = specialityImage(s.name);
            const doctorLabel = s.doctor_count === 1
                ? "1 doctor available"
                : `${s.doctor_count} doctors available`;
            const searchKeywords = s.name.toLowerCase();
            return `
                <button type="button" class="speciality-card"
                    data-specialty="${escapeHTML(searchKeywords)}"
                    data-speciality-id="${s.id}">
                    <img src="${imgSrc}" alt="${escapeHTML(s.name)} speciality icon">
                    <span class="speciality-name">${escapeHTML(s.name)}</span>
                    <span class="speciality-description">${escapeHTML(s.desc || "")}</span>
                    <span class="availability-pill">${doctorLabel}</span>
                </button>
            `;
        }).join("");
    } catch (_) {
        // keep hardcoded HTML cards as fallback
    }
}

// ─── Session guard ───────────────────────────────────────────
async function guardSession() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        if (!res.ok) window.location.href = "Welcome.html";
    } catch (_) {
        window.location.href = "Welcome.html";
    }
}

// ─── Logout ──────────────────────────────────────────────────
if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: "POST",
                credentials: "include"
            });
        } catch (_) { }
        window.location.href = "Welcome.html";
    });
}

// ─── Profile ─────────────────────────────────────────────────
async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/patients/me`, { credentials: "include" });
        if (!res.ok) return;
        const p = await res.json();

        const firstName = p.user?.first_name || "";
        const lastName = p.user?.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim() || "Patient";

        // Sidebar + welcome
        const sidebarName = document.getElementById("sidebarUserName");
        const username = document.getElementById("username");
        const profileName = document.getElementById("profileName");
        const sidebarAvatar = document.getElementById("profilePhoto");
        const profileAvatar = document.getElementById("profilePhotoPreview");


        if (sidebarName) sidebarName.textContent = fullName;
        if (username) username.textContent = firstName || fullName;
        if (profileName) profileName.textContent = fullName;

        const avatar = p.user?.profile_photo || p.profile_photo || "/images/Cardiology.png";
        const avatarURL = avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
        if (sidebarAvatar) {
            sidebarAvatar.src = avatarURL;
        }
        if (profileAvatar) {
            profileAvatar.src = avatarURL;
        }

        // Display fields
        document.getElementById("displayEmail").textContent = p.user?.email || "—";
        document.getElementById("displayPhone").textContent = p.user?.phone_number || "—";
        document.getElementById("displayInsurance").textContent = p.insurance_number || "—";
        document.getElementById("displayAddress").textContent = p.address || "—";
        document.getElementById("displayBirthday").textContent = p.birthday
            ? new Date(`${p.birthday}T00:00:00`).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric"
            })
            : "—";

        // Pre-fill edit form
        document.getElementById("emailInput").value = p.user?.email || "";
        document.getElementById("phoneInput").value = p.user?.phone_number || "";
        document.getElementById("InsuranceInput").value = p.insurance_number || "";
        document.getElementById("addressInput").value = p.address || "";
        document.getElementById("birthdayInput").value = p.birthday || "";
    } catch (_) { }
}

// ─── Profile validation ───────────────────────────────────────
function clearFieldErrors() {
    document.querySelectorAll(".field-error").forEach((el) => { el.textContent = ""; });
}

function setFieldError(inputId, message) {
    const el = document.querySelector(`[data-error-for="${inputId}"]`);
    if (el) el.textContent = message;
}

function validateProfileForm() {
    clearFieldErrors();
    const phone = profileForm.phone.value.trim();
    const insurance = profileForm.insurance.value.trim();
    let valid = true;

    if (!phone || phone.replace(/\D/g, "").length < 8) {
        setFieldError("phoneInput", "Enter a valid phone number.");
        valid = false;
    }
    if (!insurance) {
        setFieldError("InsuranceInput", "Insurance number is required.");
        valid = false;
    }
    return valid;
}

function openProfileEditor() {
    profileForm.hidden = false;
    profileFormStatus.textContent = "";
    document.getElementById("phoneInput").focus();
}

function closeProfileEditor() {
    profileForm.hidden = true;
    profileFormStatus.textContent = "";
    clearFieldErrors();
    editProfileBtn.focus();
}

async function saveProfile(event) {
    event.preventDefault();
    if (!validateProfileForm()) {
        profileFormStatus.textContent = "Please fix the highlighted fields.";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/patients/me`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                // user-level fields (flat, as backend expects)
                phone_number: profileForm.phone.value.trim(),
                // patient-level fields
                insurance_number: profileForm.insurance.value.trim(),
                address: profileForm.address.value.trim(),
                birthday: profileForm.birthday.value,
            })
        });
        if (!res.ok) throw new Error("Update failed");

        profileFormStatus.textContent = "Profile updated.";
        await loadProfile();
        setTimeout(() => {
            profileForm.hidden = true;
            profileFormStatus.textContent = "";
        }, 900);
    } catch (_) {
        profileFormStatus.textContent = "Could not save. Please try again.";
    }
}

editProfileBtn.addEventListener("click", openProfileEditor);
cancelProfileEditBtn.addEventListener("click", closeProfileEditor);
profileForm.addEventListener("submit", saveProfile);

// ─── Profile photo upload + preview ──────────────────────────
profilePhotoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // instant preview
    const localURL = URL.createObjectURL(file);

    if (profilePhotoPreview) {
        profilePhotoPreview.src = localURL;
    }

    if (profilePhoto) {
        profilePhoto.src = localURL;
    }

    try {
        const formData = new FormData();
        formData.append("photo", file);

        const res = await fetch(`${API_URL}/patients/me/photo`, {
            method: "POST",
            credentials: "include",
            body: formData
        });

        if (!res.ok) {
            throw new Error("Upload failed");
        }

        const data = await res.json();

        // backend should return:
        // { photo_url: "/uploads/users/user123.jpg" }

        const finalURL = data.photo_url.startsWith("http")
            ? data.photo_url
            : `${API_URL}${data.photo_url}`;

        if (profilePhotoPreview) {
            profilePhotoPreview.src = finalURL;
        }

        if (profilePhoto) {
            profilePhoto.src = finalURL;
        }

    } catch (err) {
        console.error("Photo upload error:", err);
        alert("Could not upload profile photo.");
    }
});

// ─── Shared helpers ───────────────────────────────────────────
function escapeHTML(v) {
    return String(v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function statusBadgeClass(status) {
    const map = {
        Waiting: "status-waiting",
        Proccessing: "status-inProgress",
        Completed: "status-finished",
        Cancelled: "status-cancelled",
        Suspended: "status-suspended",
        Blocked: "status-blocked",
    };
    return map[status] || "status-waiting";
}

// ─── Reservations ─────────────────────────────────────────────
async function loadReservations() {
    try {
        const res = await fetch(`${API_URL}/reservations`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        // Clear existing cards (dynamic or hardcoded)
        reservationList.querySelectorAll(".reservation-card").forEach(c => c.remove());

        if (!data || !data.length) {
            reservationEmpty.hidden = false;
            return;
        }
        reservationEmpty.hidden = true;

        // Fetch queue entries for each unique queue to get position
        const uniqueQueueIds = [...new Set(data.map(r => r.queue_id))];
        const queueEntryMap = {}; // queueId -> entries[]
        await Promise.all(uniqueQueueIds.map(async (qid) => {
            try {
                const qRes = await fetch(`${API_URL}/reservations/queue/${qid}`, { credentials: "include" });
                queueEntryMap[qid] = qRes.ok ? await qRes.json() : [];
            } catch (_) {
                queueEntryMap[qid] = [];
            }
        }));

        data.forEach((r) => {
            const dueDate = r.timedue ? new Date(r.timedue) : null;
            const formattedDate = dueDate && !isNaN(dueDate)
                ? dueDate.toLocaleDateString("en-US", {
                    day: "numeric", month: "long", year: "numeric"
                })
                : "—";

            const canCancel = r.status === "Waiting";
            const doctorName = r.doctor_name || "—";
            const specialityName = r.speciality_name || `Queue #${r.queue_id}`;
            const cardLabel = doctorName !== "—" ? `Dr. ${doctorName}` : specialityName;

            // Find patient's position in the queue (1-based, only Waiting entries)
            const entries = queueEntryMap[r.queue_id] || [];
            const waitingEntries = entries.filter(e => e.status === "Waiting");
            const posIndex = waitingEntries.findIndex(e => e.id === r.id);
            const position = posIndex >= 0 ? posIndex + 1 : null;
            const positionText = position ? `#${position} in queue` : "—";

            // Use speciality image as doctor avatar
            const avatarSrc = specialityImage(specialityName);

            const card = document.createElement("article");
            card.className = "reservation-card";
            card.dataset.reservationId = r.id;
            card.dataset.doctor = cardLabel;
            card.innerHTML = `
                <header>
                    <div class="doctor-line">
                        <img src="${avatarSrc}" alt="${escapeHTML(specialityName)} icon"
                             class="doctor-avatar"
                             style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-right:12px;flex-shrink:0;">
                        <div>
                            <h3>${escapeHTML(cardLabel)}</h3>
                            <p>${escapeHTML(specialityName)}</p>
                        </div>
                    </div>
                    <span class="status-badge ${statusBadgeClass(r.status)}">
                        ${escapeHTML(r.status)}
                    </span>
                </header>
                <dl class="reservation-meta">
                    <div>
                        <dt>Queue position</dt>
                        <dd>${positionText}</dd>
                    </div>
                    <div>
                        <dt>Date</dt>
                        <dd>${formattedDate}</dd>
                    </div>
                </dl>
                <button type="button"
                    class="button button-danger cancel-reservation-btn"
                    ${canCancel ? "" : "disabled"}>
                    Cancel reservation
                </button>
            `;
            reservationList.appendChild(card);
        });

        // Attach cancel listeners
        reservationList.querySelectorAll(".cancel-reservation-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const card = e.target.closest(".reservation-card");
                openCancelDialog(card);
            });
        });

    } catch (_) { }
}

// ─── Cancel dialog ────────────────────────────────────────────
function openCancelDialog(card) {
    reservationToCancel = card;
    cancelDoctorName.textContent = card.dataset.doctor || "this reservation";
    modalOverlay.hidden = false;
    cancelDialog.hidden = false;
    confirmCancelBtn.focus();
}

function closeCancelDialog() {
    modalOverlay.hidden = true;
    cancelDialog.hidden = true;
    reservationToCancel = null;
}

async function cancelReservation() {
    if (!reservationToCancel) return;
    const id = Number(reservationToCancel.dataset.reservationId);

    try {
        const status = "Cancelled";
        const res = await fetch(`${API_URL}/reservations`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id, status })
        });
        if (!res.ok) throw new Error();

        // Update card status visually instead of removing it
        const badge = reservationToCancel.querySelector(".status-badge");
        if (badge) {
            badge.className = "status-badge status-cancelled";
            badge.textContent = "Cancelled";
        }
        const cancelBtn = reservationToCancel.querySelector(".cancel-reservation-btn");
        if (cancelBtn) cancelBtn.disabled = true;

    } catch (_) {
        alert("Could not cancel reservation. Please try again.");
    }
    closeCancelDialog();
}

confirmCancelBtn.addEventListener("click", cancelReservation);
closeCancelDialogBtn.addEventListener("click", closeCancelDialog);
modalOverlay.addEventListener("click", closeCancelDialog);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !cancelDialog.hidden) closeCancelDialog();
});

// ─── Queue ────────────────────────────────────────────────────
async function loadQueues() {
    try {
        // 1. Get only the queues this patient has reservations in
        const myResRes = await fetch(`${API_URL}/reservations`, { credentials: "include" });
        if (!myResRes.ok) return;
        const myReservations = await myResRes.json();
        if (!Array.isArray(myReservations) || !myReservations.length) {
            queueEmpty.hidden = false;
            queueCount.textContent = "0 patients";
            queueDoctorTitle.textContent = "No active queues";
            return;
        }

        // Get unique queue IDs from the patient's reservations (as strings)
        const myQueueIds = [...new Set(myReservations.map(r => String(r.queue_id)))];

        // 2. Get all queues to find doctor/speciality info for those IDs
        const allQueuesRes = await fetch(`${API_URL}/queues`, { credentials: "include" });
        if (!allQueuesRes.ok) return;
        const allQueues = await allQueuesRes.json();
        if (!Array.isArray(allQueues)) return;

        // Filter to only queues the patient is in
        const myQueues = allQueues.filter(q => myQueueIds.includes(String(q.id)));
        if (!myQueues.length) return;

        queuesData = {};

        // 3. For each of the patient's queues, fetch the full queue entries
        await Promise.all(myQueues.map(async (q) => {
            const qid = String(q.id);
            try {
                const rRes = await fetch(`${API_URL}/reservations/queue/${q.id}`, {
                    credentials: "include"
                });
                console.log(`[queue ${q.id}] status:`, rRes.status);
                const entries = rRes.ok ? await rRes.json() : [];
                console.log(`[queue ${q.id}] entries:`, entries);
                queuesData[qid] = {
                    speciality: q.speciality_name || `Queue #${q.id}`,
                    doctor: q.doctor_name ? `Dr. ${q.doctor_name}` : "",
                    label: q.doctor_name
                        ? `Dr. ${q.doctor_name}`
                        : (q.speciality_name || `Queue #${q.id}`),
                    entries: Array.isArray(entries) ? entries : []
                };
            } catch (_) {
                queuesData[qid] = { speciality: `Queue #${q.id}`, doctor: "", label: `Queue #${q.id}`, entries: [] };
            }
        }));

        // Auto-select first queue
        const firstId = myQueues[0]?.id;
        if (firstId != null) {
            activeQueueId = String(firstId);
        }

        console.log("[queue] queuesData:", queuesData);
        console.log("[queue] activeQueueId:", activeQueueId);
        console.log("[queue] lookup:", queuesData[activeQueueId]);

        renderQueueTabs();

        if (activeQueueId) {
            renderQueueTable();
        }

    } catch (err) { console.error("[queue] error:", err); }
}

function renderQueueTabs() {
    const tabList = document.querySelector(".doctor-selector");
    if (!tabList) return;

    tabList.innerHTML = Object.entries(queuesData).map(([id, q]) => `
        <button type="button" class="doctor-tab" data-doctor-id="">
            <img src="images/${escapeHTML(q.speciality).toLowerCase().replace(/\s+/g, "-")}.png" alt="${escapeHTML(q.speciality)} icon">
            <span>
                <strong>${escapeHTML(q.label)}</strong>
                <small>${escapeHTML(q.speciality)} - ${q.entries.length} patient${q.entries.length !== 1 ? "s" : ""}</small>
            </span>
        </button>
    `).join("");

    tabList.querySelectorAll(".doctor-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            activeQueueId = String(tab.dataset.queueId);
            activeStatusFilter = "all";
            filterButtons.forEach(b => b.classList.remove("is-active"));
            filterButtons.forEach(b => { if (b.dataset.statusFilter === "all") b.classList.add("is-active"); });
            renderQueueTabs();
            renderQueueTable();
        });
    });
}

function renderQueueTable() {
    if (!activeQueueId || !queuesData[activeQueueId]) return;

    const { label, speciality, entries } = queuesData[activeQueueId];

    // Map API status values to filter keys
    const statusMap = {
        Waiting: "waiting",
        Proccessing: "inProgress",
        Completed: "finished",
        Cancelled: "cancelled",
    };

    const filtered = activeStatusFilter === "all"
        ? entries
        : entries.filter(e => statusMap[e.status] === activeStatusFilter);

    queueDoctorTitle.textContent = label !== speciality
        ? `${label} — ${speciality}`
        : `${label} — queue`;
    queueCount.textContent = `${filtered.length} ${filtered.length === 1 ? "patient" : "patients"}`;
    queueEmpty.hidden = filtered.length > 0;

    // Get current patient's full name for highlighting their row
    const myNameEl = document.getElementById("sidebarUserName");
    const myName = myNameEl ? myNameEl.textContent.trim().toLowerCase() : "";

    queueTableBody.innerHTML = filtered.map((entry, index) => {
        const time = entry.timedue
            ? new Date(entry.timedue).toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit", hour12: false
            })
            : "—";
        const statusClass = statusBadgeClass(entry.status);
        const isMe = myName && (entry.patient_name || "").toLowerCase() === myName;
        return `
            <tr${isMe ? ' class="is-mine"' : ""}>
                <td>${index + 1}${isMe ? " 👤" : ""}</td>
                <td>${escapeHTML(entry.patient_name || `#${entry.id}`)}</td>
                <td>${time}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(entry.status)}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        activeStatusFilter = btn.dataset.statusFilter;
        filterButtons.forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        renderQueueTable();
    });
});


document.addEventListener("DOMContentLoaded", async () => {
    await guardSession();
    updateCurrentDate();
    await loadProfile();       // load name into header/welcome immediately
    loadSpecialities();        // replace hardcoded speciality cards with live data
    // reservations & queue load lazily on tab navigation
});