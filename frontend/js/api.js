// API Service for backend communication
const API = {
    baseURL: 'https://your-backend-url.onrender.com/api', // Replace with your backend URL
    
    // Helper method for API calls
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            ...options,
            headers,
            credentials: 'include'
        };
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Auth endpoints
    auth: {
        login: (email, password) => 
            API.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            }),
        
        registerStudent: (userData) =>
            API.request('/auth/register/student', {
                method: 'POST',
                body: JSON.stringify(userData)
            }),
        
        registerTeacher: (userData) =>
            API.request('/auth/register/teacher', {
                method: 'POST',
                body: JSON.stringify(userData)
            }),
        
        getMe: () => API.request('/auth/me')
    },
    
    // Admin endpoints
    admin: {
        getStats: () => API.request('/admin/stats'),
        getTeachers: () => API.request('/admin/teachers'),
        getStudents: () => API.request('/admin/students'),
        getPendingApprovals: () => API.request('/admin/pending-approvals'),
        approveTeacher: (id) => 
            API.request(`/admin/approve-teacher/${id}`, { method: 'PUT' }),
        rejectTeacher: (id) => 
            API.request(`/admin/reject-teacher/${id}`, { method: 'PUT' }),
        disableUser: (id) => 
            API.request(`/admin/disable-user/${id}`, { method: 'PUT' })
    },
    
    // Teacher endpoints
    teacher: {
        startSession: (data) =>
            API.request('/teacher/start-session', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
        
        stopSession: (id) =>
            API.request(`/teacher/stop-session/${id}`, { method: 'PUT' }),
        
        getActiveSessions: () =>
            API.request('/teacher/active-sessions'),
        
        getAttendanceRecords: (params = {}) => {
            const queryString = new URLSearchParams(params).toString();
            return API.request(`/teacher/attendance-records?${queryString}`);
        },
        
        getStudents: () =>
            API.request('/teacher/students'),
        
        getReport: (month, year, section) =>
            API.request(`/teacher/report?month=${month}&year=${year}&section=${section}`)
    },
    
    // Student endpoints
    student: {
        validateSession: (sessionId, token) =>
            API.request('/student/validate-session', {
                method: 'POST',
                body: JSON.stringify({ sessionId, token })
            }),
        
        markAttendance: async (sessionId, location, selfieFile) => {
            const formData = new FormData();
            formData.append('data', JSON.stringify({ sessionId, location }));
            formData.append('selfie', selfieFile);
            
            return API.request('/student/mark-attendance', {
                method: 'POST',
                headers: {}, // Let browser set content-type for FormData
                body: formData
            });
        },
        
        getHistory: () =>
            API.request('/student/history'),
        
        getStats: () =>
            API.request('/student/stats')
    }
};

// Update auth.js to use API instead of Firebase
async function login(email, password) {
    try {
        showLoading();
        const response = await API.auth.login(email, password);
        
        // Store token
        localStorage.setItem('token', response.token);
        sessionStorage.setItem('currentUser', JSON.stringify(response.user));
        
        showToast('Login successful!', 'success');
        return response.user;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function registerStudent(userData) {
    try {
        showLoading();
        const response = await API.auth.registerStudent(userData);
        
        localStorage.setItem('token', response.token);
        sessionStorage.setItem('currentUser', JSON.stringify(response.user));
        
        showToast('Registration successful!', 'success');
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'student-dashboard.html';
        }, 1500);
        
        return response.user;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function registerTeacher(userData) {
    try {
        showLoading();
        const response = await API.auth.registerTeacher(userData);
        
        showToast('Registration submitted for approval!', 'success');
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'pending-approval.html';
        }, 1500);
        
        return response;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Check auth state on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (token && currentPage === 'index.html') {
        try {
            const response = await API.auth.getMe();
            sessionStorage.setItem('currentUser', JSON.stringify(response.user));
            
            // Redirect based on role
            switch(response.user.role) {
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
        } catch (error) {
            localStorage.removeItem('token');
        }
    } else if (!token && currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
    }
});