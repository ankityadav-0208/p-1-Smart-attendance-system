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
    
    // ✅ Load subjects for dropdown
    await loadTeacherSubjects();
}

// Setup settings page
async function setupSettings() {
    try {
        const response = await apiRequest('/users/profile/me');
        if (response.success && response.data) {
            const user = response.data;
            document.getElementById('settingsName').value = user.name || '';
            document.getElementById('settingsEmail').value = user.email || '';
            document.getElementById('settingsDepartment').value = user.department || 'Faculty';
            const employeeIdField = document.getElementById('settingsEmployeeId');
            if (employeeIdField) employeeIdField.value = user.employeeId || 'N/A';
            
            document.getElementById('defaultRadius').value = user.defaultAllowedRadius !== undefined ? user.defaultAllowedRadius : 1000;
            document.getElementById('defaultDuration').value = user.defaultSessionDuration !== undefined ? user.defaultSessionDuration : 5;
            document.getElementById('defaultLatitude').value = user.defaultLocation?.latitude !== undefined ? user.defaultLocation.latitude : 29.171743;
            document.getElementById('defaultLongitude').value = user.defaultLocation?.longitude !== undefined ? user.defaultLocation.longitude : 75.735818;
        }
    } catch (error) {
        console.error('Error setting up settings:', error);
        // Fallback to sessionStorage
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        if (user) {
            document.getElementById('settingsName').value = user.name || '';
            document.getElementById('settingsEmail').value = user.email || '';
            document.getElementById('settingsDepartment').value = user.department || 'Faculty';
            const employeeIdField = document.getElementById('settingsEmployeeId');
            if (employeeIdField) employeeIdField.value = user.employeeId || 'N/A';
        }
    }
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
        subjectAnalytics: 'Subject Analytics',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    if (section === 'attendance') loadAttendanceRecords();
    if (section === 'students') loadStudents();
    if (section === 'subjectAnalytics') loadTeacherSubjectAnalytics();
    if (section === 'settings') setupSettings();
}

// Load dashboard statistics - Using API
async function loadDashboardStats() {
    try {
        const response = await apiRequest('/teacher/dashboard-overview');
        if (!response.success) {
            throw new Error(response.message || 'Failed to fetch overview data');
        }
        
        const subjectsData = response.data || [];
        
        // 1. Calculate aggregate stats for top cards
        let totalStudentsCount = 0;
        let todayPresentCount = 0;
        let todayStudentsWithSession = 0;
        let avgAttendanceSum = 0;
        
        subjectsData.forEach(sub => {
            totalStudentsCount += sub.totalStudents || 0;
            if (sub.todayAttendance?.hasSession) {
                todayPresentCount += sub.todayAttendance.presentCount || 0;
                todayStudentsWithSession += sub.totalStudents || 0;
            }
            avgAttendanceSum += sub.averageAttendance || 0;
        });
        
        // Populate top cards
        document.getElementById('totalStudents').textContent = totalStudentsCount;
        
        // Today's Attendance card
        if (todayStudentsWithSession > 0) {
            const todayPercentage = (todayPresentCount / todayStudentsWithSession) * 100;
            document.getElementById('todayAttendance').textContent = todayPercentage.toFixed(1) + '%';
        } else {
            document.getElementById('todayAttendance').textContent = 'No Sessions';
        }
        
        // Average Attendance card
        if (subjectsData.length > 0) {
            const overallAverage = avgAttendanceSum / subjectsData.length;
            document.getElementById('avgAttendance').textContent = overallAverage.toFixed(1) + '%';
        } else {
            document.getElementById('avgAttendance').textContent = '0%';
        }
        
        // 2. Populate "My Subjects Overview" table
        const tbody = document.getElementById('mySubjectsOverviewBody');
        if (tbody) {
            tbody.innerHTML = '';
            
            if (subjectsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No subjects assigned to you.</td></tr>';
            } else {
                subjectsData.forEach(sub => {
                    const row = document.createElement('tr');
                    
                    let todayText = '';
                    if (sub.todayAttendance?.hasSession) {
                        todayText = `<span style="font-weight: 600; color: var(--success);">${sub.todayAttendance.percentage}%</span> (${sub.todayAttendance.presentCount}/${sub.totalStudents})`;
                    } else {
                        todayText = `<span style="color: var(--text-secondary); font-style: italic;">No session</span>`;
                    }
                    
                    row.innerHTML = `
                        <td><strong>${sub.code}</strong></td>
                        <td>${sub.name}</td>
                        <td>Semester ${sub.semester}</td>
                        <td>Section ${sub.section}</td>
                        <td>${sub.totalStudents}</td>
                        <td>${todayText}</td>
                        <td><strong>${(sub.averageAttendance || 0).toFixed(1)}%</strong></td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Subject Analytics Variables
let teacherSubjectChart = null;
let departmentChart = null;
let teacherSubjectData = [];

// Load teacher subject analytics
async function loadTeacherSubjectAnalytics() {
    try {
        console.log('📊 Loading teacher subject analytics...');
        
        const response = await apiRequest('/analytics/subject-attendance');
        const subjects = response.data;
        
        console.log('Subjects data:', subjects);
        
        teacherSubjectData = subjects;
        
        // Populate subject filter
        const subjectFilter = document.getElementById('subjectFilter');
        if (subjectFilter) {
            subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.subjectId;
                option.textContent = `${subject.subjectName} (${subject.subjectCode}) - ${subject.averageAttendance}%`;
                subjectFilter.appendChild(option);
            });
        }
        
        // Render charts
        renderTeacherSubjectChart(subjects);
        renderDepartmentChart(subjects);
        renderTeacherSubjectCards(subjects);
        renderLowAttendanceAlert(subjects);
        
    } catch (error) {
        console.error('Error loading teacher subject analytics:', error);
        showToast('Error loading subject analytics', 'error');
    }
}

// Render subject-wise bar chart for teacher
function renderTeacherSubjectChart(subjects) {
    const canvas = document.getElementById('teacherSubjectChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (teacherSubjectChart) {
        teacherSubjectChart.destroy();
    }
    
    const labels = subjects.map(s => s.subjectName);
    const percentages = subjects.map(s => parseFloat(s.averageAttendance));
    
    const backgroundColors = percentages.map(p => {
        if (p >= 75) return 'rgba(40, 167, 69, 0.7)';
        if (p >= 60) return 'rgba(255, 193, 7, 0.7)';
        return 'rgba(220, 53, 69, 0.7)';
    });
    
    teacherSubjectChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Attendance (%)',
                data: percentages,
                backgroundColor: backgroundColors,
                borderColor: '#333',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Attendance (%)' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const subject = subjects[context.dataIndex];
                            return [
                                `Average: ${subject.averageAttendance}%`,
                                `Total Students: ${subject.totalStudents}`,
                                `Total Sessions: ${subject.totalSessions}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// Render department-wise chart
function renderDepartmentChart(subjects) {
    const canvas = document.getElementById('departmentChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (departmentChart) {
        departmentChart.destroy();
    }
    
    // Group by department
    const deptMap = new Map();
    subjects.forEach(subject => {
        const dept = subject.department || 'General';
        if (!deptMap.has(dept)) {
            deptMap.set(dept, { total: 0, count: 0 });
        }
        const current = deptMap.get(dept);
        current.total += parseFloat(subject.averageAttendance);
        current.count++;
    });
    
    const departments = Array.from(deptMap.keys());
    const averages = departments.map(dept => 
        (deptMap.get(dept).total / deptMap.get(dept).count).toFixed(1)
    );
    
    departmentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: departments,
            datasets: [{
                label: 'Average Attendance by Department (%)',
                data: averages,
                backgroundColor: '#4a90e2',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Attendance (%)' }
                }
            }
        }
    });
}

// Render subject performance cards for teacher
function renderTeacherSubjectCards(subjects) {
    const container = document.getElementById('teacherSubjectCards');
    if (!container) return;
    
    if (subjects.length === 0) {
        container.innerHTML = '<div class="glass-effect" style="padding: 20px; text-align: center;">No subjects found</div>';
        return;
    }
    
    container.innerHTML = '';
    
    subjects.forEach(subject => {
        const percentage = parseFloat(subject.averageAttendance);
        let statusClass = 'good';
        let statusText = 'Good';
        
        if (percentage < 60) {
            statusClass = 'critical';
            statusText = 'Critical - Needs Improvement';
        } else if (percentage < 75) {
            statusClass = 'warning';
            statusText = 'Warning - Below Target';
        } else {
            statusClass = 'good';
            statusText = 'On Target';
        }
        
        const card = document.createElement('div');
        card.className = 'glass-effect';
        card.style.padding = '15px';
        card.style.borderRadius = '10px';
        card.style.borderLeft = `4px solid ${percentage >= 75 ? '#28a745' : (percentage >= 60 ? '#ffc107' : '#dc3545')}`;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">${subject.subjectName}</h4>
                    <p style="color: #666; font-size: 12px;">${subject.subjectCode} | Semester ${subject.semester}</p>
                    <p style="color: #666; font-size: 12px;">Department: ${subject.department}</p>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 28px; font-weight: bold; color: ${percentage >= 75 ? '#28a745' : (percentage >= 60 ? '#ffc107' : '#dc3545')};">${percentage}%</span>
                </div>
            </div>
            <div style="margin-top: 10px; display: flex; justify-content: space-between;">
                <div>Students: ${subject.totalStudents}</div>
                <div>Sessions: ${subject.totalSessions}</div>
                <div>Present: ${subject.totalPresent}</div>
            </div>
            <div style="margin-top: 8px;">
                <span style="font-size: 12px; color: ${percentage >= 75 ? '#28a745' : (percentage >= 60 ? '#856404' : '#dc3545')};">Status: ${statusText}</span>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Render low attendance alert
function renderLowAttendanceAlert(subjects) {
    const container = document.getElementById('lowAttendanceList');
    if (!container) return;
    
    const lowSubjects = subjects.filter(s => parseFloat(s.averageAttendance) < 75);
    
    if (lowSubjects.length === 0) {
        container.innerHTML = '<p class="text-success">✅ All subjects have attendance above 75%</p>';
        document.getElementById('lowAttendanceAlert').style.background = '#d4edda';
        document.getElementById('lowAttendanceAlert').style.borderColor = '#c3e6cb';
        return;
    }
    
    document.getElementById('lowAttendanceAlert').style.background = '#fff3cd';
    document.getElementById('lowAttendanceAlert').style.borderColor = '#ffeeba';
    
    container.innerHTML = lowSubjects.map(subject => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #ffeeba;">
            <div>
                <strong>${subject.subjectName}</strong> (${subject.subjectCode})
            </div>
            <div style="color: #dc3545; font-weight: bold;">
                ${subject.averageAttendance}% 
                <span style="font-size: 12px;">(Need ${(75 - parseFloat(subject.averageAttendance)).toFixed(1)}% improvement)</span>
            </div>
        </div>
    `).join('');
}

// Filter teacher subject attendance
async function filterTeacherSubjectAttendance() {
    const subjectId = document.getElementById('subjectFilter')?.value || 'all';
    
    let filteredData = [...teacherSubjectData];
    
    if (subjectId !== 'all') {
        filteredData = filteredData.filter(s => s.subjectId === subjectId);
    }
    
    renderTeacherSubjectChart(filteredData);
    renderTeacherSubjectCards(filteredData);
}

// Load subjects for dropdown
async function loadTeacherSubjects() {
    try {
        const response = await apiRequest('/teacher/subjects');
        const subjects = response.data || [];
        
        const subjectSelect = document.getElementById('sessionSubject');
        if (!subjectSelect) return;
        
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject._id;
            option.textContent = `${subject.name} (${subject.code}) - Semester ${subject.semester}`;
            subjectSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

// This function can be used to update existing attendance records with subject info
// Run this once after deployment
async function updateExistingAttendanceWithSubject() {
    try {
        console.log('Updating existing attendance records with subject info...');
        
        const recordsResponse = await apiRequest('/teacher/attendance-records');
        const records = recordsResponse.data || [];
        
        let updated = 0;
        
        for (const record of records) {
            // Get session to find subject
            const session = await apiRequest(`/teacher/active-sessions`);
            // Note: This requires a session lookup endpoint
        }
        
        console.log(`Updated ${updated} records`);
    } catch (error) {
        console.error('Error updating records:', error);
    }
}

// Start attendance session - Using API (WITH SUBJECT)
async function startAttendance() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Get selected subject
        const subjectSelect = document.getElementById('sessionSubject');
        const subjectId = subjectSelect?.value;
        const subjectName = subjectSelect?.options[subjectSelect.selectedIndex]?.text || 'No Subject';
        
        if (!subjectId) {
            showToast('Please select a subject before starting attendance', 'warning');
            return;
        }
        
        console.log('📤 Starting attendance session for subject:', subjectName);
        
        const response = await apiRequest('/teacher/start-session', {
            method: 'POST',
            body: JSON.stringify({ 
                subjectId: subjectId  // ✅ Include subject ID, let backend fallback to presets
            })
        });

        const sessionData = response.data;
        currentSession = {
            id: sessionData.sessionId,
            sessionToken: sessionData.sessionToken,
            expiresAt: sessionData.expiresAt,
            subjectId: subjectId,
            subjectName: subjectName
        };

        generateQRCode(sessionData.sessionId, sessionData.sessionToken);
        
        document.getElementById('stopBtn').disabled = false;
        document.querySelector('button[onclick="startAttendance()"]').disabled = true;
        
        document.getElementById('qrContainer').classList.remove('hidden');
        document.getElementById('sessionId').textContent = sessionData.sessionId;
        document.getElementById('sessionSubjectName').textContent = subjectName;
        
        startQRTimer();
        
        showToast(`Attendance session started for ${subjectName}`, 'success');
        
        // Disable subject selection during active session
        subjectSelect.disabled = true;
        
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
    let timeLeft = 300; // fallback 5 minutes
    if (currentSession && currentSession.expiresAt) {
        const expiresTime = new Date(currentSession.expiresAt).getTime();
        timeLeft = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
    }
    const timerElement = document.getElementById('qrTimer');

    qrRefreshInterval = setInterval(async () => {
        timeLeft--;

        const minutes = Math.max(0, Math.floor(timeLeft / 60));
        const seconds = Math.max(0, timeLeft % 60);
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Refresh QR every 5 seconds - get new token from DB so validation works
        if (timeLeft > 0 && timeLeft % 5 === 0 && currentSession) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `${API.baseURL}/teacher/refresh-token/${currentSession.id}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                const data = await response.json();
                if (data.success) {
                    currentSession.sessionToken = data.data.sessionToken;
                    generateQRCode(currentSession.id, currentSession.sessionToken);
                }
            } catch (err) {
                console.error('QR refresh failed:', err);
            }
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
        
        // ✅ Re-enable subject selection
        const subjectSelect = document.getElementById('sessionSubject');
        if (subjectSelect) subjectSelect.disabled = false;
        
        showToast('Attendance session ended', 'info');
        
        loadDashboardStats();
        loadAttendanceRecords();
        loadTeacherSubjects(); // Refresh subjects (in case any were added)
        
    } catch (error) {
        console.error('Error stopping session:', error);
        showToast('Failed to stop session', 'error');
    }
}

// Load attendance records - Session-wise view
async function loadAttendanceRecords() {
    try {
        showLoading();
        
        // Get session-wise attendance data from backend
        const response = await apiRequest('/teacher/session-attendance');
        const sessions = response.data || [];

        console.log('Sessions data:', sessions);

        // Populate subject filter
        const subjectFilter = document.getElementById('attendanceSubjectFilter');
        if (subjectFilter && sessions.length > 0) {
            const subjects = [...new Set(sessions.map(s => s.subject))];
            subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectFilter.appendChild(option);
            });
        }

        // Store sessions globally for filtering
        window.allAttendanceSessions = sessions;
        
        // Render the table
        renderAttendanceTable(sessions);
        
    } catch (error) {
        console.error('Error loading attendance records:', error);
        showToast('Error loading attendance records', 'error');
    } finally {
        hideLoading();
    }
}

// Render attendance table
function renderAttendanceTable(sessions) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No attendance records found</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    sessions.forEach((session) => {
        const row = document.createElement('tr');
        row.className = 'attendance-row';
        row.style.cursor = 'pointer';
        
        // Determine percentage color class
        let percentClass = '';
        const percent = parseFloat(session.attendancePercentage);
        if (percent >= 75) percentClass = 'attendance-good';
        else if (percent >= 60) percentClass = 'attendance-warning';
        else percentClass = 'attendance-critical';
        
        // Present button: shows "presentCount / totalStudents"
        const presentButton = `<button class="btn-view-students present" onclick="event.stopPropagation(); showStudentList('present', ${JSON.stringify(session.presentStudents).replace(/"/g, '&quot;')})">
            ${session.presentCount} / ${session.totalStudents}
        </button>`;
        
        // Absent button: shows "absentCount / totalStudents"
        const absentButton = `<button class="btn-view-students absent" onclick="event.stopPropagation(); showStudentList('absent', ${JSON.stringify(session.absentStudents).replace(/"/g, '&quot;')})">
            ${session.absentCount} / ${session.totalStudents}
        </button>`;
        
        row.innerHTML = `
            <td><strong>${session.date}</strong></td>
            <td>${session.time}</td>
            <td><strong>${session.subject}</strong><br><small>${session.subjectCode || ''}</small></td>
            <td class="students-cell">${presentButton}</td>
            <td class="students-cell">${absentButton}</td>
            <td class="${percentClass}"><strong>${session.attendancePercentage}%</strong></td>
        `;
        
        // Add click event to show full session details (optional)
        row.addEventListener('click', () => showSessionDetails(session));
        
        tbody.appendChild(row);
    });
}

// Show student list in modal (for present/absent buttons)
function showStudentList(type, students) {
    const modal = document.getElementById('sessionDetailsModal');
    const title = document.getElementById('sessionModalTitle');
    const content = document.getElementById('sessionModalContent');
    
    const titleText = type === 'present' ? '✅ Present Students' : '❌ Absent Students';
    title.textContent = titleText;
    
    if (!students || students.length === 0) {
        content.innerHTML = '<div class="session-detail-group"><p class="text-center">No students found</p></div>';
        modal.style.display = 'block';
        return;
    }
    
    // Create a nice table layout
    let html = `
        <div class="student-list-table-container">
            <table class="student-list-table">
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Section</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    students.forEach((student, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${student.rollNumber || 'N/A'}</td>
                <td><strong>${student.name}</strong></td>
                <td>${student.section || 'N/A'}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="student-list-footer">
            <strong>Total: ${students.length} student${students.length !== 1 ? 's' : ''}</strong>
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'block';
}

// Show full session details in modal
function showSessionDetails(session) {
    const modal = document.getElementById('sessionDetailsModal');
    const title = document.getElementById('sessionModalTitle');
    const content = document.getElementById('sessionModalContent');
    
    title.textContent = `📅 Session Details - ${session.date} at ${session.time}`;
    
    // Session summary
    let summaryHtml = `
        <div class="session-summary">
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">📚 Subject:</span>
                    <span class="summary-value">${session.subject}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">👥 Total Students:</span>
                    <span class="summary-value">${session.totalStudents}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">✅ Present:</span>
                    <span class="summary-value present-count">${session.presentCount}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">❌ Absent:</span>
                    <span class="summary-value absent-count">${session.absentCount}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">📊 Attendance:</span>
                    <span class="summary-value attendance-percent">${session.attendancePercentage}%</span>
                </div>
            </div>
        </div>
    `;
    
    // Present students table
    let presentHtml = '<div class="student-section"><h4>✅ Present Students</h4>';
    if (session.presentStudents.length === 0) {
        presentHtml += '<p class="text-center">No students present</p>';
    } else {
        presentHtml += `
            <div class="student-list-table-container">
                <table class="student-list-table">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>Roll Number</th>
                            <th>Student Name</th>
                            <th>Section</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        session.presentStudents.forEach((student, index) => {
            presentHtml += `
                <tr class="present-row">
                    <td>${index + 1}</td>
                    <td>${student.rollNumber || 'N/A'}</td>
                    <td><strong>${student.name}</strong></td>
                    <td>${student.section || 'N/A'}</td>
                </tr>
            `;
        });
        presentHtml += `
                    </tbody>
                </table>
            </div>
            <div class="student-list-footer">Total: ${session.presentStudents.length} student${session.presentStudents.length !== 1 ? 's' : ''}</div>
        `;
    }
    presentHtml += '</div>';
    
    // Absent students table
    let absentHtml = '<div class="student-section"><h4>❌ Absent Students</h4>';
    if (session.absentStudents.length === 0) {
        absentHtml += '<p class="text-center">No students absent</p>';
    } else {
        absentHtml += `
            <div class="student-list-table-container">
                <table class="student-list-table">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>Roll Number</th>
                            <th>Student Name</th>
                            <th>Section</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        session.absentStudents.forEach((student, index) => {
            absentHtml += `
                <tr class="absent-row">
                    <td>${index + 1}</td>
                    <td>${student.rollNumber || 'N/A'}</td>
                    <td><strong>${student.name}</strong></td>
                    <td>${student.section || 'N/A'}</td>
                </tr>
            `;
        });
        absentHtml += `
                    </tbody>
                </table>
            </div>
            <div class="student-list-footer">Total: ${session.absentStudents.length} student${session.absentStudents.length !== 1 ? 's' : ''}</div>
        `;
    }
    absentHtml += '</div>';
    
    content.innerHTML = summaryHtml + presentHtml + absentHtml;
    modal.style.display = 'block';
}

// Filter attendance records
async function filterAttendanceRecords() {
    const dateFilter = document.getElementById('attendanceDateFilter').value;
    const subjectFilter = document.getElementById('attendanceSubjectFilter').value;
    
    let filteredSessions = [...(window.allAttendanceSessions || [])];
    
    if (dateFilter) {
        const filterDate = new Date(dateFilter).toLocaleDateString();
        filteredSessions = filteredSessions.filter(session => session.date === filterDate);
    }
    
    if (subjectFilter && subjectFilter !== 'all') {
        filteredSessions = filteredSessions.filter(session => session.subject === subjectFilter);
    }
    
    renderAttendanceTable(filteredSessions);
    
    if (filteredSessions.length === 0) {
        showToast('No records found for the selected filters', 'info');
    }
}

// Clear attendance filters
function clearAttendanceFilters() {
    document.getElementById('attendanceDateFilter').value = '';
    document.getElementById('attendanceSubjectFilter').value = 'all';
    renderAttendanceTable(window.allAttendanceSessions || []);
    showToast('Filters cleared', 'info');
}

// Close session details modal
function closeSessionDetailsModal() {
    document.getElementById('sessionDetailsModal').style.display = 'none';
}


// Filter attendance records
async function filterAttendanceRecords() {
    const dateFilter = document.getElementById('attendanceDateFilter').value;
    const subjectFilter = document.getElementById('attendanceSubjectFilter').value;
    
    let filteredSessions = [...(window.allAttendanceSessions || [])];
    
    if (dateFilter) {
        const filterDate = new Date(dateFilter).toLocaleDateString();
        filteredSessions = filteredSessions.filter(session => session.date === filterDate);
    }
    
    if (subjectFilter && subjectFilter !== 'all') {
        filteredSessions = filteredSessions.filter(session => session.subjectId === subjectFilter);
    }
    
    renderAttendanceTable(filteredSessions);
    
    if (filteredSessions.length === 0) {
        showToast('No records found for the selected filters', 'info');
    }
}

// Clear attendance filters
function clearAttendanceFilters() {
    document.getElementById('attendanceDateFilter').value = '';
    document.getElementById('attendanceSubjectFilter').value = 'all';
    renderAttendanceTable(window.allAttendanceSessions || []);
    showToast('Filters cleared', 'info');
}

// Load students - Using API (FIXED - No Duplicates)
async function loadStudents() {
    try {
        const response = await apiRequest('/teacher/students');
        let students = response.data || [];

        // Remove duplicates by student ID
        const uniqueStudents = new Map();
        students.forEach(student => {
            if (!uniqueStudents.has(student._id)) {
                uniqueStudents.set(student._id, student);
            }
        });
        students = Array.from(uniqueStudents.values());
        
        console.log('Unique students count:', students.length);

        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        for (const student of students) {
            const percentageFormatted = (student.attendancePercentage ?? 0).toFixed(1);
            const lastAttendanceDate = student.lastAttendanceDate === 'Never' || !student.lastAttendanceDate
                ? 'Never'
                : new Date(student.lastAttendanceDate).toLocaleDateString();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.name}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${percentageFormatted}%</td>
                <td>${lastAttendanceDate}</td>
            `;
            tbody.appendChild(row);
        }

        loadSections();
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('Error loading students: ' + error.message, 'error');
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

// Filter students - FIXED (No Duplicates)
async function filterStudents() {
    const section = document.getElementById('sectionFilter').value;
    const search = document.getElementById('searchStudent').value.toLowerCase();

    try {
        const response = await apiRequest('/teacher/students');
        let students = response.data || [];
        
        // Remove duplicates by student ID
        const uniqueStudents = new Map();
        students.forEach(student => {
            if (!uniqueStudents.has(student._id)) {
                uniqueStudents.set(student._id, student);
            }
        });
        students = Array.from(uniqueStudents.values());
        
        // Apply filters
        students = students.filter(student => {
            if (section && student.section !== section) return false;
            if (search && !student.name.toLowerCase().includes(search) && 
                !student.rollNumber?.toLowerCase().includes(search)) return false;
            return true;
        });

        const tbody = document.getElementById('studentsTableBody');
        tbody.innerHTML = '';

        for (const student of students) {
            const percentageFormatted = (student.attendancePercentage ?? 0).toFixed(1);
            const lastAttendanceDate = student.lastAttendanceDate === 'Never' || !student.lastAttendanceDate
                ? 'Never'
                : new Date(student.lastAttendanceDate).toLocaleDateString();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.rollNumber || 'N/A'}</td>
                <td>${student.name}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${percentageFormatted}%</td>
                <td>${lastAttendanceDate}</td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Error filtering students:', error);
    }
}


// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Change password - Using API Form
async function updateTeacherPassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    
    if (!currentPassword || !newPassword) {
        showToast('Please fill all password fields', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        showLoading();
        const response = await apiRequest('/users/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        if (response.success) {
            showToast('Password updated successfully', 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
        }
    } catch (error) {
        console.error('Password update error:', error);
        showToast(error.message || 'Error updating password', 'error');
    } finally {
        hideLoading();
    }
}

// Toggle password visibility
function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    if (!input) return;
    
    const button = input.parentElement.querySelector('.toggle-password-btn');
    const icon = button ? button.querySelector('i') : null;
    
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// Get current location coordinates
function getCurrentLocationPresets() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    showToast('Getting current location...', 'info');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById('defaultLatitude').value = position.coords.latitude.toFixed(6);
            document.getElementById('defaultLongitude').value = position.coords.longitude.toFixed(6);
            showToast('GPS coordinates fetched successfully', 'success');
        },
        (error) => {
            console.error('Error getting location:', error);
            showToast('Failed to get location: ' + error.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// Save teacher presets
async function saveTeacherPresets() {
    const defaultAllowedRadius = parseInt(document.getElementById('defaultRadius').value, 10);
    const defaultSessionDuration = parseInt(document.getElementById('defaultDuration').value, 10);
    const lat = parseFloat(document.getElementById('defaultLatitude').value);
    const lon = parseFloat(document.getElementById('defaultLongitude').value);
    
    if (isNaN(defaultAllowedRadius) || defaultAllowedRadius < 5) {
        showToast('Default Radius must be a number of at least 5 meters', 'error');
        return;
    }
    
    if (isNaN(defaultSessionDuration) || defaultSessionDuration < 1) {
        showToast('Default Session Duration must be a number of at least 1 minute', 'error');
        return;
    }
    
    if (isNaN(lat) || isNaN(lon)) {
        showToast('Please enter valid location coordinates', 'error');
        return;
    }
    
    try {
        showLoading();
        const response = await apiRequest('/users/profile', {
            method: 'PUT',
            body: JSON.stringify({
                defaultAllowedRadius,
                defaultSessionDuration,
                defaultLocation: {
                    latitude: lat,
                    longitude: lon
                }
            })
        });
        
        if (response.success) {
            showToast('Presets saved successfully', 'success');
            await setupSettings();
        }
    } catch (error) {
        console.error('Error saving teacher presets:', error);
        showToast(error.message || 'Error saving presets', 'error');
    } finally {
        hideLoading();
    }
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
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
window.toggleDarkMode = toggleDarkMode;
window.filterAttendanceRecords = filterAttendanceRecords;
window.clearAttendanceFilters = clearAttendanceFilters;
window.closeSessionDetailsModal = closeSessionDetailsModal;
window.showStudentList = showStudentList;
window.updateTeacherPassword = updateTeacherPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.getCurrentLocationPresets = getCurrentLocationPresets;
window.saveTeacherPresets = saveTeacherPresets;