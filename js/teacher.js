// Teacher Dashboard Functions
let currentSession = null;
let qrRefreshInterval = null;
let chart = null;

// Load teacher data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTeacherData();
    await loadDashboardStats();
    await loadPendingApprovals();
    checkAdminStatus();
});

// Load teacher data
async function loadTeacherData() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('teacherName').textContent = user.name;
    document.getElementById('teacherDepartment').textContent = user.department || 'Faculty';
    
    if (user.profilePhotoURL) {
        document.getElementById('profileImage').src = user.profilePhotoURL;
    }
}

// Check if user is admin
async function checkAdminStatus() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user.role === 'admin') {
        document.getElementById('approvalsLink').style.display = 'block';
    } else {
        document.getElementById('approvalsLink').style.display = 'none';
    }
}

// Show different sections
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    
    // Show selected section
    document.getElementById(`${section}Section`).classList.add('active');
    event.target.classList.add('active');
    
    // Update page title
    const titles = {
        overview: 'Overview',
        attendance: 'Attendance Records',
        students: 'Student Management',
        reports: 'Reports',
        approvals: 'Teacher Approvals',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    // Load section-specific data
    if (section === 'attendance') loadAttendanceRecords();
    if (section === 'students') loadStudents();
    if (section === 'reports') loadSectionsForReport();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Get total students
        const studentsSnapshot = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        document.getElementById('totalStudents').textContent = studentsSnapshot.size;

        // Get today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendanceSnapshot = await db.collection('attendance_records')
            .where('timestamp', '>=', today)
            .get();
        
        const uniqueStudents = new Set();
        attendanceSnapshot.forEach(doc => {
            uniqueStudents.add(doc.data().studentId);
        });
        document.getElementById('todayAttendance').textContent = uniqueStudents.size;

        // Calculate average attendance
        if (studentsSnapshot.size > 0) {
            const avg = (uniqueStudents.size / studentsSnapshot.size) * 100;
            document.getElementById('avgAttendance').textContent = avg.toFixed(1) + '%';
        }

        // Get active sessions
        const sessionsSnapshot = await db.collection('attendance_sessions')
            .where('active', '==', true)
            .get();
        document.getElementById('activeSessions').textContent = sessionsSnapshot.size;

        // Load chart data
        loadAttendanceChart();
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load attendance chart
async function loadAttendanceChart() {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    // Get last 7 days attendance
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const recordsSnapshot = await db.collection('attendance_records')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

    // Create array of last 7 days with proper formatting
    const last7Days = [];
    const dailyCount = {};
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        last7Days.push(dateStr);
        dailyCount[dateStr] = 0;
    }

    // Count attendance per day
    recordsSnapshot.forEach(doc => {
        const date = doc.data().timestamp.toDate();
        const dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        if (dailyCount.hasOwnProperty(dateStr)) {
            dailyCount[dateStr]++;
        }
    });

    const counts = last7Days.map(date => dailyCount[date]);

    // Destroy existing chart if it exists
    if (chart) chart.destroy();

    // Create new chart with disabled animation and proper defaults
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Students Present',
                data: counts,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#1e3c72',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Disable animation to prevent "increasing" effect
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#333'
                    }
                },
                tooltip: {
                    enabled: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    ticks: {
                        stepSize: 1,
                        precision: 0,
                        callback: function(value) {
                            return value + ' students';
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}
// Start attendance session
async function startAttendance() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Create session
        const sessionData = {
            createdBy: user.uid,
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            endTime: null,
            active: true,
            sessionToken: generateSessionToken()
        };

        const sessionRef = await db.collection('attendance_sessions').add(sessionData);
        currentSession = {
            id: sessionRef.id,
            ...sessionData
        };

        // Generate QR code
        generateQRCode(sessionRef.id, sessionData.sessionToken);
        
        // Enable stop button
        document.getElementById('stopBtn').disabled = false;
        document.querySelector('button[onclick="startAttendance()"]').disabled = true;
        
        // Show QR container
        document.getElementById('qrContainer').classList.remove('hidden');
        document.getElementById('sessionId').textContent = sessionRef.id;
        
        // Start QR refresh timer
        startQRTimer();
        
        showToast('Attendance session started', 'success');
    } catch (error) {
        console.error('Error starting session:', error);
        showToast('Failed to start session', 'error');
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
        height: 256,
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
    let timeLeft = 300; // 5 minutes in seconds
    const timerElement = document.getElementById('qrTimer');
    
    qrRefreshInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Refresh QR every 10 seconds
        if (timeLeft % 10 === 0 && currentSession) {
            currentSession.sessionToken = generateSessionToken();
            generateQRCode(currentSession.id, currentSession.sessionToken);
            
            // Update session in Firestore
            db.collection('attendance_sessions').doc(currentSession.id).update({
                sessionToken: currentSession.sessionToken
            });
        }
        
        if (timeLeft <= 0) {
            stopAttendance();
        }
    }, 1000);
}

// Stop attendance session
async function stopAttendance() {
    try {
        if (currentSession) {
            await db.collection('attendance_sessions').doc(currentSession.id).update({
                active: false,
                endTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Clear interval
        if (qrRefreshInterval) {
            clearInterval(qrRefreshInterval);
        }
        
        // Update UI
        document.getElementById('stopBtn').disabled = true;
        document.querySelector('button[onclick="startAttendance()"]').disabled = false;
        document.getElementById('qrContainer').classList.add('hidden');
        
        showToast('Attendance session ended', 'info');
        
        // Reload stats
        loadDashboardStats();
        loadAttendanceRecords();
    } catch (error) {
        console.error('Error stopping session:', error);
        showToast('Failed to stop session', 'error');
    }
}

// Load attendance records
async function loadAttendanceRecords() {
    try {
        const recordsSnapshot = await db.collection('attendance_records')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        const tbody = document.getElementById('attendanceTableBody');
        tbody.innerHTML = '';

        for (const doc of recordsSnapshot) {
            const record = doc.data();
            
            // Get student name
            const studentDoc = await db.collection('users').doc(record.studentId).get();
            const studentData = studentDoc.data();
            
            // Get session info
            const sessionDoc = await db.collection('attendance_sessions').doc(record.sessionId).get();
            const sessionData = sessionDoc.data();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(record.timestamp)}</td>
                <td>${record.sessionId.substring(0, 8)}...</td>
                <td>${studentData?.name || 'Unknown'}</td>
                <td>${studentData?.roll || 'N/A'}</td>
                <td>${record.location?.coords ? 'Valid' : 'Invalid'}</td>
                <td><button class="btn btn-sm btn-primary" onclick="viewSelfie('${record.selfieURL}')">View</button></td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading records:', error);
        showToast('Error loading attendance records', 'error');
    }
}

// Load students
async function loadStudents() {
    try {
        const studentsSnapshot = await db.collection('users')
            .where('role', '==', 'student')
            .orderBy('roll')
            .get();

        const tbody = document.getElementById('studentsTableBody');
        tbody.innerHTML = '';

        for (const doc of studentsSnapshot) {
            const student = doc.data();
            
            // Calculate attendance percentage
            const attendanceSnapshot = await db.collection('attendance_records')
                .where('studentId', '==', doc.id)
                .get();
            
            const totalSessions = await db.collection('attendance_sessions').get();
            const percentage = totalSessions.size > 0 
                ? (attendanceSnapshot.size / totalSessions.size * 100).toFixed(1)
                : 0;

            // Get last attendance
            const lastAttendanceSnapshot = await db.collection('attendance_records')
                .where('studentId', '==', doc.id)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();
            
            const lastAttendance = lastAttendanceSnapshot.docs[0]?.data().timestamp;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.roll || 'N/A'}</td>
                <td>${student.name}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${percentage}%</td>
                <td>${lastAttendance ? formatDate(lastAttendance) : 'Never'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewStudentHistory('${doc.id}')">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        }

        // Load sections for filter
        loadSections();
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('Error loading students', 'error');
    }
}

// Load sections for filter
async function loadSections() {
    const studentsSnapshot = await db.collection('users')
        .where('role', '==', 'student')
        .get();

    const sections = new Set();
    studentsSnapshot.forEach(doc => {
        if (doc.data().section) {
            sections.add(doc.data().section);
        }
    });

    const sectionFilter = document.getElementById('sectionFilter');
    const reportSection = document.getElementById('reportSection');
    
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        sectionFilter.appendChild(option.cloneNode(true));
        reportSection.appendChild(option);
    });
}

// Filter students
async function filterStudents() {
    const section = document.getElementById('sectionFilter').value;
    const search = document.getElementById('searchStudent').value.toLowerCase();

    const studentsSnapshot = await db.collection('users')
        .where('role', '==', 'student')
        .get();

    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';

    for (const doc of studentsSnapshot) {
        const student = doc.data();
        
        // Apply filters
        if (section && student.section !== section) continue;
        if (search && !student.name.toLowerCase().includes(search) && 
            !student.roll?.toLowerCase().includes(search)) continue;

        // Calculate attendance
        const attendanceSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', doc.id)
            .get();
        
        const totalSessions = await db.collection('attendance_sessions').get();
        const percentage = totalSessions.size > 0 
            ? (attendanceSnapshot.size / totalSessions.size * 100).toFixed(1)
            : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.roll || 'N/A'}</td>
            <td>${student.name}</td>
            <td>${student.section || 'N/A'}</td>
            <td>${percentage}%</td>
            <td>N/A</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewStudentHistory('${doc.id}')">
                    <i class="fas fa-history"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }
}

// Load pending teacher approvals
async function loadPendingApprovals() {
    try {
        const approvalsSnapshot = await db.collection('teacher_approvals')
            .where('status', '==', 'pending')
            .orderBy('requestedAt', 'desc')
            .get();

        const tbody = document.getElementById('approvalsTableBody');
        if (!tbody) return;

        document.getElementById('pendingCount').textContent = approvalsSnapshot.size;

        tbody.innerHTML = '';
        approvalsSnapshot.forEach(doc => {
            const approval = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${approval.name}</td>
                <td>${approval.employeeId}</td>
                <td>${approval.department}</td>
                <td>${approval.email}</td>
                <td>${formatDate(approval.requestedAt)}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="approveTeacher('${doc.id}', '${approval.userId}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectTeacher('${doc.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading approvals:', error);
    }
}

// Approve teacher
async function approveTeacher(approvalId, userId) {
    try {
        // Update user role
        await db.collection('users').doc(userId).update({
            role: 'teacher'
        });

        // Update approval status
        await db.collection('teacher_approvals').doc(approvalId).update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Teacher approved successfully', 'success');
        loadPendingApprovals();
    } catch (error) {
        console.error('Error approving teacher:', error);
        showToast('Error approving teacher', 'error');
    }
}

// Reject teacher
async function rejectTeacher(approvalId) {
    try {
        await db.collection('teacher_approvals').doc(approvalId).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Teacher request rejected', 'info');
        loadPendingApprovals();
    } catch (error) {
        console.error('Error rejecting teacher:', error);
        showToast('Error rejecting teacher', 'error');
    }
}

// Generate report
async function generateReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const section = document.getElementById('reportSection').value;
    const year = new Date().getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get attendance records for the month
    const recordsSnapshot = await db.collection('attendance_records')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

    // Group by student
    const studentAttendance = {};
    recordsSnapshot.forEach(doc => {
        const record = doc.data();
        studentAttendance[record.studentId] = (studentAttendance[record.studentId] || 0) + 1;
    });

    // Get total sessions in month
    const sessionsSnapshot = await db.collection('attendance_sessions')
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();
    
    const totalSessions = sessionsSnapshot.size;

    // Get students
    let studentsQuery = db.collection('users').where('role', '==', 'student');
    if (section) {
        studentsQuery = studentsQuery.where('section', '==', section);
    }
    
    const studentsSnapshot = await studentsQuery.get();

    // Prepare chart data
    const labels = [];
    const data = [];

    studentsSnapshot.forEach(doc => {
        const student = doc.data();
        const attended = studentAttendance[doc.id] || 0;
        const percentage = totalSessions > 0 ? (attended / totalSessions * 100).toFixed(1) : 0;
        
        labels.push(student.name);
        data.push(percentage);
    });

    // Update chart
    const ctx = document.getElementById('reportChart').getContext('2d');
    new Chart(ctx, {
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
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Download CSV
async function downloadCSV() {
    try {
        const recordsSnapshot = await db.collection('attendance_records')
            .orderBy('timestamp', 'desc')
            .get();

        let csv = 'Date,Student Name,Roll Number,Section,Location Status,Session ID\n';

        for (const doc of recordsSnapshot) {
            const record = doc.data();
            
            // Get student data
            const studentDoc = await db.collection('users').doc(record.studentId).get();
            const student = studentDoc.data();

            csv += `${formatDate(record.timestamp)},${student?.name || 'Unknown'},${student?.roll || 'N/A'},${student?.section || 'N/A'},${record.location?.coords ? 'Valid' : 'Invalid'},${record.sessionId}\n`;
        }

        // Download file
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

// Export functions
window.showSection = showSection;
window.startAttendance = startAttendance;
window.stopAttendance = stopAttendance;
window.filterStudents = filterStudents;
window.generateReport = generateReport;
window.downloadCSV = downloadCSV;
window.viewSelfie = viewSelfie;
window.approveTeacher = approveTeacher;
window.rejectTeacher = rejectTeacher;