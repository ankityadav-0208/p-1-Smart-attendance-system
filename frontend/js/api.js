// API Service for backend communication
const API = {
    baseURL: 'https://p-1-smart-attendance-system-02.onrender.com/api',
    
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
        
        // Don't set Content-Type for FormData (let browser set it)
        if (options.body && options.body instanceof FormData) {
            delete headers['Content-Type'];
        }
        
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
        
        markAttendance: (sessionId, location, selfieFile) => {
            const formData = new FormData();
            formData.append('data', JSON.stringify({ sessionId, location }));
            formData.append('selfie', selfieFile);
            
            return API.request('/student/mark-attendance', {
                method: 'POST',
                body: formData
            });
        },
        
        getHistory: () =>
            API.request('/student/history'),
        
        getStats: () =>
            API.request('/student/stats')
    }
};

// Make API available globally
window.API = API;