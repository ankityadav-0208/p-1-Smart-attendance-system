// Teacher Dashboard Functions
let currentSession = null;
let qrRefreshInterval = null;
let chart = null;

// Helper function for API calls with auth token
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Use API.baseURL from the global API object (defined in api.js)
    const response = await fetch(`${API.baseURL}${endpoint}`, {
        ...options,
        headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'API request failed');
    }
    
    return data;
}

// Load teacher data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTeacherData();
    await loadDashboardStats();
    await loadStudents();
    await loadAttendanceRecords();
    setupSettings();
});

// Load teacher data
async function loadTeacherData() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('teacherName').textContent = user.name;
    document.getElementById('teacherDepartment').textContent = user.department || 'Faculty';
    
    if (user.profilePhotoURL) {
        document.getElementById('profileImage').src = user.profilePhotoURL;
    }
}

// Setup settings page
function setupSettings() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    document.getElementById('settingsName').value = user.name || '';
    document.getElementById('settingsEmail').value = user.email || '';
    document.getElementById('settingsDepartment').value = user.department || 'Faculty';
}

// Show different sections
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    
    document.getElementById(`${section}Section`).classList.add('active');
    event.target.classList.add('active');
    
    const titles = {
        overview: 'Overview',
        attendance: 'Attendance Records',
        students: 'My Students',
        reports: 'Reports',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    if (section === 'attendance') loadAttendanceRecords();
    if (section === 'students') loadStudents();
    if (section === 'reports') loadSectionsForReport();
}

// Load dashboard statistics - Using API
async function loadDashboardStats() {
    try {
        // Get students list
        const studentsResponse = await apiRequest('/teacher/students');
        const students = studentsResponse.data || [];
        document.getElementById('totalStudents').textContent = students.length;

        // Get today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const attendanceResponse = await apiRequest(`/teacher/attendance-records?startDate=${today.toISOString()}&endDate=${tomorrow.toISOString()}`);
        const todayRecords = attendanceResponse.data || [];
        
        const uniqueStudents = new Set(todayRecords.map(r => r.studentId?._id || r.studentId));
        document.getElementById('todayAttendance').textContent = uniqueStudents.size;

        if (students.length > 0) {
            const avg = (uniqueStudents.size / students.length) * 100;
            document.getElementById('avgAttendance').textContent = avg.toFixed(1) + '%';
        }

        // Get active sessions
        const sessionsResponse = await apiRequest('/teacher/active-sessions');
        document.getElementById('activeSessions').textContent = (sessionsResponse.data || []).length;

        loadAttendanceChart();
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load attendance chart - Using API
async function loadAttendanceChart() {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const response = await apiRequest(`/teacher/attendance-records?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
    const records = response.data || [];

    const last7Days = [];
    const dailyCount = {};
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        last7Days.push(dateStr);
        dailyCount[dateStr] = 0;
    }

    records.forEach(record => {
        const date = new Date(record.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (dailyCount.hasOwnProperty(dateStr)) {
            dailyCount[dateStr]++;
        }
    });

    const counts = last7Days.map(date => dailyCount[date]);

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Daily Attendance',
                data: counts,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: { legend: { display: false } }
        }
    });
}

// Start attendance session - Using API
async function startAttendance() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Get classroom location from user or default
        const classroomLocation = {
            latitude: 29.171743,
            longitude: 75.735818
        };
        
        const response = await apiRequest('/teacher/start-session', {
            method: 'POST',
            body: JSON.stringify({ 
                classroomLocation,
                allowedRadius: 1000
            })
        });

        const sessionData = response.data;
        currentSession = {
            id: sessionData.sessionId,
            sessionToken: sessionData.sessionToken,
            expiresAt: sessionData.expiresAt
        };

        generateQRCode(sessionData.sessionId, sessionData.sessionToken);
        
        document.getElementById('stopBtn').disabled = false;
        document.querySelector('button[onclick="startAttendance()"]').disabled = true;
        
        document.getElementById('qrContainer').classList.remove('hidden');
        document.getElementById('sessionId').textContent = sessionData.sessionId;
        
        startQRTimer();
        
        showToast('Attendance session started', 'success');
    } catch (error) {
        console.error('Error starting session:', error);
        showToast('Failed to start session: ' + error.message, 'error');
    }
}

// Generate QR code
function generateQRCode(sessionId, token) {
    const qrData = {
        sessionId: sessionId,
        token: token,
        timestamp: Date.now(),
        type: 'attendance'
    };
    
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    new QRCode(qrContainer, {
        text: JSON.stringify(qrData),
        width: 256,
        height:256,
        colorDark: '#1e3c72',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Generate session token
function generateSessionToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// Start QR refresh timer
function startQRTimer() {
    let timeLeft = 300;
    const timerElement = document.getElementById('qrTimer');
    
    qrRefreshInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft % 10 === 0 && currentSession) {
            currentSession.sessionToken = generateSessionToken();
            generateQRCode(currentSession.id, currentSession.sessionToken);
        }
        
        if (timeLeft <= 0) {
            stopAttendance();
        }
    }, 1000);
}

// Stop attendance session - Using API
async function stopAttendance() {
    try {
        if (currentSession) {
            await apiRequest(`/teacher/stop-session/${currentSession.id}`, { method: 'PUT' });
        }
        
        if (qrRefreshInterval) {
            clearInterval(qrRefreshInterval);
        }
        
        document.getElementById('stopBtn').disabled = true;
        document.querySelector('button[onclick="startAttendance()"]').disabled = false;
        document.getElementById('qrContainer').classList.add('hidden');
        
        showToast('Attendance session ended', 'info');
        
        loadDashboardStats();
        loadAttendanceRecords();
    } catch (error) {
        console.error('Error stopping session:', error);
        showToast('Failed to stop session', 'error');
    }
}

// Load attendance records - Using API
async function loadAttendanceRecords() {
    try {
        const response = await apiRequest('/teacher/attendance-records');
        const records = response.data || [];

        const tbody = document.getElementById('attendanceTableBody');
        tbody.innerHTML = '';

        for (const record of records.slice(0, 50)) {
            const student = record.studentId || {};
            const date = new Date(record.timestamp);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleString()}</td>
                <td>${student.name || 'Unknown'}</td>
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.section || 'N/A'}</td>
                <td><span class="badge badge-success">Present</span></td>
                <td>
                    ${record.selfieUrl ? 
                        `<button class="btn btn-sm btn-primary" onclick="viewSelfie('${record.selfieUrl}')">View</button>` : 
                        'No selfie'}
                </td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading records:', error);
        showToast('Error loading attendance records', 'error');
    }
}

// Load students - Using API
async function loadStudents() {
    try {
        const response = await apiRequest('/teacher/students');
        const students = response.data || [];

        const tbody = document.getElementById('studentsTableBody');
        tbody.innerHTML = '';

        for (const student of students) {
            // Get attendance percentage
            const attendanceResponse = await apiRequest(`/teacher/attendance-records?studentId=${student._id}`);
            const attendanceRecords = attendanceResponse.data || [];
            
            const totalSessionsResponse = await apiRequest('/teacher/attendance-records');
            const totalSessions = totalSessionsResponse.data?.length || 0;
            
            const percentage = totalSessions > 0 
                ? ((attendanceRecords.length / totalSessions) * 100).toFixed(1)
                : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.name}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${percentage}%</td>
                <td>Never\n            `;
            tbody.appendChild(row);
        }

        loadSections();
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('Error loading students', 'error');
    }
}

// Load sections for filter
async function loadSections() {
    try {
        const response = await apiRequest('/teacher/students');
        const students = response.data || [];

        const sections = new Set();
        students.forEach(student => {
            if (student.section) {
                sections.add(student.section);
            }
        });

        const sectionFilter = document.getElementById('sectionFilter');
        const reportSection = document.getElementById('reportSection');
        
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            if (sectionFilter) sectionFilter.appendChild(option.cloneNode(true));
            if (reportSection) reportSection.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error('Error loading sections:', error);
    }
}

// Filter students
async function filterStudents() {
    const section = document.getElementById('sectionFilter').value;
    const search = document.getElementById('searchStudent').value.toLowerCase();

    try {
        const response = await apiRequest('/teacher/students');
        let students = response.data || [];
        
        students = students.filter(student => {
            if (section && student.section !== section) return false;
            if (search && !student.name.toLowerCase().includes(search) && 
                !student.rollNumber?.toLowerCase().includes(search)) return false;
            return true;
        });

        const tbody = document.getElementById('studentsTableBody');
        tbody.innerHTML = '';

        for (const student of students) {
            const attendanceResponse = await apiRequest(`/teacher/attendance-records?studentId=${student._id}`);
            const attendanceRecords = attendanceResponse.data || [];
            
            const totalSessionsResponse = await apiRequest('/teacher/attendance-records');
            const totalSessions = totalSessionsResponse.data?.length || 0;
            
            const percentage = totalSessions > 0 
                ? ((attendanceRecords.length / totalSessions) * 100).toFixed(1)
                : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.name}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${percentage}%</td>
                <td>N/A\n            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Error filtering students:', error);
    }
}

// Store report chart instance globally
let reportChart = null;

// Generate report - Using API (FIXED - no infinite loop)
async function generateReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const section = document.getElementById('reportSection').value;
    const year = new Date().getFullYear();

    try {
        const response = await apiRequest(`/teacher/report?month=${month}&year=${year}&section=${section}`);
        const reportData = response.data || [];

        const labels = reportData.map(s => s.name);
        const data = reportData.map(s => parseFloat(s.percentage));

        const ctx = document.getElementById('reportChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (reportChart) {
            reportChart.destroy();
            reportChart = null;
        }
        
        reportChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attendance Percentage',
                    data: data,
                    backgroundColor: '#4a90e2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },  // Disable animation
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
        
        showToast('Report generated', 'success');
    } catch (error) {
        console.error('Error generating report:', error);
        showToast('Error generating report', 'error');
    }
}

// Download CSV - Using API
async function downloadCSV() {
    try {
        const response = await apiRequest('/teacher/attendance-records');
        const records = response.data || [];

        let csv = 'Date,Student Name,Roll Number,Section,Session ID\n';

        for (const record of records) {
            const student = record.studentId || {};
            const date = new Date(record.timestamp);
            
            csv += `${date.toLocaleString()},${student.name || 'Unknown'},${student.rollNumber || 'N/A'},${student.section || 'N/A'},${record.sessionId}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        showToast('CSV downloaded successfully', 'success');
    } catch (error) {
        console.error('Error downloading CSV:', error);
        showToast('Error downloading CSV', 'error');
    }
}

// View selfie
function viewSelfie(url) {
    if (url) {
        window.open(url, '_blank');
    } else {
        showToast('No selfie available', 'info');
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Change password - Using API
async function changePassword() {
    const currentPassword = prompt('Enter current password:');
    if (!currentPassword) return;
    
    const newPassword = prompt('Enter new password (minimum 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        try {
            showLoading();
            await apiRequest('/users/change-password', {
                method: 'PUT',
                body: JSON.stringify({ 
                    currentPassword: currentPassword,
                    newPassword: newPassword 
                })
            });
            showToast('Password updated successfully', 'success');
        } catch (error) {
            console.error('Password update error:', error);
            showToast('Error updating password', 'error');
        } finally {
            hideLoading();
        }
    } else if (newPassword) {
        showToast('Password must be at least 6 characters', 'error');
    }
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Load sections for report
function loadSectionsForReport() {
    // Already handled in loadSections
}

// Loading functions
function showLoading() {
    let loader = document.getElementById('teacherLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'teacherLoader';
        loader.className = 'global-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
}

function hideLoading() {
    const loader = document.getElementById('teacherLoader');
    if (loader) loader.remove();
}

// ✅ EXPORT ALL FUNCTIONS TO WINDOW
window.showSection = showSection;
window.startAttendance = startAttendance;
window.stopAttendance = stopAttendance;
window.filterStudents = filterStudents;
window.generateReport = generateReport;
window.downloadCSV = downloadCSV;
window.viewSelfie = viewSelfie;
window.changePassword = changePassword;
window.toggleDarkMode = toggleDarkMode;