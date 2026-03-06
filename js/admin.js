// Admin Dashboard Functions

// Store chart instance globally
let adminChart = null;

// Load admin data on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin dashboard loading...');
    await loadAdminData();
    await loadDashboardStats();
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

// Show different sections
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    
    const sectionElement = document.getElementById(`${section}Section`);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    // Find and highlight the clicked link
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
        reports: 'Reports',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Overview';
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        console.log('Loading dashboard stats...');
        
        // Get total teachers
        const teachersSnapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .get();
        document.getElementById('totalTeachers').textContent = teachersSnapshot.size;

        // Get total students
        const studentsSnapshot = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        document.getElementById('totalStudents').textContent = studentsSnapshot.size;

        // Get pending approvals
        const pendingSnapshot = await db.collection('teacher_approvals')
            .where('status', '==', 'pending')
            .get();
        document.getElementById('pendingApprovals').textContent = pendingSnapshot.size;
        document.getElementById('pendingCount').textContent = pendingSnapshot.size;

        // Get total sessions
        const sessionsSnapshot = await db.collection('attendance_sessions').get();
        document.getElementById('totalSessions').textContent = sessionsSnapshot.size;

        // Load chart with a slight delay to ensure DOM is ready
        setTimeout(() => {
            loadAdminChart();
        }, 200);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard statistics', 'error');
    }
}

// Load admin chart - FIXED VERSION
function loadAdminChart() {
    console.log('Loading admin chart...');
    
    const canvas = document.getElementById('adminChart');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context');
        return;
    }
    
    // Get values with proper parsing
    const teachers = parseInt(document.getElementById('totalTeachers')?.textContent) || 0;
    const students = parseInt(document.getElementById('totalStudents')?.textContent) || 0;
    const pending = parseInt(document.getElementById('pendingApprovals')?.textContent) || 0;
    const sessions = parseInt(document.getElementById('totalSessions')?.textContent) || 0;
    
    console.log('Chart data:', { teachers, students, pending, sessions });
    
    // Destroy existing chart if it exists
    if (adminChart) {
        adminChart.destroy();
        adminChart = null;
    }
    
    // Create new chart
    try {
        adminChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Teachers', 'Students', 'Pending', 'Sessions'],
                datasets: [{
                    label: 'Count',
                    data: [teachers, students, pending, sessions],
                    backgroundColor: [
                        'rgba(74, 144, 226, 0.8)',   // Blue
                        'rgba(40, 167, 69, 0.8)',    // Green
                        'rgba(255, 193, 7, 0.8)',    // Yellow
                        'rgba(220, 53, 69, 0.8)'     // Red
                    ],
                    borderColor: [
                        '#4a90e2',
                        '#28a745',
                        '#ffc107',
                        '#dc3545'
                    ],
                    borderWidth: 2,
                    borderRadius: 5,
                    barPercentage: 0.7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0  // Completely disable animation
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                return `Count: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: true
                        },
                        ticks: {
                            stepSize: 1,
                            precision: 0,
                            font: {
                                size: 12
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 20,
                        bottom: 20
                    }
                }
            }
        });
        
        console.log('Chart created successfully');
        
    } catch (error) {
        console.error('Error creating chart:', error);
        showToast('Error loading chart', 'error');
    }
}

// Load pending teacher approvals
async function loadPendingApprovals() {
    try {
        const tbody = document.getElementById('approvalsTableBody');
        if (!tbody) return;

        const approvalsSnapshot = await db.collection('teacher_approvals')
            .where('status', '==', 'pending')
            .get();

        // Update pending count
        document.getElementById('pendingCount').textContent = approvalsSnapshot.size;
        document.getElementById('pendingApprovals').textContent = approvalsSnapshot.size;

        if (approvalsSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No pending approvals</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        
        approvalsSnapshot.forEach(doc => {
            const approval = doc.data();
            let date = 'N/A';
            
            if (approval.requestedAt) {
                try {
                    date = approval.requestedAt.toDate ? 
                        approval.requestedAt.toDate().toLocaleString() : 
                        new Date(approval.requestedAt).toLocaleString();
                } catch (e) {
                    console.error('Date parsing error:', e);
                }
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${approval.name || 'N/A'}</td>
                <td>${approval.employeeId || 'N/A'}</td>
                <td>${approval.department || 'N/A'}</td>
                <td>${approval.email || 'N/A'}</td>
                <td>${date}</td>
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
        const tbody = document.getElementById('approvalsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Error loading approvals: ${error.message}</td></tr>`;
        }
    }
}

// Load teachers
async function loadTeachers() {
    try {
        const teachersSnapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .get();

        const tbody = document.getElementById('teachersTableBody');
        if (!tbody) return;

        if (teachersSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No teachers found</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        
        teachersSnapshot.forEach(doc => {
            const teacher = doc.data();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${teacher.name || 'N/A'}</td>
                <td>${teacher.employeeId || 'N/A'}</td>
                <td>${teacher.department || 'N/A'}</td>
                <td>${teacher.email || 'N/A'}</td>
                <td><span class="badge badge-success">Active</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="disableTeacher('${doc.id}')">
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

// Load students - COMPLETELY FIXED VERSION
async function loadStudents() {
    try {
        console.log('📚 Loading students...');
        
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) {
            console.error('❌ Students table body not found');
            return;
        }

        // Show loading message
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading students...</td></tr>';
        
        // Get all students from Firestore
        const studentsSnapshot = await db.collection('users')
            .where('role', '==', 'student')
            .get();

        console.log(`✅ Found ${studentsSnapshot.size} students`);

        // Check if snapshot is empty
        if (studentsSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No students found</td></tr>';
            return;
        }

        // Clear the table
        tbody.innerHTML = '';
        
        // Use forEach to iterate through documents (this is the correct way)
        studentsSnapshot.forEach(doc => {
            const student = doc.data();
            console.log('Student data:', student);
            
            // Create table row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.roll || 'N/A'}</td>
                <td>${student.name || 'N/A'}</td>
                <td>${student.section || 'N/A'}</td>
                <td>${student.email || 'N/A'}</td>
                <td>0%</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="disableStudent('${doc.id}')">
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
            tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">
                Error loading students: ${error.message}
            </td></tr>`;
        }
    }
}

// Filter students
async function filterStudents() {
    const search = document.getElementById('searchStudent').value.toLowerCase();
    
    const studentsSnapshot = await db.collection('users')
        .where('role', '==', 'student')
        .get();

    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';

    for (const doc of studentsSnapshot) {
        const student = doc.data();
        
        if (search && !student.name?.toLowerCase().includes(search) && 
            !student.roll?.toLowerCase().includes(search)) {
            continue;
        }
        
        const attendanceSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', doc.id)
            .get();
        
        const totalSessions = await db.collection('attendance_sessions').get();
        const percentage = totalSessions.size > 0 
            ? ((attendanceSnapshot.size / totalSessions.size) * 100).toFixed(1)
            : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.roll || 'N/A'}</td>
            <td>${student.name || 'N/A'}</td>
            <td>${student.section || 'N/A'}</td>
            <td>${student.email || 'N/A'}</td>
            <td>${percentage}%</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="disableStudent('${doc.id}')">
                    <i class="fas fa-ban"></i> Disable
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }
}

// Approve teacher
async function approveTeacher(approvalId, userId) {
    try {
        showLoading();
        
        await db.collection('users').doc(userId).update({
            role: 'teacher',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('teacher_approvals').doc(approvalId).update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Teacher approved successfully!', 'success');
        
        // Reload all sections
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

// Reject teacher
async function rejectTeacher(approvalId) {
    try {
        showLoading();
        
        await db.collection('teacher_approvals').doc(approvalId).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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

// Disable teacher
async function disableTeacher(userId) {
    if (!confirm('Are you sure you want to disable this teacher?')) return;
    
    try {
        showLoading();
        
        await db.collection('users').doc(userId).update({
            role: 'disabled_teacher'
        });
        
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

// Disable student
async function disableStudent(userId) {
    if (!confirm('Are you sure you want to disable this student?')) return;
    
    try {
        showLoading();
        
        await db.collection('users').doc(userId).update({
            role: 'disabled_student'
        });
        
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
async function generateReport() {
    showToast('Report generation coming soon', 'info');
}

// Download CSV
async function downloadCSV() {
    showToast('CSV download coming soon', 'info');
}

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

// Export functions
window.showSection = showSection;
window.filterStudents = filterStudents;
window.approveTeacher = approveTeacher;
window.rejectTeacher = rejectTeacher;
window.disableTeacher = disableTeacher;
window.disableStudent = disableStudent;
window.generateReport = generateReport;
window.downloadCSV = downloadCSV;