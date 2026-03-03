// Global variables
let currentUser = null;

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
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!', 'success');
        
        // Close modal
        closeModals();
        
        // The redirect will happen automatically via auth.onAuthStateChanged in auth.js
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No user found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            default:
                errorMessage = error.message;
        }
        
        showToast(errorMessage, 'error');
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
    
    const photoFile = document.getElementById('studentPhoto').files[0];
    
    const userData = {
        name: document.getElementById('studentName').value,
        roll: document.getElementById('studentRoll').value,
        section: document.getElementById('studentSection').value,
        email: document.getElementById('studentEmail').value,
        password: password,
        photo: photoFile
    };
    
    try {
        await registerStudent(userData);
        closeModals();
    } catch (error) {
        // Error handled in auth.js
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
    
    const photoFile = document.getElementById('teacherPhoto').files[0];
    
    const userData = {
        name: document.getElementById('teacherName').value,
        employeeId: document.getElementById('teacherEmployeeId').value,
        department: document.getElementById('teacherDepartment').value,
        email: document.getElementById('teacherEmail').value,
        password: password,
        verificationCode: document.getElementById('teacherCode').value,
        photo: photoFile
    };
    
    try {
        await registerTeacher(userData);
        closeModals();
    } catch (error) {
        // Error handled in auth.js
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
    if (!container) return;
    
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            container.removeChild(toast);
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
    const currentUser = sessionStorage.getItem('currentUser');
    if (currentUser) {
        // User is logged in, update UI accordingly
        updateUIForLoggedInUser(JSON.parse(currentUser));
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
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Export functions for use in other files
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.switchToRegister = switchToRegister;
window.selectRole = selectRole;
window.scrollToFeatures = scrollToFeatures;
window.toggleDarkMode = toggleDarkMode;
window.logout = logout;