document.addEventListener("DOMContentLoaded", () => {
    const pageButtons = document.querySelectorAll("[data-page-target]");
    const views = document.querySelectorAll(".view");

    const specialitySearch = document.getElementById("specialitySearch");
    const specialityCards = document.querySelectorAll(".speciality-card");
    const specialityEmpty = document.getElementById("specialityEmpty");

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

    const doctorTabs = document.querySelectorAll(".doctor-tab");
    const filterButtons = document.querySelectorAll("[data-status-filter]");
    const queueDoctorTitle = document.getElementById("queueDoctorTitle");
    const queueCount = document.getElementById("queueCount");
    const queueTableBody = document.getElementById("queueTableBody");
    const queueEmpty = document.getElementById("queueEmpty");

    let reservationToCancel = null;
    let activeDoctorId = "hireche";
    let activeStatusFilter = "all";

    const queues = {
        hireche: {
            doctorName: "Dr. Hireche Anes",
            patients: [
                { name: "Ahmed Benali", time: "09:00", status: "finished" },
                { name: "Yacine Merabet", time: "09:20", status: "inProgress" },
                { name: "Sofiane Rahmani", time: "09:40", status: "waiting" },
                { name: "Ouail Messallem", time: "10:00", status: "waiting" },
                { name: "Meriem Haddad", time: "10:20", status: "waiting" }
            ]
        },
        belfatmi: {
            doctorName: "Dr. Belfatmi Ilyes",
            patients: [
                { name: "Samir Bouchama", time: "08:45", status: "finished" },
                { name: "Aymen Kadi", time: "09:05", status: "finished" },
                { name: "Sofiane Rahmani", time: "09:25", status: "inProgress" },
                { name: "Ouail Messallem", time: "09:45", status: "waiting" }
            ]
        }
    };

    const statusLabels = {
        finished: "Finished",
        waiting: "Waiting",
        inProgress: "In progress"
    };

    function showPage(pageId) {
        views.forEach((view) => {
            const isTarget = view.id === pageId;
            view.classList.toggle("is-active", isTarget);
            view.hidden = !isTarget;
        });

        pageButtons.forEach((button) => {
            const isTarget = button.dataset.pageTarget === pageId;
            button.classList.toggle("is-active", isTarget);
            if (isTarget) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });
    }

    function updateCurrentDate() {
        const today = new Date();
        weekdayText.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today);
        dateText.textContent = new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(today);
    }

    function filterSpecialities() {
        const query = specialitySearch.value.trim().toLowerCase();
        let visibleCount = 0;

        specialityCards.forEach((card) => {
            const text = `${card.textContent} ${card.dataset.specialty}`.toLowerCase();
            const isVisible = text.includes(query);
            card.hidden = !isVisible;
            if (isVisible) visibleCount += 1;
        });

        specialityEmpty.hidden = visibleCount > 0;
    }

    function clearFieldErrors() {
        document.querySelectorAll(".field-error").forEach((error) => {
            error.textContent = "";
        });
    }

    function setFieldError(inputId, message) {
        const error = document.querySelector(`[data-error-for="${inputId}"]`);
        if (error) error.textContent = message;
    }

    function formatBirthday(value) {
        if (!value) return "";
        const date = new Date(`${value}T00:00:00`);
        return new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(date);
    }

    function validateProfileForm() {
        clearFieldErrors();

        const email = profileForm.email.value.trim();
        const phone = profileForm.phone.value.trim();
        const address = profileForm.address.value.trim();
        const birthday = profileForm.birthday.value;
        let isValid = true;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError("emailInput", "Enter a valid email address.");
            isValid = false;
        }

        if (!phone || phone.replace(/\D/g, "").length != 10) {
            setFieldError("phoneInput", "Enter a valid phone number.");
            isValid = false;
        }

        if (!address) {
            setFieldError("addressInput", "Address is required.");
            isValid = false;
        }

        if (!birthday) {
            setFieldError("birthdayInput", "Birthday is required.");
            isValid = false;
        }

        return isValid;
    }

    function openProfileEditor() {
        profileForm.hidden = false;
        profileFormStatus.textContent = "";
        document.getElementById("emailInput").focus();
    }

    function closeProfileEditor() {
        profileForm.hidden = true;
        profileFormStatus.textContent = "";
        clearFieldErrors();
        editProfileBtn.focus();
    }

    function saveProfile(event) {
        event.preventDefault();

        if (!validateProfileForm()) {
            profileFormStatus.textContent = "Please fix the highlighted fields.";
            return;
        }

        document.getElementById("displayEmail").textContent = profileForm.email.value.trim();
        document.getElementById("displayPhone").textContent = profileForm.phone.value.trim();
        document.getElementById("displayAddress").textContent = profileForm.address.value.trim();
        document.getElementById("displayBirthday").textContent = formatBirthday(profileForm.birthday.value);

        profileFormStatus.textContent = "Profile updated.";
        window.setTimeout(() => {
            profileForm.hidden = true;
            profileFormStatus.textContent = "";
        }, 900);
    }

    function openCancelDialog(card) {
        reservationToCancel = card;
        cancelDoctorName.textContent = card.dataset.doctor || "this doctor";
        modalOverlay.hidden = false;
        cancelDialog.hidden = false;
        confirmCancelBtn.focus();
    }

    function closeCancelDialog() {
        modalOverlay.hidden = true;
        cancelDialog.hidden = true;
        reservationToCancel = null;
    }

    function updateReservationEmptyState() {
        const activeReservations = reservationList.querySelectorAll(".reservation-card");
        reservationEmpty.hidden = activeReservations.length > 0;
    }

    function cancelReservation() {
        if (reservationToCancel) {
            reservationToCancel.remove();
            updateReservationEmptyState();
        }
        closeCancelDialog();
    }

    function escapeHTML(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderQueue() {
        const queue = queues[activeDoctorId];
        const allPatients = queue ? queue.patients : [];
        const filteredPatients = activeStatusFilter === "all"
            ? allPatients
            : allPatients.filter((patient) => patient.status === activeStatusFilter);

        queueDoctorTitle.textContent = `${queue.doctorName} queue`;
        queueCount.textContent = `${filteredPatients.length} ${filteredPatients.length === 1 ? "patient" : "patients"}`;
        queueEmpty.hidden = filteredPatients.length > 0;

        queueTableBody.innerHTML = filteredPatients.map((patient, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(patient.name)}</td>
                <td>${escapeHTML(patient.time)}</td>
                <td><span class="status-badge status-${patient.status}">${statusLabels[patient.status]}</span></td>
            </tr>
        `).join("");
    }

    pageButtons.forEach((button) => {
        button.addEventListener("click", () => showPage(button.dataset.pageTarget));
    });

    specialitySearch.addEventListener("input", filterSpecialities);

    editProfileBtn.addEventListener("click", openProfileEditor);
    cancelProfileEditBtn.addEventListener("click", closeProfileEditor);
    profileForm.addEventListener("submit", saveProfile);

    reservationList.addEventListener("click", (event) => {
        const cancelButton = event.target.closest(".cancel-reservation-btn");
        if (!cancelButton) return;

        const card = cancelButton.closest(".reservation-card");
        openCancelDialog(card);
    });

    confirmCancelBtn.addEventListener("click", cancelReservation);
    closeCancelDialogBtn.addEventListener("click", closeCancelDialog);
    modalOverlay.addEventListener("click", closeCancelDialog);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !cancelDialog.hidden) {
            closeCancelDialog();
        }
    });

    doctorTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            activeDoctorId = tab.dataset.doctorId;
            doctorTabs.forEach((item) => item.classList.remove("is-active"));
            tab.classList.add("is-active");
            renderQueue();
        });
    });

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeStatusFilter = button.dataset.statusFilter;
            filterButtons.forEach((item) => item.classList.remove("is-active"));
            button.classList.add("is-active");
            renderQueue();
        });
    });

    updateCurrentDate();
    updateReservationEmptyState();
    renderQueue();


    
    const API_URL =
        window.location.origin && window.location.origin !== "null"
            ? window.location.origin
            : "http://localhost:8080";

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: "POST",
                    credentials: "include"
                });
            } catch (error) {
                console.error("Logout failed:", error);
            } finally {
                window.location.href = "Welcome.html";
            }
        });
    }
});


