// API Base URL - Make sure this matches your backend


// Teacher verification code
const TEACHER_VERIFICATION_CODE = "TEACH2024SECURE";

// Check authentication state on page load
function checkAuthState() {
    const token = localStorage.getItem('token');
    const storedUser = sessionStorage.getItem('currentUser');
    
    console.log('Checking auth state...', token ? 'Token found' : 'No token');
    
    if (token && storedUser) {
        const userData = JSON.parse(storedUser);
        console.log('User data:', userData);
        
        // Get current page filename
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        console.log('Current page:', currentPage);
        console.log('User role:', userData.role);
        
        // Redirect if on index page
        if (currentPage === 'index.html' || currentPage === '' || currentPage.includes('index')) {
            console.log('On index page, redirecting based on role...');
            
            switch(userData.role) {
                case 'student':
                    console.log('Redirecting to student dashboard');
                    window.location.href = 'student-dashboard.html';
                    break;
                case 'teacher':
                    console.log('Redirecting to teacher dashboard');
                    window.location.href = 'teacher-dashboard.html';
                    break;
                case 'admin':
                    console.log('Redirecting to admin dashboard');
                    window.location.href = 'admin-dashboard.html';
                    break;
                case 'pending_teacher':
                    console.log('Redirecting to pending approval');
                    window.location.href = 'pending-approval.html';
                    break;
                default:
                    console.log('Unknown role:', userData.role);
            }
        }
    } else {
        // No token, check if on protected page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const protectedPages = ['student-dashboard.html', 'teacher-dashboard.html', 'admin-dashboard.html', 'pending-approval.html'];
        
        if (protectedPages.includes(currentPage)) {
            console.log('No token, redirecting to index');
            window.location.href = 'index.html';
        }
    }
}

// Login Function
async function login(email, password) {
    try {
        showLoading();
        console.log('Logging in with email:', email);
        
        const response = await fetch(`${API.baseURL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        // Store token and user data
        localStorage.setItem('token', data.token);
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        
        console.log('Login successful for:', data.user.email);
        showToast('Login successful!', 'success');
        
        // Redirect based on role
        setTimeout(() => {
            switch(data.user.role) {
                case 'student':
                    window.location.href = 'student-dashboard.html';
                    break;
                case 'teacher':
                    window.location.href = 'teacher-dashboard.html';
                    break;
                case 'admin':
                    window.location.href = 'admin-dashboard.html';
                    break;
                case 'pending_teacher':
                    window.location.href = 'pending-approval.html';
                    break;
                default:
                    window.location.href = 'index.html';
            }
        }, 1500);
        
        return data.user;
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Student Registration
async function registerStudent(userData) {
    try {
        showLoading();
        console.log('Starting registration for:', userData.email);
        
        const response = await fetch(`${API.baseURL}/auth/register/student`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: userData.name,
                email: userData.email,
                password: userData.password,
                rollNumber: userData.roll,
                section: userData.section
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }
        
        // Store token and user data
        localStorage.setItem('token', data.token);
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        
        console.log('Registration successful for:', data.user.email);
        showToast('Registration successful!', 'success');
        
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'student-dashboard.html';
        }, 1500);
        
        return data.user;
        
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = error.message || 'Registration failed';
        
        if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
            errorMessage = 'Email already in use';
        }
        
        showToast(errorMessage, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Teacher Registration
async function registerTeacher(userData) {
    try {
        showLoading();
        console.log('Starting teacher registration for:', userData.email);
        
        // Verify teacher code
        if (userData.verificationCode !== TEACHER_VERIFICATION_CODE) {
            throw new Error('Invalid teacher verification code');
        }
        
        // Check email domain
        if (!userData.email.includes('@university.edu')) {
            throw new Error('Please use your official university email (must contain @university.edu)');
        }
        
        const response = await fetch(`${API.baseURL}/auth/register/teacher`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: userData.name,
                email: userData.email,
                password: userData.password,
                employeeId: userData.employeeId,
                department: userData.department,
                verificationCode: userData.verificationCode
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }
        
        console.log('Teacher registration submitted for approval');
        showToast('Registration submitted for approval!', 'success');
        
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'pending-approval.html';
        }, 1500);
        
        return data;
        
    } catch (error) {
        console.error('Teacher registration error:', error);
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Get Device ID (for device binding)
async function getDeviceId() {
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown'
    ].join('||');
    
    // Create a hash of the fingerprint
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// Logout Function
async function logout() {
    try {
        showLoading();
        // Clear stored data
        localStorage.removeItem('token');
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    } finally {
        hideLoading();
    }
}

// Inactivity Timer
let inactivityTimer;
const INACTIVITY_TIME = 10 * 60 * 1000; // 10 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        const token = localStorage.getItem('token');
        if (token) {
            showToast('Session expired due to inactivity', 'warning');
            logout();
        }
    }, INACTIVITY_TIME);
}

// Initialize inactivity timer on user interaction
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('scroll', resetInactivityTimer);

// Call checkAuthState when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
});

// Export functions for use in other files
window.login = login;
window.logout = logout;
window.registerStudent = registerStudent;
window.registerTeacher = registerTeacher;
window.getDeviceId = getDeviceId;
window.checkAuthState = checkAuthState;
