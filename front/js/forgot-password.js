const API_URL = 'http://localhost:8080';
const FORGOT_PASSWORD_ENDPOINT = '/auth/forgot-password';

const form = document.getElementById('forgotPasswordForm');
const emailInput = document.getElementById('email');
const resetBtn = document.getElementById('resetBtn');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

function showMessage(element, message) {
    element.textContent = message;
    element.classList.add('is_visible');
}

function clearMessages() {
    errorMsg.textContent = '';
    successMsg.textContent = '';
    errorMsg.classList.remove('is_visible');
    successMsg.classList.remove('is_visible');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleForgotPassword(event) {
    event.preventDefault();
    clearMessages();

    const email = emailInput.value.trim();

    if (!email) {
        showMessage(errorMsg, 'Enter the email address linked to your account.');
        emailInput.focus();
        return;
    }

    if (!isValidEmail(email)) {
        showMessage(errorMsg, 'Enter a valid email address.');
        emailInput.focus();
        return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending instructions...';

    try {
        const response = await fetch(`${API_URL}${FORGOT_PASSWORD_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email })
        });

        const text = await response.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            throw new Error((data && data.message) || text || 'We could not send reset instructions. Please try again.');
        }

        showMessage(
            successMsg,
            'If this email is registered, reset instructions have been sent. Check your inbox and spam folder.'
        );
        form.reset();
    } catch (error) {
        showMessage(errorMsg, error.message);
    } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send reset instructions';
    }
}

form.addEventListener('submit', handleForgotPassword);
