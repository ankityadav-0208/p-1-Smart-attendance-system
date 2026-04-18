// Admin Dashboard Functions

// Store chart instance globally
let adminChart = null;

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
        reports: 'Reports',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Overview';
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
        document.getElementById('totalSessions').textContent = stats.sessions || 0;

        setTimeout(() => {
            loadAdminChart();
        }, 200);
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard statistics', 'error');
    }
}

// Load admin chart
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
    
    const teachers = parseInt(document.getElementById('totalTeachers')?.textContent) || 0;
    const students = parseInt(document.getElementById('totalStudents')?.textContent) || 0;
    const pending = parseInt(document.getElementById('pendingApprovals')?.textContent) || 0;
    const sessions = parseInt(document.getElementById('totalSessions')?.textContent) || 0;
    
    console.log('Chart data:', { teachers, students, pending, sessions });
    
    if (adminChart) {
        adminChart.destroy();
        adminChart = null;
    }
    
    try {
        adminChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Teachers', 'Students', 'Pending', 'Sessions'],
                datasets: [{
                    label: 'Count',
                    data: [teachers, students, pending, sessions],
                    backgroundColor: [
                        'rgba(74, 144, 226, 0.8)',
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)'
                    ],
                    borderColor: ['#4a90e2', '#28a745', '#ffc107', '#dc3545'],
                    borderWidth: 2,
                    borderRadius: 5,
                    barPercentage: 0.7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: {
                    legend: { display: false },
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
                        grid: { color: 'rgba(0, 0, 0, 0.1)', drawBorder: true },
                        ticks: { stepSize: 1, precision: 0, font: { size: 12 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 12, weight: 'bold' } }
                    }
                },
                layout: { padding: { top: 20, bottom: 20 } }
            }
        });
        
        console.log('Chart created successfully');
        
    } catch (error) {
        console.error('Error creating chart:', error);
        showToast('Error loading chart', 'error');
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
window.toggleDarkMode = toggleDarkMode;