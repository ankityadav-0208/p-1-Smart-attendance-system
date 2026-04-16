// Global variables
let currentUser = null;

// API Base URL - Update this to your Render backend URL

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkAuthState();
    initializeTheme();
});

// Initialize event listeners
function initializeEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    
    // Registration forms
    const studentForm = document.getElementById('studentRegisterForm');
    if (studentForm) {
        studentForm.addEventListener('submit', handleStudentRegistration);
    }
    
    const teacherForm = document.getElementById('teacherRegisterForm');
    if (teacherForm) {
        teacherForm.addEventListener('submit', handleTeacherRegistration);
    }
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModals();
        }
    });
}

// Handle login
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Call your backend API
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
        
        // Store the token and user data
        localStorage.setItem('token', data.token);
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        currentUser = data.user;
        
        showToast('Login successful!', 'success');
        
        // Close modal
        closeModals();
        
        // Redirect based on user role
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
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Handle student registration
async function handleStudentRegistration(e) {
    e.preventDefault();
    
    const password = document.getElementById('studentPassword').value;
    const confirmPassword = document.getElementById('studentConfirmPassword').value;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    const userData = {
        name: document.getElementById('studentName').value,
        roll: document.getElementById('studentRoll').value,
        section: document.getElementById('studentSection').value,
        email: document.getElementById('studentEmail').value,
        password: password
    };
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/auth/register/student`, {
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
        currentUser = data.user;
        
        showToast('Registration successful! Redirecting...', 'success');
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'student-dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = error.message || 'Registration failed';
        
        if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
            errorMessage = 'Email already in use';
        }
        
        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

// Handle teacher registration
async function handleTeacherRegistration(e) {
    e.preventDefault();
    
    const password = document.getElementById('teacherPassword').value;
    const confirmPassword = document.getElementById('teacherConfirmPassword').value;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    const userData = {
        name: document.getElementById('teacherName').value,
        employeeId: document.getElementById('teacherEmployeeId').value,
        department: document.getElementById('teacherDepartment').value,
        email: document.getElementById('teacherEmail').value,
        password: password,
        verificationCode: document.getElementById('teacherCode').value
    };
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/auth/register/teacher`, {
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
        
        showToast('Registration submitted for approval!', 'success');
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'pending-approval.html';
        }, 1500);
        
    } catch (error) {
        console.error('Teacher registration error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Logout function
async function logout() {
    try {
        showLoading();
        // Clear stored data
        localStorage.removeItem('token');
        sessionStorage.removeItem('currentUser');
        currentUser = null;
        window.location.href = 'index.html';
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    } finally {
        hideLoading();
    }
}

// Show login modal
function showLoginModal(role) {
    const modal = document.getElementById('loginModal');
    const title = document.getElementById('modalTitle');
    title.textContent = role === 'teacher' ? 'Teacher Login' : 'Student Login';
    modal.style.display = 'block';
}

// Show register modal
function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    modal.style.display = 'block';
    selectRole('student'); // Default to student
}

// Switch to register from login
function switchToRegister() {
    closeModals();
    showRegisterModal();
}

// Select role in registration
function selectRole(role) {
    const studentForm = document.getElementById('studentRegisterForm');
    const teacherForm = document.getElementById('teacherRegisterForm');
    const studentBtn = document.querySelector('.role-btn[onclick="selectRole(\'student\')"]');
    const teacherBtn = document.querySelector('.role-btn[onclick="selectRole(\'teacher\')"]');
    
    if (role === 'student') {
        studentForm.classList.add('active');
        teacherForm.classList.remove('active');
        studentBtn.classList.add('active');
        teacherBtn.classList.remove('active');
    } else {
        teacherForm.classList.add('active');
        studentForm.classList.remove('active');
        teacherBtn.classList.add('active');
        studentBtn.classList.remove('active');
    }
}

// Close all modals
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        // Create container if it doesn't exist
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.className = 'toast-container';
        document.body.appendChild(newContainer);
    }
    
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Show loading indicator
function showLoading() {
    let loader = document.getElementById('globalLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.className = 'global-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
}

// Hide loading indicator
function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.remove();
    }
}

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Scroll to features section
function scrollToFeatures() {
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
}

// Check authentication state
function checkAuthState() {
    const token = localStorage.getItem('token');
    const storedUser = sessionStorage.getItem('currentUser');
    
    if (token && storedUser) {
        currentUser = JSON.parse(storedUser);
        // User is logged in, update UI accordingly
        updateUIForLoggedInUser(currentUser);
        
        // If on index page, redirect to appropriate dashboard
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === 'index.html' || currentPage === '') {
            setTimeout(() => {
                switch(currentUser.role) {
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
                }
            }, 500);
        }
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser(user) {
    // Update navigation buttons
    const navButtons = document.querySelector('.nav-buttons');
    if (navButtons) {
        navButtons.innerHTML = `
            <span class="user-greeting">Welcome, ${user.name}</span>
            <button class="btn btn-outline" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;
    }
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Make API_BASE_URL available globally for other files
window.API_BASE_URL = API_BASE_URL;

// Export functions for use in other files
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.switchToRegister = switchToRegister;
window.selectRole = selectRole;
window.scrollToFeatures = scrollToFeatures;
window.toggleDarkMode = toggleDarkMode;
window.logout = logout;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.formatDate = formatDate;