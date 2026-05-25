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
const sidebarAvatar = document.getElementById("sidebarAvatar");
const profilePhoto = document.getElementById("profilePhoto");
const logoutBtn = document.getElementById("logoutBtn");

// ─── Doctor modal elements ────────────────────────────────────
const doctorModalOverlay = document.getElementById("doctorModalOverlay");
const doctorModal = document.getElementById("doctorModal");
const doctorModalTitle = document.getElementById("doctorModalTitle");
const doctorList = document.getElementById("doctorList");
const doctorModalEmpty = document.getElementById("doctorModalEmpty");
const doctorModalStatus = document.getElementById("doctorModalStatus");
const closeDoctorModalBtn = document.getElementById("closeDoctorModalBtn");

// ─── State ───────────────────────────────────────────────────
let reservationToCancel = null;
let activeStatusFilter = "all";
let queuesData = {};
let activeQueueId = null;

// ─── Speciality image map ─────────────────────────────────────
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
    return "images/Cardiology.png";
}

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

    if (pageId === "reservations") loadReservations();
    if (pageId === "queue") loadQueues();
    if (pageId === "profile") loadProfile();
    if (pageId === "notifications") loadNotifications();
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

// ─── Specialities ─────────────────────────────────────────────
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

function attachSpecialityClickHandlers() {
    specialityGrid.querySelectorAll(".speciality-card[data-speciality-id]").forEach(card => {
        card.addEventListener("click", () => {
            const id = card.dataset.specialityId;
            const name = card.querySelector(".speciality-name")?.textContent || "";
            openDoctorModal(id, name);
        });
    });
}

async function loadSpecialities() {
    try {
        const res = await fetch(`${API_URL}/specialities`);
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list) || !list.length) return;

        specialityGrid.innerHTML = list.map((s) => {
            const imgSrc = specialityImage(s.name);
            const doctorLabel = s.doctor_count === 1
                ? "1 doctor available"
                : `${s.doctor_count} doctors available`;
            return `
                <button type="button" class="speciality-card"
                    data-specialty="${escapeHTML(s.name.toLowerCase())}"
                    data-speciality-id="${s.id ?? s.id_speciality}">
                    <img src="${imgSrc}" alt="${escapeHTML(s.name)} speciality icon">
                    <span class="speciality-name">${escapeHTML(s.name)}</span>
                    <span class="speciality-description">${escapeHTML(s.desc || "")}</span>
                    <span class="availability-pill">${doctorLabel}</span>
                </button>
            `;
        }).join("");

        // Attach click handlers after cards are rendered
        attachSpecialityClickHandlers();
    } catch (_) { }
}

// ─── Doctor modal ─────────────────────────────────────────────
function openDoctorModal(specialityId, specialityName) {
    doctorModalTitle.textContent = `Available doctors — ${specialityName}`;
    doctorModalStatus.textContent = "";
    doctorModalEmpty.hidden = true;
    doctorList.innerHTML = "<p style='padding:1rem;opacity:.6'>Loading doctors...</p>";
    doctorModalOverlay.hidden = false;
    doctorModal.hidden = false;

    fetch(`${API_URL}/doctors?speciality_id=${specialityId}`, { credentials: "include" })
        .then(r => r.json())
        .then(doctors => {
            if (!doctors.length) {
                doctorList.innerHTML = "";
                doctorModalEmpty.hidden = false;
                return;
            }

            doctorList.innerHTML = doctors.map(d => {
                const doctorLabel = `Dr. ${escapeHTML(d.first_name)} ${escapeHTML(d.last_name)}`;
                const isUnavailable = d.availability === "Unavailable";
                return `
                    <article class="doctor-card">
                        <img src="${specialityImage(specialityName)}"
                             alt="${escapeHTML(specialityName)} icon">
                        <div class="doctor-card-info">
                            <strong>${doctorLabel}</strong>
                            <span>${escapeHTML(d.speciality)}</span>
                            <small>${escapeHTML(d.working_day_description || "—")}</small>
                        </div>
                        <button type="button" class="button ${isUnavailable ? 'btn-unavailable' : 'button-primary'} book-btn"
                            data-account-id="${d.account_id}"
                            data-doctor-name="${doctorLabel}"
                            ${isUnavailable ? "disabled" : ""}>
                            ${isUnavailable ? "Unavailable" : "Book"}
                        </button>
                    </article>
                `;
            }).join("");

            doctorList.querySelectorAll(".book-btn").forEach(btn => {
                btn.addEventListener("click", () => bookReservation(btn.dataset.accountId, btn.dataset.doctorName, btn));
            });
        })
        .catch(() => {
            doctorList.innerHTML = "";
            doctorModalStatus.textContent = "Could not load doctors. Please try again.";
        });
}

async function bookReservation(accountId, doctorName, btn) {
    btn.disabled = true;
    btn.textContent = "Booking...";
    doctorModalStatus.textContent = "";

    try {
        const qRes = await fetch(`${API_URL}/queues`, { credentials: "include" });
        const queues = await qRes.json();

        const queue = queues.find(q =>
            doctorName.toLowerCase().includes(q.doctor_name.toLowerCase()) ||
            q.doctor_name.toLowerCase().includes(doctorName.toLowerCase())
        );

        if (!queue) {
            throw new Error("No active queue for this doctor today. Please try again later.");
        }
        if (queue.queue_current_size >= queue.max_size) {
            throw new Error("This queue is full.");
        }

        const res = await fetch(`${API_URL}/reservations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ queue_id: Number(queue.id) })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Booking failed.");
        }

        btn.textContent = "Booked ✓";
        doctorModalStatus.textContent = "Reservation added! Check your Reservations tab.";
    } catch (err) {
        doctorModalStatus.textContent = err.message || "Could not book. Please try again.";
        btn.disabled = false;
        btn.textContent = "Book";
    }
}

function closeDoctorModal() {
    doctorModalOverlay.hidden = true;
    doctorModal.hidden = true;
}

closeDoctorModalBtn.addEventListener("click", closeDoctorModal);
doctorModalOverlay.addEventListener("click", closeDoctorModal);

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
            await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
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

        const firstNameInput = document.getElementById("firstNameInput");
        const lastNameInput = document.getElementById("lastNameInput");
        const firstName = p.user?.first_name || "";
        const lastName = p.user?.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim() || "Patient";
        const sidebarName = document.getElementById("sidebarUserName");
        const username = document.getElementById("username");
        const profileName = document.getElementById("profileName");

        document.getElementById("displayFirstName") &&
            (document.getElementById("displayFirstName").textContent = p.user?.first_name || "—");
        document.getElementById("displayLastName") &&
            (document.getElementById("displayLastName").textContent = p.user?.last_name || "—");

        if (firstNameInput) firstNameInput.value = p.user?.first_name || "";
        if (lastNameInput) lastNameInput.value = p.user?.last_name || "";
        if (sidebarName) sidebarName.textContent = fullName;
        if (username) username.textContent = firstName || fullName;
        if (profileName) profileName.textContent = fullName;

        const avatarPath = p.user?.avatar_url || "";
        if (avatarPath) {
            const avatarURL = avatarPath.startsWith("http") ? avatarPath : `${API_URL}${avatarPath}`;
            if (sidebarAvatar) sidebarAvatar.src = avatarURL;
            if (profilePhoto) profilePhoto.src = avatarURL;
        }

        document.getElementById("displayEmail").textContent = p.user?.email || "—";
        document.getElementById("displayPhone").textContent = p.user?.phone_number || "—";
        document.getElementById("displayInsurance").textContent = p.insurance_number || "—";
        document.getElementById("displayAddress").textContent = p.user?.address || "—";
        document.getElementById("displayGender").textContent = p.user?.gender || "—";
        document.getElementById("displayBirthday").textContent = p.user?.birthday
            ? new Date(`${p.user.birthday}T00:00:00`).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric"
            })
            : "—";

        const medicalFileDD = document.getElementById("displayMedicalFile");
        if (medicalFileDD) {
            medicalFileDD.innerHTML = p.medical_file_url
                ? `<a href="${API_URL}/patients/medical-file" target="_blank"
              style="display:inline-flex;align-items:center;gap:6px;padding:0.32rem 0.75rem;border-radius:999px;background:#e1f5ee;color:#0f6e56;font-size:0.78rem;font-weight:700;text-decoration:none;border:1px solid #5dcaa5;">
              <i class="ti ti-file-text" style="font-size:14px;" aria-hidden="true"></i>
              View file
              <i class="ti ti-external-link" style="font-size:13px;opacity:0.7;" aria-hidden="true"></i>
           </a>`
                : `<span class="chip chip-warning">Not Found</span>`;
        }

        const cd = document.getElementById("displayChronicDiseases");
        if (cd) {
            const diseases = p.chronic_diseases;
            cd.textContent = diseases && diseases.trim() ? diseases : "None reported";
            cd.className = diseases && diseases.trim() ? "chip chip-warning" : "chip";
        }

        const chronicInput = document.getElementById("chronicDiseasesInput");
        if (chronicInput) chronicInput.value = p.chronic_diseases || "";

        document.getElementById("emailInput").value = p.user?.email || "";
        document.getElementById("phoneInput").value = p.user?.phone_number || "";
        document.getElementById("InsuranceInput").value = p.insurance_number || "";
        document.getElementById("addressInput").value = p.user?.address || "";
        document.getElementById("birthdayInput").value = p.user?.birthday || "";
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
    loadProfile();
    if (profilePhotoPreview && profilePhoto) {
        profilePhotoPreview.src = profilePhoto.src;
    }
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
                first_name: document.getElementById("firstNameInput")?.value.trim() || "",
                last_name: document.getElementById("lastNameInput")?.value.trim() || "",
                email: document.getElementById("emailInput")?.value.trim() || "",
                phone_number: document.getElementById("phoneInput")?.value.trim() || "",
                address: document.getElementById("addressInput")?.value.trim() || "",
                birthday: document.getElementById("birthdayInput")?.value || "",
                insurance_number: document.getElementById("InsuranceInput")?.value.trim() || "",
                chronic_diseases: document.getElementById("chronicDiseasesInput")?.value.trim() || "",
            })
        });


        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Update failed.");
        }


        const avatarFile = profilePhotoInput?.files[0];
        if (avatarFile) {
            const formData = new FormData();
            formData.append("file", avatarFile);
            const aRes = await fetch(`${API_URL}/profile/avatar`, {
                method: "POST",
                credentials: "include",
                body: formData
            });
            if (!aRes.ok) throw new Error("Profile photo upload failed.");
            const aData = await aRes.json();
            const finalURL = aData.avatar_url?.startsWith("http")
                ? aData.avatar_url
                : `${API_URL}${aData.avatar_url}`;
            if (profilePhoto) profilePhoto.src = finalURL;
            if (sidebarAvatar) sidebarAvatar.src = finalURL;
            if (profilePhotoPreview) profilePhotoPreview.src = finalURL;
        }


        const medicalFile = document.getElementById("medicalFileInput")?.files[0];
        if (medicalFile) {
            const formData = new FormData();
            formData.append("file", medicalFile);
            const mRes = await fetch(`${API_URL}/patients/medical-file`, {
                method: "POST",
                credentials: "include",
                body: formData
            });
            if (!mRes.ok) {
                const errText = await mRes.text();
                console.error("Upload error:", errText);
                throw new Error("Medical file upload failed: " + errText);
            }
            const mData = await mRes.json();
            console.log("Medical file result:", mData);
        }


        profileFormStatus.textContent = "Profile updated.";
        await loadProfile();
        setTimeout(() => {
            profileForm.hidden = true;
            profileFormStatus.textContent = "";
        }, 900);

    } catch (err) {
        profileFormStatus.textContent = err.message || "Could not save. Please try again.";
    }
}

editProfileBtn.addEventListener("click", openProfileEditor);
cancelProfileEditBtn.addEventListener("click", closeProfileEditor);
profileForm.addEventListener("submit", saveProfile);

// ─── Profile photo upload ─────────────────────────────────────
profilePhotoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const localURL = URL.createObjectURL(file);
    if (profilePhotoPreview) profilePhotoPreview.src = localURL;
    // profilePhoto and sidebarAvatar stay unchanged until Save is clicked
});

// ─── Reservations ─────────────────────────────────────────────
async function loadReservations() {
    reservationList.querySelectorAll(".reservation-card").forEach(c => c.remove());
    reservationEmpty.hidden = true;

    try {
        const res = await fetch(`${API_URL}/reservations`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        if (!data || !data.length) {
            reservationEmpty.hidden = false;
            return;
        }

        const uniqueQueueIds = [...new Set(data.map(r => r.queue_id))];
        const queueEntryMap = {};
        await Promise.all(uniqueQueueIds.map(async (qid) => {
            try {
                const qRes = await fetch(`${API_URL}/reservations/queue/${qid}`, { credentials: "include" });
                queueEntryMap[qid] = qRes.ok ? await qRes.json() : [];
            } catch (_) {
                queueEntryMap[qid] = [];
            }
        }));

        data.forEach((r) => {
            const rawDate = r.timecreated || r.timedue;
            const dueDate = rawDate ? new Date(String(rawDate).replace(" ", "T")) : null;
            const formattedDate = dueDate && !isNaN(dueDate)
                ? dueDate.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
                : "—";

            const canCancel = r.status === "Waiting";
            const doctorName = r.doctor_name || "—";
            const specialityName = r.speciality_name || `Queue #${r.queue_id}`;
            const cardLabel = doctorName !== "—" ? `Dr. ${doctorName}` : specialityName;

            const entries = queueEntryMap[r.queue_id] || [];
            const waitingEntries = entries.filter(e => e.status === "Waiting");
            const posIndex = waitingEntries.findIndex(e => e.id === r.id);
            const position = posIndex >= 0 ? posIndex + 1 : null;
            let positionText;
            if (r.status === "Proccessing") {
                positionText = `<span class="status-badge status-inProgress">⏳ In progress</span>`;
            } else if (r.status === "Completed") {
                positionText = `<span class="status-badge status-finished">✓ Done</span>`;
            } else if (r.status === "Cancelled") {
                positionText = `<span class="status-badge status-cancelled">✕ Cancelled</span>`;
            } else {
                positionText = position ? `#${position} in queue` : "—";
            }
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
                    <div><dt>Queue position</dt><dd>${positionText}</dd></div>
                    <div><dt>Booked on</dt><dd>${formattedDate}</dd></div>
                </dl>
                <button type="button" class="button button-danger cancel-reservation-btn"
                    ${canCancel ? "" : "disabled"}>
                    Cancel reservation
                </button>
            `;
            reservationList.appendChild(card);
        });

        reservationList.querySelectorAll(".cancel-reservation-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                openCancelDialog(e.target.closest(".reservation-card"));
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
        const res = await fetch(`${API_URL}/reservations`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id, status: "Cancelled" })
        });
        if (!res.ok) throw new Error();

        const badge = reservationToCancel.querySelector(".status-badge");
        if (badge) { badge.className = "status-badge status-cancelled"; badge.textContent = "Cancelled"; }
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
    if (e.key === "Escape") {
        if (!cancelDialog.hidden) closeCancelDialog();
        if (!doctorModal.hidden) closeDoctorModal();
    }
});

// ─── Queue ────────────────────────────────────────────────────
async function loadQueues() {
    try {
        const myResRes = await fetch(`${API_URL}/reservations`, { credentials: "include" });
        if (!myResRes.ok) return;
        const myReservations = await myResRes.json();
        if (!Array.isArray(myReservations) || !myReservations.length) {
            queueEmpty.hidden = false;
            queueCount.textContent = "0 patients";
            queueDoctorTitle.textContent = "No active queues";
            return;
        }

        const myQueueIds = [...new Set(myReservations.map(r => String(r.queue_id)))];

        const allQueuesRes = await fetch(`${API_URL}/queues`, { credentials: "include" });
        if (!allQueuesRes.ok) return;
        const allQueues = await allQueuesRes.json();
        if (!Array.isArray(allQueues)) return;

        const myQueues = allQueues.filter(q => myQueueIds.includes(String(q.id)));
        if (!myQueues.length) return;

        queuesData = {};
        await Promise.all(myQueues.map(async (q) => {
            const qid = String(q.id);
            try {
                const rRes = await fetch(`${API_URL}/reservations/queue/${q.id}`, { credentials: "include" });
                const entries = rRes.ok ? await rRes.json() : [];
                queuesData[qid] = {
                    speciality: q.speciality_name || `Queue #${q.id}`,
                    label: q.doctor_name ? `Dr. ${q.doctor_name}` : (q.speciality_name || `Queue #${q.id}`),
                    entries: Array.isArray(entries) ? entries : []
                };
            } catch (_) {
                queuesData[qid] = { speciality: `Queue #${q.id}`, label: `Queue #${q.id}`, entries: [] };
            }
        }));

        const firstId = myQueues[0]?.id;
        if (firstId != null) activeQueueId = String(firstId);

        renderQueueTabs();
        if (activeQueueId) renderQueueTable();

    } catch (err) { console.error("[queue] error:", err); }
}

function renderQueueTabs() {
    const tabList = document.querySelector(".doctor-selector");
    if (!tabList) return;

    tabList.innerHTML = Object.entries(queuesData).map(([id, q]) => `
        <button type="button" class="doctor-tab${id === activeQueueId ? " is-active" : ""}" data-queue-id="${id}">
            <img src="${specialityImage(q.speciality)}" alt="${escapeHTML(q.speciality)} icon">
            <span>
                <strong>${escapeHTML(q.label)}</strong>
                <small>${escapeHTML(q.speciality)} — ${q.entries.length} patient${q.entries.length !== 1 ? "s" : ""}</small>
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
    const statusMap = {
        Waiting: "waiting", Proccessing: "inProgress",
        Completed: "finished", Cancelled: "cancelled",
    };

    const filtered = activeStatusFilter === "all"
        ? entries
        : entries.filter(e => statusMap[e.status] === activeStatusFilter);

    queueDoctorTitle.textContent = label !== speciality ? `${label} — ${speciality}` : `${label} — queue`;
    queueCount.textContent = `${filtered.length} ${filtered.length === 1 ? "patient" : "patients"}`;
    queueEmpty.hidden = filtered.length > 0;

    const myName = (document.getElementById("sidebarUserName")?.textContent || "").trim().toLowerCase();

    queueTableBody.innerHTML = filtered.map((entry, index) => {
        const time = (() => {
            const raw = entry.timedue || entry.timecreated;
            if (!raw) return "—";
            const d = new Date(String(raw).replace(" ", "T"));
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            }
            if (/^\d{2}:\d{2}/.test(raw)) return String(raw).slice(0, 5);
            return "—";
        })();
        const isMe = myName && (entry.patient_name || "").toLowerCase() === myName;
        return `
            <tr${isMe ? ' class="is-mine"' : ""}>
                <td>${index + 1}${isMe ? " 👤" : ""}</td>
                <td>${escapeHTML(entry.patient_name || `#${entry.id}`)}</td>
                <td>${time}</td>
                <td><span class="status-badge ${statusBadgeClass(entry.status)}">${escapeHTML(entry.status)}</span></td>
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

// ── Notifications ─────────────────────────────────────────────
async function loadNotifications() {
    const list = document.querySelector(".notification-list");
    if (!list) return;

    list.innerHTML = "<p class='empty-state'>Loading...</p>";

    try {
        const res = await fetch(`${API_URL}/notifications`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load notifications.");
        const data = await res.json();

        if (!Array.isArray(data) || !data.length) {
            list.innerHTML = "<p class='empty-state'>No notifications yet.</p>";
            return;
        }

        list.innerHTML = data.map(n => {
            const date = new Date(n.date);
            const formattedDate = isNaN(date)
                ? "—"
                : date.toLocaleString("en-US", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit", hour12: false
                });
            return `
                <article class="notification-card">
                    <header>
                        <h3>Notification</h3>  
                        <time datetime="${date.toISOString()}">${formattedDate}</time>
                    </header>
                    <p>${escapeHTML(n.message)}</p>
                </article>
            `;
        }).join("");

    } catch (err) {
        list.innerHTML = `<p class='empty-state'>${escapeHTML(err.message)}</p>`;
    }
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    await guardSession();
    updateCurrentDate();
    await loadProfile();
    loadSpecialities();
}); 