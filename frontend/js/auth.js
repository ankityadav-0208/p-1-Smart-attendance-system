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


// ========== ADD THESE FUNCTIONS AT THE END OF YOUR auth.js FILE ==========

// Modal Display Functions
function showLoginModal(role) {
    const modal = document.getElementById('loginModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (modalTitle) {
        modalTitle.textContent = role === 'teacher' ? 'Teacher Login' : 'Student Login';
    }
    
    if (modal) {
        modal.style.display = 'flex';
        // Clear form fields
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
    }
}

function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset to student role by default
        if (typeof selectRole === 'function') {
            selectRole('student');
        }
        // Clear form fields
        const studentForm = document.getElementById('studentRegisterForm');
        const teacherForm = document.getElementById('teacherRegisterForm');
        if (studentForm) studentForm.reset();
        if (teacherForm) teacherForm.reset();
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

function closeModals() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
}

// Switch to Register from Login
function switchToRegister() {
    closeModal(document.getElementById('loginModal'));
    showRegisterModal();
}

// Select Role in Registration (for the role toggle buttons)
function selectRole(role) {
    // Update active button styling
    const roleBtns = document.querySelectorAll('.role-btn');
    roleBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(role)) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide appropriate form
    const studentForm = document.getElementById('studentRegisterForm');
    const teacherForm = document.getElementById('teacherRegisterForm');
    
    if (role === 'student') {
        if (studentForm) studentForm.classList.add('active');
        if (teacherForm) teacherForm.classList.remove('active');
    } else {
        if (teacherForm) teacherForm.classList.add('active');
        if (studentForm) studentForm.classList.remove('active');
    }
}

// Handle Login Form Submit (connects your existing login function)
async function handleLoginSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    // Call your existing login function
    await login(email, password);
}

// Handle Student Registration Form Submit
async function handleStudentRegisterSubmit(event) {
    event.preventDefault();
    
    const userData = {
        name: document.getElementById('studentName')?.value,
        email: document.getElementById('studentEmail')?.value,
        password: document.getElementById('studentPassword')?.value,
        roll: document.getElementById('studentRoll')?.value,
        section: document.getElementById('studentSection')?.value
    };
    
    const confirmPassword = document.getElementById('studentConfirmPassword')?.value;
    
    // Validation
    if (!userData.name || !userData.roll || !userData.section || !userData.email || !userData.password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (userData.password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (userData.password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Call your existing registerStudent function
    await registerStudent(userData);
}

// Handle Teacher Registration Form Submit
async function handleTeacherRegisterSubmit(event) {
    event.preventDefault();
    
    const userData = {
        name: document.getElementById('teacherName')?.value,
        email: document.getElementById('teacherEmail')?.value,
        password: document.getElementById('teacherPassword')?.value,
        employeeId: document.getElementById('teacherEmployeeId')?.value,
        department: document.getElementById('teacherDepartment')?.value,
        verificationCode: document.getElementById('teacherCode')?.value
    };
    
    const confirmPassword = document.getElementById('teacherConfirmPassword')?.value;
    
    // Validation
    if (!userData.name || !userData.email || !userData.password || !userData.employeeId || !userData.department || !userData.verificationCode) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (userData.password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (userData.password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Call your existing registerTeacher function
    await registerTeacher(userData);
}

// Function to scroll to features (for nav links)
function scrollToFeatures() {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize all event listeners (ADD THIS to your existing DOMContentLoaded)
function initModalEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    
    // Student registration form
    const studentForm = document.getElementById('studentRegisterForm');
    if (studentForm) {
        studentForm.addEventListener('submit', handleStudentRegisterSubmit);
    }
    
    // Teacher registration form
    const teacherForm = document.getElementById('teacherRegisterForm');
    if (teacherForm) {
        teacherForm.addEventListener('submit', handleTeacherRegisterSubmit);
    }
    
    // Close buttons for modals
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (event.target === registerModal) {
            registerModal.style.display = 'none';
        }
    };
    
    // Role selector in registration modal
    const roleBtns = document.querySelectorAll('.role-btn');
    roleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const role = this.textContent.toLowerCase().includes('student') ? 'student' : 'teacher';
            selectRole(role);
        });
    });
}


// ========== MODAL FUNCTIONS ==========
function showLoginModal(role) {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        // Clear previous values
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
    }
}

function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

function switchToRegister() {
    closeModal(document.getElementById('loginModal'));
    showRegisterModal();
}

// ========== LOGIN HANDLER ==========
async function handleLoginSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    // Call your existing login function
    await login(email, password);
}

// ========== REGISTRATION HANDLERS ==========
async function handleStudentRegisterSubmit(event) {
    event.preventDefault();
    
    const userData = {
        name: document.getElementById('studentName')?.value,
        email: document.getElementById('studentEmail')?.value,
        password: document.getElementById('studentPassword')?.value,
        roll: document.getElementById('studentRoll')?.value,
        section: document.getElementById('studentSection')?.value
    };
    
    const confirmPassword = document.getElementById('studentConfirmPassword')?.value;
    
    if (userData.password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    await registerStudent(userData);
}

async function handleTeacherRegisterSubmit(event) {
    event.preventDefault();
    
    const userData = {
        name: document.getElementById('teacherName')?.value,
        email: document.getElementById('teacherEmail')?.value,
        password: document.getElementById('teacherPassword')?.value,
        employeeId: document.getElementById('teacherEmployeeId')?.value,
        department: document.getElementById('teacherDepartment')?.value,
        verificationCode: document.getElementById('teacherCode')?.value
    };
    
    const confirmPassword = document.getElementById('teacherConfirmPassword')?.value;
    
    if (userData.password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    await registerTeacher(userData);
}

function selectRole(role) {
    const studentForm = document.getElementById('studentRegisterForm');
    const teacherForm = document.getElementById('teacherRegisterForm');
    const roleBtns = document.querySelectorAll('.role-btn');
    
    roleBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(role)) {
            btn.classList.add('active');
        }
    });
    
    if (role === 'student') {
        if (studentForm) studentForm.classList.add('active');
        if (teacherForm) teacherForm.classList.remove('active');
    } else {
        if (teacherForm) teacherForm.classList.add('active');
        if (studentForm) studentForm.classList.remove('active');
    }
}

// ========== EXPOSE FUNCTIONS GLOBALLY ==========
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeModal = closeModal;
window.switchToRegister = switchToRegister;
window.handleLoginSubmit = handleLoginSubmit;
window.handleStudentRegisterSubmit = handleStudentRegisterSubmit;
window.handleTeacherRegisterSubmit = handleTeacherRegisterSubmit;
window.selectRole = selectRole;
// ========== EXPORT ALL NEW FUNCTIONS ==========
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeModal = closeModal;
window.closeModals = closeModals;
window.switchToRegister = switchToRegister;
window.selectRole = selectRole;
window.scrollToFeatures = scrollToFeatures;

// Update existing DOMContentLoaded to include our new initializer
// (This preserves your existing checkAuthState call)
const existingDOMListener = document.addEventListener;
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    initModalEventListeners();
});


// Export functions for use in other files
window.login = login;
window.logout = logout;
window.registerStudent = registerStudent;
window.registerTeacher = registerTeacher;
window.getDeviceId = getDeviceId;
window.checkAuthState = checkAuthState;
