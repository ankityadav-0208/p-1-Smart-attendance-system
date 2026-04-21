// Global variables
let currentUser = null;

// API Base URL

// Section visibility functions
function showFeatures() {
    const features = document.getElementById('features');
    const howItWorks = document.getElementById('how-it-works');
    const contact = document.getElementById('contact');
    
    if (features) features.classList.remove('hidden-section');
    if (howItWorks) howItWorks.classList.add('hidden-section');
    if (contact) contact.classList.add('hidden-section');
    
    features.scrollIntoView({ behavior: 'smooth' });
}

function showHowItWorks() {
    const features = document.getElementById('features');
    const howItWorks = document.getElementById('how-it-works');
    const contact = document.getElementById('contact');
    
    if (howItWorks) howItWorks.classList.remove('hidden-section');
    if (features) features.classList.add('hidden-section');
    if (contact) contact.classList.add('hidden-section');
    
    howItWorks.scrollIntoView({ behavior: 'smooth' });
}

function showContact() {
    const features = document.getElementById('features');
    const howItWorks = document.getElementById('how-it-works');
    const contact = document.getElementById('contact');
    
    if (contact) contact.classList.remove('hidden-section');
    if (features) features.classList.add('hidden-section');
    if (howItWorks) howItWorks.classList.add('hidden-section');
    
    contact.scrollIntoView({ behavior: 'smooth' });
}

// Contact form handler
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        showToast('Thank you! Your message has been sent successfully.', 'success');
        this.reset();
    });
}

// Get Started button handler
function handleGetStarted() {
    showRegisterModal();
}


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
        
        localStorage.setItem('token', data.token);
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        currentUser = data.user;
        
        showToast('Login successful!', 'success');
        closeModals();
        
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

// ============================================
// MODAL FUNCTIONS - These are called from HTML buttons
// ============================================

// Show login modal
function showLoginModal(role) {
    console.log('showLoginModal called with role:', role);
    const modal = document.getElementById('loginModal');
    const title = document.getElementById('modalTitle');
    if (modal && title) {
        title.textContent = role === 'teacher' ? 'Teacher Login' : 'Student Login';
        modal.style.display = 'block';
    } else {
        console.error('Modal or title element not found');
    }
}

// Show register modal
function showRegisterModal() {
    console.log('showRegisterModal called');
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'block';
        selectRole('student');
    } else {
        console.error('Register modal not found');
    }
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
        if (studentForm) studentForm.classList.add('active');
        if (teacherForm) teacherForm.classList.remove('active');
        if (studentBtn) studentBtn.classList.add('active');
        if (teacherBtn) teacherBtn.classList.remove('active');
    } else {
        if (teacherForm) teacherForm.classList.add('active');
        if (studentForm) studentForm.classList.remove('active');
        if (teacherBtn) teacherBtn.classList.add('active');
        if (studentBtn) studentBtn.classList.remove('active');
    }
}

// Close all modals
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// ============================================
// UI FUNCTIONS
// ============================================

// Show toast notification
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
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
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
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
        updateUIForLoggedInUser(currentUser);
        
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

// ============================================
// EXPORT FUNCTIONS TO WINDOW - CRITICAL FOR HTML BUTTONS
// ============================================
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

console.log('app.js loaded. Functions exported:', {
    showLoginModal: typeof window.showLoginModal,
    showRegisterModal: typeof window.showRegisterModal,
    toggleDarkMode: typeof window.toggleDarkMode
});
