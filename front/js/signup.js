const API_URL = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080";

const signUpForm = document.getElementById("signUpForm");

const usernameInput = document.getElementById("username");
const firstNameInput = document.getElementById("first_name");
const lastNameInput = document.getElementById("last_name");
const emailInput = document.getElementById("email");
const phoneNumberInput = document.getElementById("phone_number");
const insuranceNumberInput = document.getElementById("insurance_number");
const addressInput = document.getElementById("address");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm_password");

const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");
const signupBtn = document.getElementById("signupBtn");

function showMessage(element, message) {
    element.textContent = message;
    element.classList.add("is_visible");
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

function setFieldGroupState(fields, isActive) {
    fields.forEach((field) => {
        field.classList.toggle("is_hidden", !isActive);

        field.querySelectorAll("input, select").forEach((input) => {
            input.disabled = !isActive;
            input.required = isActive;
        });
    });
}

function readJsonOrText(response) {
    return response.text().then((text) => {
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (error) {
            data = null;
        }

        return { text, data };
    });
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
        // Stay on the signup page when the API is unavailable.
    }
}

async function handleSignup(event) {
    event.preventDefault();
    clearMessages();

    if (!signUpForm.checkValidity()) {
        signUpForm.reportValidity();
        return;
    }

    if (passwordInput.value !== confirmPasswordInput.value) {
        showMessage(errorMsg, "Passwords do not match.");
        confirmPasswordInput.focus();
        return;
    }


    const payload = {
        username: usernameInput.value.trim(),
        first_name: firstNameInput.value.trim(),
        last_name: lastNameInput.value.trim(),
        phone_number: phoneNumberInput.value.trim(),
        email: emailInput.value.trim(),
        insurance_number = insuranceNumberInput.value.trim(),
        password: passwordInput.value,
    };

    let redirecting = false;
    setLoading(true, "Creating account...");

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const registerResult = await readJsonOrText(response);

        if (!response.ok) {
            throw new Error(
                (registerResult.data && registerResult.data.message) ||
                registerResult.text ||
                "Signup failed. Please check your information."
            );
        }

        setLoading(true, "Signing in...");

        const loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                email: payload.email,
                password: payload.password
            })
        });

        if (!loginResponse.ok) {
            throw new Error("Account created, but automatic login failed. Please log in manually.");
        }

        redirecting = true;
        showMessage(successMsg, "Account created. Redirecting to your dashboard...");
        setLoading(true, "Redirecting...");

        window.setTimeout(() => {
            window.location.href = "Home.html";
        }, 900);
    } catch (error) {
        showMessage(errorMsg, error.message || "Signup failed. Please try again.");
    } finally {
        if (!redirecting) {
            setLoading(false);
        }
    }
}