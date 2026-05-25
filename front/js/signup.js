const API_URL = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080";

// Wait for DOM before touching anything
document.addEventListener("DOMContentLoaded", () => {

    const signUpForm = document.getElementById("signUpForm");
    const usernameInput = document.getElementById("username");
    const firstNameInput = document.getElementById("first_name");
    const lastNameInput = document.getElementById("last_name");
    const emailInput = document.getElementById("email");
    const phoneNumberInput = document.getElementById("phone_number");
    const insuranceNumberInput = document.getElementById("insurance_number");
    const genderInput = document.getElementById("gender");
    const birthdayInput = document.getElementById("birthday");
    const addressInput = document.getElementById("address");
    const chronicDiseasesInput = document.getElementById("chronic_diseases");
    const medicalFileInput = document.getElementById("medical_file");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirm_password");
    const errorMsg = document.getElementById("errorMsg");
    const successMsg = document.getElementById("successMsg");
    const signupBtn = document.getElementById("signupBtn");
    const photoFileInput = document.getElementById("profile_photo");
    const fileName = document.getElementById("fileName");
    const pfpPreview = document.getElementById("pfpPreview");
    const medicalFileName = document.getElementById("medicalFileName");
    let selectedProfilePhoto = null;
    let selectedMedicalFile = null;

    pfpPreview.src = "images/user.png";
    fileName.textContent = "No file selected";

    medicalFileInput.addEventListener("change", () => {
        const file = medicalFileInput.files[0];
        selectedMedicalFile = file || null;

        if (!file) {
            medicalFileName.textContent = "No file selected";
            return;
        }
        medicalFileName.textContent = file.name;
    });

    photoFileInput.addEventListener("change", () => {
        const file = photoFileInput.files[0];
        selectedProfilePhoto = file || null;

        if (!file) {
            fileName.textContent = "No file selected";
            pfpPreview.src = "images/Cardiology.png";
            return;
        }

        fileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            pfpPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Guard — if any critical element is missing, log and stop
    const critical = {
        signUpForm, usernameInput, firstNameInput, lastNameInput,
        emailInput, phoneNumberInput, passwordInput, confirmPasswordInput,
        errorMsg, successMsg, signupBtn
    };

    for (const [name, el] of Object.entries(critical)) {
        if (!el) {
            console.error(`signup.js: missing element #${name}`);
            return;
        }
    }

    // ── Helpers ───────────────────────────────────────────────
    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.add("is_visible");
        successMsg.classList.remove("is_visible");
    }

    function showSuccess(message) {
        successMsg.textContent = message;
        successMsg.classList.add("is_visible");
        errorMsg.classList.remove("is_visible");
    }

    function clearMessages() {
        errorMsg.textContent = "";
        successMsg.textContent = "";
        errorMsg.classList.remove("is_visible");
        successMsg.classList.remove("is_visible");
    }

    function setLoading(isLoading, label = "Create account") {
        signupBtn.disabled = isLoading;
        signupBtn.textContent = isLoading ? label : "Create account";
    }

    function val(input) {
        return input ? input.value.trim() : "";
    }

    // ── Validation ────────────────────────────
    function validate() {
        if (!val(usernameInput)) { showError("Username is required."); return false; }
        if (val(usernameInput).length < 5) { showError("Username must be at least 5 characters."); return false; }
        if (!val(firstNameInput)) { showError("First name is required."); return false; }
        if (!val(lastNameInput)) { showError("Last name is required."); return false; }
        if (!val(emailInput)) { showError("Email address is required."); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(emailInput))) { showError("Enter a valid email address."); return false; }
        if (!val(phoneNumberInput)) { showError("Phone number is required."); return false; }
        if (!val(insuranceNumberInput)) { showError("Insurance number is required."); return false; }
        if (!val(birthdayInput)) { showError("Date of birth is required."); return false; }
        if (!val(addressInput)) { showError("Address is required."); return false; }
        if (!val(genderInput)) { showError("Gender is required."); return false; }
        if (!val(passwordInput)) { showError("Password is required."); return false; }
        if (val(passwordInput).length < 6) { showError("Password must be at least 6 characters."); return false; }
        if (val(passwordInput).includes(" ")) { showError("Password cannot contain spaces."); return false; }
        if (passwordInput.value !== confirmPasswordInput.value) { showError("Passwords do not match."); return false; }
        return true;
    }

    // ── Session check ─────────────────────────────────────────
    async function checkSession() {
        try {
            const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
            if (res.ok) window.location.href = "Home.html";
        } catch {
            // offline — stay on page
        }
    }

    // ── Submit ────────────────────────────────────────────────
    async function handleSignup(e) {
        e.preventDefault();
        clearMessages();

        if (!validate()) return;

        const payload = {
            username: val(usernameInput),
            first_name: val(firstNameInput),
            last_name: val(lastNameInput),
            email: val(emailInput),
            phone_number: val(phoneNumberInput),
            insurance_number: val(insuranceNumberInput),
            gender: val(genderInput),
            birthday: val(birthdayInput),
            address: val(addressInput),
            chronic_diseases: val(chronicDiseasesInput), // ← add this
            password: passwordInput.value,
            role: "patient",
        };

        let redirecting = false;
        setLoading(true, "Creating account...");

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            const text = await res.text();
            let data = null;
            try { data = text ? JSON.parse(text) : null; } catch { data = null; }

            if (!res.ok) {
                throw new Error(
                    (data && data.message) || text || "Signup failed. Please check your information."
                );
            }

            setLoading(true, "Signing in...");

            const loginRes = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: payload.email, password: payload.password }),
            });

            if (!loginRes.ok) {
                throw new Error("Account created but auto-login failed. Please log in manually.");
            }

            if (selectedProfilePhoto) {
                const formData = new FormData();
                formData.append("file", selectedProfilePhoto);

                const avatarRes = await fetch(`${API_URL}/profile/avatar`, {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                });

                if (!avatarRes.ok) {
                    throw new Error("Account created, but profile photo upload failed.");
                }
            }

            if (selectedMedicalFile) {
                const medicalFormData = new FormData();
                medicalFormData.append("file", selectedMedicalFile);

                const medicalRes = await fetch(`${API_URL}/patients/medical-file`, {
                    method: "POST",
                    credentials: "include",
                    body: medicalFormData,
                });

                if (!medicalRes.ok) {
                    throw new Error("Account created, but medical file upload failed.");
                }
            }

            redirecting = true;
            showSuccess("Account created! Redirecting...");
            setLoading(true, "Redirecting...");
            setTimeout(() => { window.location.href = "Home.html"; }, 900);

        } catch (err) {
            showError(err.message || "Signup failed. Please try again.");
        } finally {
            if (!redirecting) setLoading(false);
        }
    }

    signUpForm.addEventListener("submit", handleSignup);
    checkSession();
});