const API_URL = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");
const loginBtn = document.getElementById("loginBtn");

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add("is_visible");
}

function clearError() {
    errorMsg.textContent = "";
    errorMsg.classList.remove("is_visible");
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Logging in..." : "Login";
}

async function checkSession() {
    try {

        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: "include"
        });

        if (!response.ok) return;

        const data = await response.json();
        const role = data.role;

        if (role === "admin") {
            window.location.href = "Admin.html";
        }
        else if (role === "doctor") {
            window.location.href = "MedicalStaff.html";
        }
        else if (role === "patient") {
            window.location.href = "Home.html";
        }
        else {
            console.error("Unknown user role");
        }

    } catch (error) {
        console.error(error);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    clearError();

    if (!loginForm.checkValidity()) {
        loginForm.reportValidity();
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    setLoading(true);

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Login failed");
        }

        const role = data.role;

        if (role === "admin") {
            window.location.href = "Admin.html";
        } else if (role === "doctor") {
            window.location.href = "MedicalStaff.html";
        } else if (role === "patient") {
            window.location.href = "Home.html";
        } else {
            throw new Error("Missing role in response");
        }
    } catch (error) {
        showError(error.message || "Login failed. Please try again.");
        setLoading(false);
    }
}

loginForm.addEventListener("submit", handleLogin);
checkSession();