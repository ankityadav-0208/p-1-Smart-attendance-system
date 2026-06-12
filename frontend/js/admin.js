// Admin Dashboard Functions

// Store chart instances globally
let adminChart = null;
let userDistChart = null;
let weeklyAttChart = null;

// ✅ Define API.baseURL here


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

// Load admin data on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin dashboard loading...');
    await loadAdminData();
    await loadDashboardStats();
    await loadRecentActivity();
    await loadPendingApprovals();
    await loadTeachers();
    await loadStudents();
});

// Load admin data
async function loadAdminData() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('adminName').textContent = user.name;
    
    if (user.profilePhotoURL) {
        document.getElementById('profileImage').src = user.profilePhotoURL;
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Show different sections
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    const links = document.querySelectorAll('.sidebar-nav a');
    links.forEach(link => {
        if (link.getAttribute('onclick')?.includes(section)) {
            link.classList.add('active');
        }
    });
    
    const titles = {
        overview: 'Overview',
        teachers: 'Teacher Management',
        students: 'Student Management',
        approvals: 'Pending Approvals',
        subjects: 'Subject Management',
        attendance: 'Attendance Records',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Overview';
    
    // Load section-specific data
    if (section === 'overview') {
        loadDashboardStats();
        loadRecentActivity();
    }
    if (section === 'subjects') loadSubjects();
    if (section === 'teachers') loadTeachers();
    if (section === 'students') loadStudents();
    if (section === 'approvals') loadPendingApprovals();
    if (section === 'attendance') loadAdminAttendanceRecords();
    if (section === 'settings') loadSettings();
}

// Load dashboard statistics - Using API
async function loadDashboardStats() {
    try {
        console.log('Loading dashboard stats...');
        
        // Call your backend API for stats
        const response = await apiRequest('/admin/stats');
        const stats = response.data;
        
        document.getElementById('totalTeachers').textContent = stats.teachers || 0;
        document.getElementById('totalStudents').textContent = stats.students || 0;
        document.getElementById('pendingApprovals').textContent = stats.pending || 0;
        document.getElementById('pendingCount').textContent = stats.pending || 0;
        setTimeout(() => {
            loadAdminChart(stats);
        }, 200);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard statistics', 'error');
    }
}

// Load admin charts (Doughnut & Line)
async function loadAdminChart(stats) {
    console.log('Loading admin charts...');
    
    // 1. User Distribution Chart (Doughnut)
    const distCanvas = document.getElementById('userDistChart');
    if (distCanvas) {
        const distCtx = distCanvas.getContext('2d');
        const teachers = stats ? (stats.teachers || 0) : 0;
        const students = stats ? (stats.students || 0) : 0;
        const pending = stats ? (stats.pending || 0) : 0;
        
        if (userDistChart) {
            userDistChart.destroy();
        }
        
        userDistChart = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: ['Teachers', 'Students', 'Pending Approvals'],
                datasets: [{
                    data: [teachers, students, pending],
                    backgroundColor: [
                        '#8B5A3C', // Primary
                        '#D4A373', // Secondary
                        '#E9C46A'  // Accent
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } }
                    }
                }
            }
        });
    }
    
    // 2. Weekly Attendance Activity Chart (Line)
    const lineCanvas = document.getElementById('weeklyAttChart');
    if (lineCanvas) {
        const lineCtx = lineCanvas.getContext('2d');
        
        // Let's populate last 7 days with counts
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const last7DaysLabels = [];
        const last7DaysData = [0, 0, 0, 0, 0, 0, 0];
        
        // Generate daily labels
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7DaysLabels.push(daysOfWeek[d.getDay()]);
        }
        
        try {
            // Fetch records from last 7 days to calculate counts
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const response = await apiRequest(`/teacher/attendance-records?startDate=${sevenDaysAgo.toISOString()}&endDate=${new Date().toISOString()}`);
            const records = response.data || [];
            
            records.forEach(record => {
                const recDate = new Date(record.timestamp);
                const diffTime = Math.abs(new Date() - recDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
                if (diffDays >= 0 && diffDays < 7) {
                    // Index from the end (since 0 diffDays is today, which is last element in last7DaysData)
                    last7DaysData[6 - diffDays]++;
                }
            });
        } catch (err) {
            console.error('Error fetching weekly chart records:', err);
        }
        
        if (weeklyAttChart) {
            weeklyAttChart.destroy();
        }
        
        weeklyAttChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: last7DaysLabels,
                datasets: [{
                    label: 'Check-ins',
                    data: last7DaysData,
                    borderColor: '#8B5A3C',
                    backgroundColor: 'rgba(139, 90, 60, 0.05)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3,
                    pointBackgroundColor: '#8B5A3C',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

// Load pending teacher approvals - Using API
async function loadPendingApprovals() {
    try {
        const tbody = document.getElementById('approvalsTableBody');
        if (!tbody) return;

        const response = await apiRequest('/admin/pending-approvals');
        const approvals = response.data;

        document.getElementById('pendingCount').textContent = approvals.length;
        document.getElementById('pendingApprovals').textContent = approvals.length;

        if (approvals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No pending approvals</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        
        approvals.forEach(approval => {
            let date = 'N/A';
            if (approval.requestedAt) {
                date = new Date(approval.requestedAt).toLocaleString();
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${approval.name || 'N/A'}</td>
                <td>${approval.employeeId || 'N/A'}</td>
                <td>${approval.department || 'N/A'}</td>
                <td>${approval.email || 'N/A'}</td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="approveTeacher('${approval._id}', '${approval.userId}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectTeacher('${approval._id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading approvals:', error);
        const tbody = document.getElementById('approvalsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Error loading approvals: ${error.message}</td></tr>`;
        }
    }
}

// Load teachers - Using API
async function loadTeachers() {
    try {
        const response = await apiRequest('/admin/teachers');
        const teachers = response.data;

        const tbody = document.getElementById('teachersTableBody');
        if (!tbody) return;

        if (teachers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No teachers found</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        
        teachers.forEach(teacher => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${teacher.name || 'N/A'}</td>
                <td>${teacher.employeeId || 'N/A'}</td>
                <td>${teacher.department || 'N/A'}</td>
                <td>${teacher.email || 'N/A'}</td>
                <td><span class="badge badge-success">Active</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="disableTeacher('${teacher._id}')">
                        <i class="fas fa-ban"></i> Disable
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

// Load students - Using API
async function loadStudents() {
    try {
        console.log('📚 Loading students...');
        
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) {
            console.error('❌ Students table body not found');
            return;
        }

        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading students...</td></tr>';
        
        const response = await apiRequest('/admin/students');
        const students = response.data;

        console.log(`✅ Found ${students.length} students`);

        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No students found</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        
        students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.name || 'N/A'}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${student.email || 'N/A'}</td>
                <td>0%</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="disableStudent('${student._id}')">
                        <i class="fas fa-ban"></i> Disable
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        console.log('✅ Students table updated');
        
    } catch (error) {
        console.error('❌ Error loading students:', error);
        const tbody = document.getElementById('studentsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading students: ${error.message}</td></tr>`;
        }
    }
}

// Subject Management Functions
let subjectsList = [];

// Load subjects
async function loadSubjects() {
    try {
        const response = await apiRequest('/subjects');
        subjectsList = response.data;
        
        const tbody = document.getElementById('subjectsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        subjectsList.forEach(subject => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${subject.code}</strong></td>
                <td>${subject.name}</td>
                <td>${subject.department}</td>
                <td>Semester ${subject.semester}</td>
                <td>${subject.teacherId?.name || 'Not Assigned'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteSubject('${subject._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Also load teachers for dropdown
        loadTeachersForDropdown();
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        showToast('Error loading subjects', 'error');
    }
}

// Load teachers for dropdown
async function loadTeachersForDropdown() {
    try {
        const response = await apiRequest('/admin/teachers');
        const teachers = response.data;
        
        const teacherSelect = document.getElementById('subjectTeacher');
        if (!teacherSelect) return;
        
        teacherSelect.innerHTML = '<option value="">Select Teacher</option>';
        teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher._id;
            option.textContent = `${teacher.name} (${teacher.department})`;
            teacherSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

// Add new subject
async function addSubject() {
    const name = document.getElementById('subjectName').value.trim();
    const code = document.getElementById('subjectCode').value.trim().toUpperCase();
    const department = document.getElementById('subjectDepartment').value;
    const semester = document.getElementById('subjectSemester').value;
    const teacherId = document.getElementById('subjectTeacher').value;
    
    if (!name || !code) {
        showToast('Please fill subject name and code', 'error');
        return;
    }
    
    try {
        showLoading();
        
        const response = await apiRequest('/subjects', {
            method: 'POST',
            body: JSON.stringify({ name, code, department, semester, teacherId })
        });
        
        if (response.success) {
            showToast('Subject added successfully', 'success');
            
            // Clear form
            document.getElementById('subjectName').value = '';
            document.getElementById('subjectCode').value = '';
            
            // Reload subjects
            await loadSubjects();
        }
        
    } catch (error) {
        console.error('Error adding subject:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Delete subject
async function deleteSubject(subjectId) {
    if (!confirm('Are you sure you want to delete this subject? This will affect attendance records.')) return;
    
    try {
        showLoading();
        
        await apiRequest(`/subjects/${subjectId}`, { method: 'DELETE' });
        
        showToast('Subject deleted successfully', 'success');
        await loadSubjects();
        
    } catch (error) {
        console.error('Error deleting subject:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}


// Filter students - Using API
async function filterStudents() {
    const search = document.getElementById('searchStudent').value.toLowerCase();
    
    try {
        const response = await apiRequest('/admin/students');
        let students = response.data;
        
        if (search) {
            students = students.filter(student => 
                student.name?.toLowerCase().includes(search) || 
                student.rollNumber?.toLowerCase().includes(search)
            );
        }

        const tbody = document.getElementById('studentsTableBody');
        tbody.innerHTML = '';

        students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.name || 'N/A'}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${student.email || 'N/A'}</td>
                <td>0%</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="disableStudent('${student._id}')">
                        <i class="fas fa-ban"></i> Disable
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error filtering students:', error);
    }
}

// Approve teacher - Using API
async function approveTeacher(approvalId, userId) {
    try {
        showLoading();
        
        await apiRequest(`/admin/approve-teacher/${approvalId}`, { method: 'PUT' });

        showToast('Teacher approved successfully!', 'success');
        
        await loadDashboardStats();
        await loadPendingApprovals();
        await loadTeachers();
        
    } catch (error) {
        console.error('Error approving teacher:', error);
        showToast('Error approving teacher: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Reject teacher - Using API
async function rejectTeacher(approvalId) {
    try {
        showLoading();
        
        await apiRequest(`/admin/reject-teacher/${approvalId}`, { method: 'PUT' });

        showToast('Teacher request rejected', 'info');
        
        await loadDashboardStats();
        await loadPendingApprovals();
        
    } catch (error) {
        console.error('Error rejecting teacher:', error);
        showToast('Error rejecting teacher: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Disable teacher - Using API
async function disableTeacher(userId) {
    if (!confirm('Are you sure you want to disable this teacher?')) return;
    
    try {
        showLoading();
        
        await apiRequest(`/admin/disable-user/${userId}`, { method: 'PUT' });
        
        showToast('Teacher disabled', 'info');
        await loadTeachers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error disabling teacher:', error);
        showToast('Error disabling teacher', 'error');
    } finally {
        hideLoading();
    }
}

// Disable student - Using API
async function disableStudent(userId) {
    if (!confirm('Are you sure you want to disable this student?')) return;
    
    try {
        showLoading();
        
        await apiRequest(`/admin/disable-user/${userId}`, { method: 'PUT' });
        
        showToast('Student disabled', 'info');
        await loadStudents();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error disabling student:', error);
        showToast('Error disabling student', 'error');
    } finally {
        hideLoading();
    }
}

// Generate report
// async function generateReport() {
//     showToast('Report generation coming soon', 'info');
// }

// // Download CSV
// async function downloadCSV() {
//     showToast('CSV download coming soon', 'info');
// }

// Show loading indicator
function showLoading() {
    let loader = document.getElementById('adminLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'adminLoader';
        loader.className = 'global-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
}

// Hide loading indicator
function hideLoading() {
    const loader = document.getElementById('adminLoader');
    if (loader) {
        loader.remove();
    }
}

// Recent Activity Feed Functions
async function loadRecentActivity() {
    try {
        const activityContainer = document.getElementById('activityList');
        if (!activityContainer) return;
        
        const response = await apiRequest('/admin/activity');
        const logs = response.data || [];
        
        if (logs.length === 0) {
            activityContainer.innerHTML = '<div class="text-center">No recent activity logs.</div>';
            return;
        }
        
        const icons = {
            student_registered: 'fas fa-user-plus',
            teacher_registered: 'fas fa-id-badge',
            teacher_approved: 'fas fa-check-circle',
            session_started: 'fas fa-play-circle',
            session_ended: 'fas fa-stop-circle',
            settings_updated: 'fas fa-cog',
            user_disabled: 'fas fa-ban'
        };
        
        activityContainer.innerHTML = '';
        logs.forEach(log => {
            const timeStr = new Date(log.timestamp).toLocaleString();
            const logClass = log.type || 'settings_updated';
            const iconClass = icons[log.type] || 'fas fa-info-circle';
            
            const activityItem = document.createElement('div');
            activityItem.className = `activity-item ${logClass}`;
            activityItem.innerHTML = `
                <div class="activity-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">${log.title || 'System Log'}</div>
                    <div class="activity-desc">${log.description || ''}</div>
                    <div class="activity-time">${timeStr}</div>
                </div>
            `;
            activityContainer.appendChild(activityItem);
        });
    } catch (error) {
        console.error('Error loading activity logs:', error);
    }
}

// Settings Loading and Management
async function loadSettings() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        if (user) {
            document.getElementById('adminSettingsName').value = user.name || '';
            document.getElementById('adminSettingsEmail').value = user.email || '';
        }
        
        const response = await apiRequest('/admin/settings');
        const settings = response.data;
        if (!settings) return;
        
        document.getElementById('maxAllowedRadius').value = settings.maxAllowedRadius || 1000;
        document.getElementById('sessionDuration').value = settings.sessionDuration || 5;
        document.getElementById('qrRefreshInterval').value = settings.qrRefreshInterval || 10;
        document.getElementById('minAttendanceAlert').value = settings.minAttendanceAlert || 75;
        
        document.getElementById('lowAttendanceAlerts').checked = settings.lowAttendanceAlerts !== false;
        document.getElementById('newTeacherRegistration').checked = settings.newTeacherRegistration !== false;
        document.getElementById('sessionReports').checked = settings.sessionReports === true;
        
        document.getElementById('teacherVerificationCode').value = settings.teacherVerificationCode || 'TEACH2024SECURE';
        document.getElementById('masterAdminCode').value = settings.masterAdminCode || 'SUPER_ADMIN_2024';
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Error loading settings', 'error');
    }
}

async function saveSystemSettings() {
    try {
        showLoading();
        const maxAllowedRadius = parseInt(document.getElementById('maxAllowedRadius').value);
        const sessionDuration = parseInt(document.getElementById('sessionDuration').value);
        const qrRefreshInterval = parseInt(document.getElementById('qrRefreshInterval').value);
        const minAttendanceAlert = parseInt(document.getElementById('minAttendanceAlert').value);
        
        await apiRequest('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ maxAllowedRadius, sessionDuration, qrRefreshInterval, minAttendanceAlert })
        });
        
        showToast('System settings saved successfully!', 'success');
        await loadSettings();
        await loadRecentActivity();
    } catch (error) {
        console.error('Error saving system settings:', error);
        showToast('Error saving settings: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function saveAccessCodes() {
    try {
        showLoading();
        const teacherVerificationCode = document.getElementById('teacherVerificationCode').value;
        const masterAdminCode = document.getElementById('masterAdminCode').value;
        
        await apiRequest('/admin/access-codes', {
            method: 'PUT',
            body: JSON.stringify({ teacherVerificationCode, masterAdminCode })
        });
        
        showToast('Access codes updated successfully!', 'success');
        await loadSettings();
        await loadRecentActivity();
    } catch (error) {
        console.error('Error saving access codes:', error);
        showToast('Error saving access codes: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function saveNotificationSettings() {
    try {
        showLoading();
        const lowAttendanceAlerts = document.getElementById('lowAttendanceAlerts').checked;
        const newTeacherRegistration = document.getElementById('newTeacherRegistration').checked;
        const sessionReports = document.getElementById('sessionReports').checked;
        
        await apiRequest('/admin/notifications', {
            method: 'PUT',
            body: JSON.stringify({ lowAttendanceAlerts, newTeacherRegistration, sessionReports })
        });
        
        showToast('Notification preferences saved!', 'success');
        await loadSettings();
    } catch (error) {
        console.error('Error saving notification preferences:', error);
        showToast('Error saving notification preferences', 'error');
    } finally {
        hideLoading();
    }
}

async function updateAdminPassword() {
    try {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        
        if (!currentPassword || !newPassword) {
            showToast('Please enter both current and new passwords', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showToast('New password must be at least 6 characters', 'error');
            return;
        }
        
        showLoading();
        await apiRequest('/users/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        showToast('Password updated successfully!', 'success');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
    } catch (error) {
        console.error('Error updating password:', error);
        showToast('Error updating password: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    const btnIcon = input.nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        btnIcon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        btnIcon.className = 'fas fa-eye';
    }
}

// Danger Zone Confirmations
async function confirmClearSessions() {
    const confirmPhrase = 'DELETE SESSIONS';
    const check = prompt(`WARNING: This will purge all attendance sessions and check-in logs permanently!\nTo confirm, type: "${confirmPhrase}"`);
    if (check !== confirmPhrase) {
        showToast('Operation cancelled. Input did not match.', 'info');
        return;
    }
    
    try {
        showLoading();
        await apiRequest('/admin/clear-sessions', { method: 'POST' });
        showToast('All attendance sessions and records cleared.', 'success');
        await loadDashboardStats();
        await loadRecentActivity();
    } catch (error) {
        console.error('Error clearing sessions:', error);
        showToast('Error clearing sessions', 'error');
    } finally {
        hideLoading();
    }
}

async function confirmRemoveStudents() {
    const confirmPhrase = 'PURGE STUDENTS';
    const check = prompt(`CRITICAL WARNING: This will permanently delete all student accounts from the system!\nTo confirm, type: "${confirmPhrase}"`);
    if (check !== confirmPhrase) {
        showToast('Operation cancelled. Input did not match.', 'info');
        return;
    }
    
    try {
        showLoading();
        await apiRequest('/admin/remove-students', { method: 'POST' });
        showToast('All student accounts permanently purged.', 'success');
        await loadStudents();
        await loadDashboardStats();
        await loadRecentActivity();
    } catch (error) {
        console.error('Error purging students:', error);
        showToast('Error purging students', 'error');
    } finally {
        hideLoading();
    }
}

// Attendance Records Rendering
let adminSubjectsMap = new Map();
async function loadAdminAttendanceRecords() {
    const tbody = document.getElementById('adminAttendanceTableBody');
    const subjectFilter = document.getElementById('adminAttendanceSubjectFilter');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading records...</td></tr>';
    
    try {
        if (subjectFilter.options.length <= 1) {
            const subRes = await apiRequest('/teacher/subjects');
            const subjects = subRes.data || [];
            subjects.forEach(sub => {
                adminSubjectsMap.set(sub._id.toString(), sub);
                const opt = document.createElement('option');
                opt.value = sub._id;
                opt.textContent = `${sub.name} (${sub.code})`;
                subjectFilter.appendChild(opt);
            });
        }
        
        const dateVal = document.getElementById('adminAttendanceDateFilter').value;
        const subVal = subjectFilter.value;
        const secVal = document.getElementById('adminAttendanceSectionFilter').value;
        
        const params = {};
        if (dateVal) {
            const start = new Date(dateVal);
            start.setHours(0,0,0,0);
            const end = new Date(dateVal);
            end.setHours(23,59,59,999);
            params.startDate = start.toISOString();
            params.endDate = end.toISOString();
        }
        if (subVal && subVal !== 'all') {
            params.subjectId = subVal;
        }
        
        const recRes = await apiRequest('/teacher/attendance-records', {
            method: 'GET'
        });
        let records = recRes.data || [];
        
        if (secVal && secVal !== 'all') {
            records = records.filter(r => r.studentId?.section === secVal);
        }
        if (subVal && subVal !== 'all') {
            records = records.filter(r => (r.subjectId?._id === subVal || r.subjectId === subVal));
        }
        if (dateVal) {
            const filterDateStr = new Date(dateVal).toDateString();
            records = records.filter(r => new Date(r.timestamp).toDateString() === filterDateStr);
        }
        
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No attendance records found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        records.forEach(rec => {
            const dateStr = new Date(rec.timestamp).toLocaleDateString();
            const timeStr = new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const studentName = rec.studentId?.name || 'Unknown';
            const rollNo = rec.studentId?.rollNumber || 'N/A';
            const section = rec.studentId?.section || 'N/A';
            const subjectName = rec.subjectId?.name ? `${rec.subjectId.name} (${rec.subjectId.code || ''})` : 'General';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dateStr} ${timeStr}</td>
                <td>${studentName}</td>
                <td>${rollNo}</td>
                <td>${section}</td>
                <td>${subjectName}</td>
                <td><span class="status-badge status-present">✓ Present</span></td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading admin attendance records:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading records.</td></tr>';
    }
}

async function clearAdminAttendanceFilters() {
    document.getElementById('adminAttendanceDateFilter').value = '';
    document.getElementById('adminAttendanceSubjectFilter').value = 'all';
    document.getElementById('adminAttendanceSectionFilter').value = 'all';
    await loadAdminAttendanceRecords();
}

// Export functions
window.showSection = showSection;
window.filterStudents = filterStudents;
window.approveTeacher = approveTeacher;
window.rejectTeacher = rejectTeacher;
window.disableTeacher = disableTeacher;
window.disableStudent = disableStudent;
window.toggleDarkMode = toggleDarkMode;
window.loadRecentActivity = loadRecentActivity;
window.loadSettings = loadSettings;
window.saveSystemSettings = saveSystemSettings;
window.saveAccessCodes = saveAccessCodes;
window.saveNotificationSettings = saveNotificationSettings;
window.updateAdminPassword = updateAdminPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.confirmClearSessions = confirmClearSessions;
window.confirmRemoveStudents = confirmRemoveStudents;
window.loadAdminAttendanceRecords = loadAdminAttendanceRecords;
window.clearAdminAttendanceFilters = clearAdminAttendanceFilters;