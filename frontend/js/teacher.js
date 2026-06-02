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
        subjectAnalytics: 'Subject Analytics',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    if (section === 'attendance') loadAttendanceRecords();
    if (section === 'students') loadStudents();
    if (section === 'subjectAnalytics') loadTeacherSubjectAnalytics();
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

        // loadAttendanceChart is disabled - chart removed
        // loadAttendanceChart();
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
        
        // Get classroom location from user or default
        const classroomLocation = {
            latitude: 29.171743,
            longitude: 75.735818
        };
        
        console.log('📤 Starting attendance session for subject:', subjectName);
        
        const response = await apiRequest('/teacher/start-session', {
            method: 'POST',
            body: JSON.stringify({ 
                classroomLocation,
                allowedRadius: 1000,
                subjectId: subjectId  // ✅ Include subject ID
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
    let timeLeft = 300;
    const timerElement = document.getElementById('qrTimer');
    
    qrRefreshInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft % 120 === 0 && currentSession) {
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
        
        // Get session-wise attendance data
        const response = await apiRequest('/teacher/session-attendance');
        const sessions = response.data || [];

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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No attendance records found</td></tr>';
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
        
        // Create present button
        const presentButton = `<button class="btn-view-students present" onclick="event.stopPropagation(); showStudentList('present', ${JSON.stringify(session.presentStudents).replace(/"/g, '&quot;')})">
            ${session.presentCount} / ${session.totalStudents}
        </button>`;
        
        // Create absent button
        const absentButton = `<button class="btn-view-students absent" onclick="event.stopPropagation(); showStudentList('absent', ${JSON.stringify(session.absentStudents).replace(/"/g, '&quot;')})">
            ${session.absentCount}
        </button>`;
        
        row.innerHTML = `
            <td><strong>${session.date}</strong></td>
            <td>${session.time}</td>
            <td><strong>${session.subject}</strong><br><small>${session.subjectCode}</small></td>
            <td class="students-cell">${presentButton}</td>
            <td class="students-cell">${absentButton}</td>
            <td class="${percentClass}"><strong>${session.attendancePercentage}%</strong></td>
        `;
        
        // Add click event to show full session details
        row.addEventListener('click', () => showSessionDetails(session));
        
        tbody.appendChild(row);
    });
}

// Show student list in modal (for present/absent buttons)
function showStudentList(type, students) {
    const modal = document.getElementById('sessionDetailsModal');
    const title = document.getElementById('sessionModalTitle');
    const content = document.getElementById('sessionModalContent');
    
    title.textContent = type === 'present' ? 'Present Students' : 'Absent Students';
    
    let html = '<div class="session-detail-group"><ul>';
    if (students.length === 0) {
        html += '<li>No students</li>';
    } else {
        students.forEach(s => {
            html += `<li><strong>${s.name}</strong> (${s.rollNumber || 'N/A'}) - Section: ${s.section || 'N/A'}</li>`;
        });
    }
    html += '</ul></div>';
    
    content.innerHTML = html;
    modal.style.display = 'block';
}

// Show full session details in modal
function showSessionDetails(session) {
    const modal = document.getElementById('sessionDetailsModal');
    const title = document.getElementById('sessionModalTitle');
    const content = document.getElementById('sessionModalContent');
    
    title.textContent = `Session Details - ${session.date} at ${session.time}`;
    
    // Create present students list
    let presentHtml = '<div class="session-detail-group"><h4>✅ Present Students</h4><ul>';
    session.presentStudents.forEach(s => {
        presentHtml += `<li><strong>${s.name}</strong> (${s.rollNumber || 'N/A'}) - Section: ${s.section || 'N/A'}</li>`;
    });
    presentHtml += '</ul></div>';
    
    // Create absent students list
    let absentHtml = '<div class="session-detail-group"><h4>❌ Absent Students</h4><ul>';
    session.absentStudents.forEach(s => {
        absentHtml += `<li><strong>${s.name}</strong> (${s.rollNumber || 'N/A'}) - Section: ${s.section || 'N/A'}</li>`;
    });
    absentHtml += '</ul></div>';
    
    content.innerHTML = `
        <div style="margin-bottom: 15px;">
            <p><strong>Subject:</strong> ${session.subject}</p>
            <p><strong>Total Students:</strong> ${session.totalStudents}</p>
            <p><strong>Present:</strong> ${session.presentCount}</p>
            <p><strong>Absent:</strong> ${session.absentCount}</p>
            <p><strong>Attendance Percentage:</strong> ${session.attendancePercentage}%</p>
        </div>
        ${presentHtml}
        ${absentHtml}
    `;
    
    modal.style.display = 'block';
}

// Render attendance table
function renderAttendanceTable(sessions) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No attendance records found</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    sessions.forEach((session, index) => {
        const row = document.createElement('tr');
        row.className = 'attendance-row';
        row.setAttribute('data-session-index', index);
        
        // Determine percentage color class
        let percentClass = '';
        const percent = parseFloat(session.attendancePercentage);
        if (percent >= 75) percentClass = 'attendance-good';
        else if (percent >= 60) percentClass = 'attendance-warning';
        else percentClass = 'attendance-critical';
        
        // Create present students preview (first 3)
        let presentPreview = '';
        const previewPresent = session.presentStudents.slice(0, 3);
        previewPresent.forEach(s => {
            presentPreview += `<span class="student-badge present">${s.name}</span>`;
        });
        if (session.presentStudents.length > 3) {
            presentPreview += `<span class="student-badge more">+${session.presentStudents.length - 3} more</span>`;
        }
        if (session.presentStudents.length === 0) {
            presentPreview = '<span class="student-badge empty">None</span>';
        }
        
        // Create absent students preview (first 3)
        let absentPreview = '';
        const previewAbsent = session.absentStudents.slice(0, 3);
        previewAbsent.forEach(s => {
            absentPreview += `<span class="student-badge absent">${s.name}</span>`;
        });
        if (session.absentStudents.length > 3) {
            absentPreview += `<span class="student-badge more">+${session.absentStudents.length - 3} more</span>`;
        }
        if (session.absentStudents.length === 0) {
            absentPreview = '<span class="student-badge empty">All Present</span>';
        }
        
        row.innerHTML = `
            <td><strong>${session.date}</strong><br><small>${session.time}</small></td>
            <td>${session.subject}</td>
            <td class="students-cell present-cell">${presentPreview}</td>
            <td class="students-cell absent-cell">${absentPreview}</td>
            <td>${session.presentCount} / ${session.totalStudents}</td>
            <td class="${percentClass}"><strong>${session.attendancePercentage}%</strong></td>
        `;
        
        // Add click event to show details modal
        row.addEventListener('click', () => showSessionDetails(session));
        
        tbody.appendChild(row);
    });
}

// Show session details in modal
function showSessionDetails(session) {
    const modal = document.getElementById('sessionDetailsModal');
    const title = document.getElementById('sessionModalTitle');
    const content = document.getElementById('sessionModalContent');
    
    title.textContent = `Session Details - ${session.date} at ${session.time}`;
    
    // Create present students list
    let presentHtml = '<div class="session-detail-group"><h4>✅ Present Students</h4><ul>';
    session.presentStudents.forEach(s => {
        presentHtml += `<li><strong>${s.name}</strong> (${s.rollNumber}) - Section: ${s.section}</li>`;
    });
    presentHtml += '</ul></div>';
    
    // Create absent students list
    let absentHtml = '<div class="session-detail-group"><h4>❌ Absent Students</h4><ul>';
    session.absentStudents.forEach(s => {
        absentHtml += `<li><strong>${s.name}</strong> (${s.rollNumber}) - Section: ${s.section}</li>`;
    });
    absentHtml += '</ul></div>';
    
    content.innerHTML = `
        <div style="margin-bottom: 15px;">
            <p><strong>Subject:</strong> ${session.subject}</p>
            <p><strong>Total Students:</strong> ${session.totalStudents}</p>
            <p><strong>Present:</strong> ${session.presentCount}</p>
            <p><strong>Absent:</strong> ${session.absentCount}</p>
            <p><strong>Attendance Percentage:</strong> ${session.attendancePercentage}%</p>
        </div>
        ${presentHtml}
        ${absentHtml}
    `;
    
    modal.style.display = 'block';
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
//window.viewSelfie = viewSelfie;
window.changePassword = changePassword;
window.toggleDarkMode = toggleDarkMode;
window.filterAttendanceRecords = filterAttendanceRecords;
window.clearAttendanceFilters = clearAttendanceFilters;
window.closeSessionDetailsModal = closeSessionDetailsModal;