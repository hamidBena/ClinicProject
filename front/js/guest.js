const API_URL = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080";

const fallbackQueues = [
    {
        id: "hireche",
        doctor: "Dr. Hireche Anes",
        speciality: "Cardiology",
        room: "Room 204",
        image: "images/Cardiology.png",
        entries: [
            { position: 1, time: "09:00", status: "in-progress" },
            { position: 2, time: "09:20", status: "waiting" },
            { position: 3, time: "09:40", status: "waiting" },
            { position: 4, time: "10:00", status: "waiting" },
            { position: 5, time: "08:40", status: "finished" }
        ]
    },
    {
        id: "belfatmi",
        doctor: "Dr. Belfatmi Ilyes",
        speciality: "Orthopedics",
        room: "Room 118",
        image: "images/Orthopedics.png",
        entries: [
            { position: 1, time: "09:10", status: "in-progress" },
            { position: 2, time: "09:30", status: "waiting" },
            { position: 3, time: "09:50", status: "waiting" },
            { position: 4, time: "08:50", status: "finished" }
        ]
    },
    {
        id: "meziane",
        doctor: "Dr. Meziane Lina",
        speciality: "Neurology",
        room: "Room 312",
        image: "images/Neurology.png",
        entries: [
            { position: 1, time: "09:15", status: "in-progress" },
            { position: 2, time: "09:35", status: "waiting" },
            { position: 3, time: "08:55", status: "finished" }
        ]
    }
];

let queueData = fallbackQueues;
let selectedDoctorId = "all";

function normalizePublicQueue(payload) {
    if (!Array.isArray(payload)) return fallbackQueues;

    return payload.map((doctor, index) => ({
        id: String(doctor.id || doctor.doctor_id || `doctor-${index}`),
        doctor: doctor.doctor || doctor.name || "Doctor",
        speciality: doctor.speciality || doctor.specialty || "General care",
        room: doctor.room || doctor.location || "Clinic room",
        image: doctor.image || doctor.icon || "images/logo.png",
        entries: Array.isArray(doctor.entries || doctor.queue)
            ? (doctor.entries || doctor.queue).map((entry, entryIndex) => ({
                position: Number(entry.position || entryIndex + 1) || entry.number || `Q-${String(entryIndex + 1).padStart(3, "0")}`,
                time: entry.time || "--:--",
                status: String(entry.status || "waiting").toLowerCase().replace(/\s+/g, "-")
            }))
            : []
    }));
}

async function checkSession() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: "include"
        });

        if (response.ok) {
            window.location.href = "Home.html";
        }
    } catch (error) {
        // Keep unauthenticated users on the public page.
    }
}

async function loadPublicQueues() {
    try {
        const queuesRes = await fetch(`${API_URL}/queues`, {
            credentials: "include"
        });
        if (!queuesRes.ok) return fallbackQueues;
        const queues = await queuesRes.json();

        // For each queue, fetch its reservations
        const enriched = await Promise.all(queues.map(async (q) => {
            let entries = [];
            try {
                const resRes = await fetch(`${API_URL}/reservations/queue/${q.id}`, {
                    credentials: "include"
                });
                if (resRes.ok) {
                    const reservations = await resRes.json();
                    entries = reservations.map((r, i) => ({
                        position: i + 1,
                        time: new Date(r.timedue).toLocaleTimeString("en-US", {
                            hour: "2-digit", minute: "2-digit", hour12: false
                        }),
                        status: r.status === "Waiting" ? "waiting"
                            : r.status === "Proccessing" ? "in-progress"
                                : "finished"
                    }));
                }
            } catch (_) { }

            return {
                id: String(q.id),
                doctor: q.speciality_name || "Doctor",
                speciality: q.speciality_name || "General",
                room: "Room —",
                image: `images/${q.speciality_name || "logo"}.png`,
                entries
            };
        }));

        return enriched.length ? enriched : fallbackQueues;
    } catch (_) {
        return fallbackQueues;
    }
}

function getQueueStats(entries) {
    return {
        total: entries.length,
        waiting: entries.filter(entry => entry.status === "waiting").length,
        active: entries.filter(entry => entry.status === "in-progress").length
    };
}

function formatStatus(status) {
    return status
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function renderDoctorCards() {
    const grid = document.getElementById("doctorQueueGrid");
    if (!grid) return;

    const allEntries = queueData.flatMap(item => item.entries);
    const allStats = getQueueStats(allEntries);

    const allCard = `
        <button class="doctor_queue_card ${selectedDoctorId === "all" ? "is_active" : ""}" type="button" data-doctor-id="all">
            <div class="doctor_queue_card_top">
                <img src="images/logo.png" alt="All doctors queue icon">
                <div>
                    <h3>All doctors</h3>
                    <p>Combined public queue board</p>
                </div>
            </div>
            <div class="queue_stats" aria-label="All doctors queue statistics">
                <div class="queue_stat"><strong>${allStats.total}</strong><span>Total</span></div>
                <div class="queue_stat"><strong>${allStats.waiting}</strong><span>Waiting</span></div>
                <div class="queue_stat"><strong>${allStats.active}</strong><span>Active</span></div>
            </div>
        </button>
    `;

    const doctorCards = queueData.map(item => {
        const stats = getQueueStats(item.entries);

        return `
            <button class="doctor_queue_card ${selectedDoctorId === item.id ? "is_active" : ""}" type="button" data-doctor-id="${item.id}">
                <div class="doctor_queue_card_top">
                    <img src="${item.image}" alt="${item.speciality} queue icon">
                    <div>
                        <h3>${item.doctor}</h3>
                        <p>${item.speciality} · ${item.room}</p>
                    </div>
                </div>
                <div class="queue_stats" aria-label="${item.doctor} queue statistics">
                    <div class="queue_stat"><strong>${stats.total}</strong><span>Total</span></div>
                    <div class="queue_stat"><strong>${stats.waiting}</strong><span>Waiting</span></div>
                    <div class="queue_stat"><strong>${stats.active}</strong><span>Active</span></div>
                </div>
            </button>
        `;
    }).join("");

    grid.innerHTML = allCard + doctorCards;

    grid.querySelectorAll(".doctor_queue_card").forEach(card => {
        card.addEventListener("click", () => {
            selectedDoctorId = card.dataset.doctorId;
            renderDoctorCards();
            renderQueueTable();
        });
    });
}

function getFilteredEntries() {
    const searchInput = document.getElementById("queueSearch");
    const statusFilter = document.getElementById("statusFilter");

    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const status = statusFilter ? statusFilter.value : "all";

    return queueData
        .filter(item => selectedDoctorId === "all" || item.id === selectedDoctorId)
        .flatMap(item => item.entries.map(entry => ({ ...entry, doctor: item.doctor, speciality: item.speciality })))
        .filter(entry => status === "all" || entry.status === status)
        .filter(entry => {
            const haystack = `${entry.doctor} ${entry.speciality} ${entry.status}`.toLowerCase();
            return haystack.includes(searchQuery);
        })
        .sort((a, b) => {
            const statusRank = { "in-progress": 0, waiting: 1, finished: 2 };
            return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || a.position - b.position;
        });
}

function renderQueueTable() {
    const body = document.getElementById("queueTableBody");
    const count = document.getElementById("queueResultCount");
    const title = document.getElementById("queueTableTitle");
    const emptyMessage = document.getElementById("emptyQueueMessage");

    if (!body || !count || !title || !emptyMessage) return;

    const entries = getFilteredEntries();
    const selectedDoctor = queueData.find(item => item.id === selectedDoctorId);

    title.textContent = selectedDoctor ? `${selectedDoctor.doctor} queue` : "All active queue entries";
    count.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
    emptyMessage.hidden = entries.length > 0;

    body.innerHTML = entries.map(entry => `
        <tr>
            <td>${entry.doctor}</td>
            <td>${entry.speciality}</td>
            <td class="queue_position">#${entry.position}</td>
            <td>${entry.time}</td>
            <td><span class="status_badge ${entry.status}">${formatStatus(entry.status)}</span></td>
        </tr>
    `).join("");
}

function attachQueueControls() {
    const searchInput = document.getElementById("queueSearch");
    const statusFilter = document.getElementById("statusFilter");

    if (searchInput) searchInput.addEventListener("input", renderQueueTable);
    if (statusFilter) statusFilter.addEventListener("change", renderQueueTable);
}

async function initializeGuestPage() {
    checkSession();
    queueData = await loadPublicQueues();
    attachQueueControls();
    renderDoctorCards();
    renderQueueTable();
}

document.addEventListener("DOMContentLoaded", initializeGuestPage);
