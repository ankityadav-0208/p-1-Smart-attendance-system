// Student Dashboard Functions
let currentScanData = null;
let selfieImage = null;
let studentChart = null;

// API Base URL
const API_BASE_URL = 'https://p-1-smart-attendance-system-02.onrender.com/api';

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
    
    // For FormData, remove Content-Type header
    if (options.body && options.body instanceof FormData) {
        delete headers['Content-Type'];
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'API request failed');
    }
    
    return data;
}

// Load student data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadStudentData();
    await loadDashboardStats();
    await loadRecentAttendance();
});

// Load student data
async function loadStudentData() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('studentName').textContent = user.name;
    document.getElementById('studentInfo').textContent = `${user.rollNumber || ''} • ${user.section || ''}`;
    
    if (user.profilePhotoURL) {
        document.getElementById('profileImage').src = user.profilePhotoURL;
        document.getElementById('profilePhoto').src = user.profilePhotoURL;
    }

    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileRoll').textContent = user.rollNumber || 'N/A';
    document.getElementById('profileSection').textContent = user.section || 'N/A';
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileDeviceId').textContent = user.deviceId ? user.deviceId.substring(0, 16) + '...' : 'N/A';
    
    if (user.createdAt) {
        document.getElementById('profileJoined').textContent = new Date(user.createdAt).toLocaleDateString();
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
        history: 'Attendance History',
        analytics: 'Analytics',
        profile: 'Profile'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    if (section === 'history') loadAttendanceHistory();
    if (section === 'analytics') loadAnalytics();
}

// Load dashboard statistics - Using API
async function loadDashboardStats() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        const response = await apiRequest('/student/stats');
        const stats = response.data;
        
        document.getElementById('totalClasses').textContent = stats.total || 0;
        document.getElementById('classesAttended').textContent = stats.attended || 0;
        document.getElementById('attendancePercentage').textContent = (stats.percentage || 0) + '%';

        loadStudentChart(stats.dailyAttendance || {});
        
        // For rank - we'll keep simple for now
        document.getElementById('studentRank').textContent = '-';

    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load student chart
function loadStudentChart(dailyAttendance = {}) {
    const ctx = document.getElementById('studentChart').getContext('2d');
    
    // Get last 30 days
    const dates = Object.keys(dailyAttendance);
    const values = Object.values(dailyAttendance);

    if (studentChart) studentChart.destroy();

    studentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Attendance',
                data: values,
                backgroundColor: values.map(v => v ? '#28a745' : '#dc3545'),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        stepSize: 1,
                        callback: value => value ? 'Present' : 'Absent'
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Load recent attendance - Using API
async function loadRecentAttendance() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        const response = await apiRequest('/student/history');
        const records = response.data;
        
        const tbody = document.getElementById('recentAttendanceBody');
        tbody.innerHTML = '';

        records.slice(0, 5).forEach(record => {
            const date = new Date(record.timestamp);
            const sessionId = record.sessionId?._id || record.sessionId;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${sessionId?.substring(0, 8) || 'N/A'}...</td>
                <td><span class="badge badge-success">Present</span></td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading recent attendance:', error);
    }
}

// Load attendance history - Using API
async function loadAttendanceHistory() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        const response = await apiRequest('/student/history');
        const records = response.data;

        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        records.forEach(record => {
            const date = new Date(record.timestamp);
            const sessionId = record.sessionId?._id || record.sessionId;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${sessionId?.substring(0, 12) || 'N/A'}...</td>
                <td>${record.location?.distance ? '✓ Verified' : 'N/A'}</td>
                <td>
                    ${record.selfieUrl ? 
                        `<button class="btn btn-sm btn-primary" onclick="viewSelfie('${record.selfieUrl}')">
                            <i class="fas fa-eye"></i>
                        </button>` : 
                        'N/A'}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Error loading attendance history', 'error');
    }
}

// Filter history by month
async function filterHistory() {
    const month = document.getElementById('monthFilter').value;
    if (!month) {
        loadAttendanceHistory();
        return;
    }

    try {
        const response = await apiRequest('/student/history');
        let records = response.data;
        
        const year = new Date().getFullYear();
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        records = records.filter(record => {
            const date = new Date(record.timestamp);
            return date >= startDate && date <= endDate;
        });

        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        records.forEach(record => {
            const date = new Date(record.timestamp);
            const sessionId = record.sessionId?._id || record.sessionId;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${sessionId?.substring(0, 12) || 'N/A'}...</td>
                <td>${record.location?.distance ? '✓ Verified' : 'N/A'}</td>
                <td>
                    ${record.selfieUrl ? 
                        `<button class="btn btn-sm btn-primary" onclick="viewSelfie('${record.selfieUrl}')">
                            <i class="fas fa-eye"></i>
                        </button>` : 
                        'N/A'}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error filtering history:', error);
    }
}

// Load analytics - Using API
async function loadAnalytics() {
    try {
        const response = await apiRequest('/student/stats');
        const stats = response.data;
        
        document.getElementById('presentCount').textContent = stats.attended || 0;
        const totalClasses = stats.total || 0;
        const totalPresent = stats.attended || 0;
        const totalAbsent = totalClasses - totalPresent;
        document.getElementById('absentCount').textContent = totalAbsent;
        document.getElementById('totalPercentage').textContent = (stats.percentage || 0) + '%';
        
        const requiredToMaintain = Math.max(0, Math.ceil(0.75 * totalClasses - totalPresent));
        document.getElementById('requiredAttendance').textContent = requiredToMaintain;

        loadWeeklyChart();
        loadMonthlyComparison();
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Load weekly chart
async function loadWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    const response = await apiRequest('/student/history');
    const records = response.data;
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    
    records.forEach(record => {
        const date = new Date(record.timestamp);
        const day = date.getDay();
        weeklyData[day]++;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Attendance by Day',
                data: weeklyData,
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 }
        }
    });
}

// Load monthly comparison
async function loadMonthlyComparison() {
    const ctx = document.getElementById('monthlyComparisonChart').getContext('2d');
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = new Array(12).fill(0);
    const monthlyTotal = new Array(12).fill(0);

    // This would need separate API endpoints for monthly data
    // For now, showing placeholder
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Attendance %',
                data: monthlyData,
                backgroundColor: '#4a90e2'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

// Scan QR Code
async function scanQR() {
    document.getElementById('qrScannerModal').style.display = 'block';
}

// Start QR scanner
async function startQRScanner() {
    try {
        const video = document.getElementById('qrVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        scanQRCode();
    } catch (error) {
        console.error('Camera error:', error);
        showToast('Unable to access camera', 'error');
    }
}

// Scan QR code
function scanQRCode() {
    const video = document.getElementById('qrVideo');
    const canvas = document.getElementById('qrCanvas');
    const context = canvas.getContext('2d');

    const scanInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            
            if (code) {
                clearInterval(scanInterval);
                processQRCode(code.data);
                video.srcObject.getTracks().forEach(track => track.stop());
            }
        }
    }, 500);
}

// Process QR code data - Using API
async function processQRCode(qrData) {
    try {
        const data = JSON.parse(qrData);
        
        if (data.type !== 'attendance') {
            throw new Error('Invalid QR code');
        }

        // Validate session with backend
        const response = await apiRequest('/student/validate-session', {
            method: 'POST',
            body: JSON.stringify({ sessionId: data.sessionId, token: data.token })
        });

        if (!response.success) {
            throw new Error(response.message);
        }

        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Check device ID
        const deviceId = await getDeviceId();
        if (user.deviceId && user.deviceId !== deviceId) {
            throw new Error('Device not recognized. Please use your registered device.');
        }

        currentScanData = {
            sessionId: data.sessionId,
            token: data.token
        };

        closeQRScanner();
        openSelfieCapture();

    } catch (error) {
        console.error('QR processing error:', error);
        showToast(error.message, 'error');
        closeQRScanner();
    }
}

// Open selfie capture
async function openSelfieCapture() {
    document.getElementById('selfieModal').style.display = 'block';
    
    try {
        const video = document.getElementById('selfieVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (error) {
        console.error('Camera error:', error);
        showToast('Unable to access camera for selfie', 'error');
    }
}

// Capture selfie
function captureSelfie() {
    const video = document.getElementById('selfieVideo');
    const canvas = document.getElementById('selfieCanvas');
    const preview = document.getElementById('selfiePreview');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
        selfieImage = blob;
        
        preview.src = URL.createObjectURL(blob);
        preview.classList.remove('hidden');
        video.classList.add('hidden');
        
        document.getElementById('submitAttendanceBtn').disabled = false;
        document.getElementById('retakeBtn').style.display = 'inline-block';
        
        video.srcObject.getTracks().forEach(track => track.stop());
    }, 'image/jpeg');
}

// Retake selfie
function retakeSelfie() {
    const video = document.getElementById('selfieVideo');
    const preview = document.getElementById('selfiePreview');
    
    preview.classList.add('hidden');
    video.classList.remove('hidden');
    
    document.getElementById('submitAttendanceBtn').disabled = true;
    document.getElementById('retakeBtn').style.display = 'none';
    selfieImage = null;
    
    openSelfieCapture();
}

// Submit attendance - Using API
async function submitAttendance() {
    console.log('📝 Submit button clicked!');
    
    try {
        showLoading();
        
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        if (!currentScanData) {
            throw new Error('No QR code data found');
        }
        
        if (!selfieImage) {
            throw new Error('No selfie captured');
        }
        
        // Get location
        const position = await getCurrentLocation();
        
        // Call backend API to mark attendance
        const formData = new FormData();
        formData.append('data', JSON.stringify({
            sessionId: currentScanData.sessionId,
            location: position.coords
        }));
        formData.append('selfie', selfieImage);
        
        const response = await fetch(`${API_BASE_URL}/student/mark-attendance`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to mark attendance');
        }
        
        showToast('✅ Attendance marked successfully!', 'success');
        
        closeSelfieModal();
        await loadDashboardStats();
        await loadRecentAttendance();
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Get current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Close QR scanner
function closeQRScanner() {
    const video = document.getElementById('qrVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById('qrScannerModal').style.display = 'none';
}

// Close selfie modal
function closeSelfieModal() {
    const video = document.getElementById('selfieVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById('selfieModal').style.display = 'none';
    selfieImage = null;
    currentScanData = null;
}

// View selfie
function viewSelfie(url) {
    window.open(url, '_blank');
}

// Get Device ID
async function getDeviceId() {
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown'
    ].join('||');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// Update photo
async function updatePhoto() {
    showToast('Photo update coming soon', 'info');
}

// Change password
async function changePassword() {
    const newPassword = prompt('Enter new password (minimum 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        try {
            showLoading();
            // Call backend API to change password
            const response = await apiRequest('/users/change-password', {
                method: 'PUT',
                body: JSON.stringify({ 
                    currentPassword: prompt('Enter current password:'),
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

// Loading functions
function showLoading() {
    let loader = document.getElementById('studentLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'studentLoader';
        loader.className = 'global-loader';
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
}

function hideLoading() {
    const loader = document.getElementById('studentLoader');
    if (loader) loader.remove();
}

// Event listener for submit button
document.addEventListener('DOMContentLoaded', function() {
    const submitBtn = document.getElementById('submitAttendanceBtn');
    if (submitBtn) {
        console.log('✅ Submit button found in DOM');
        submitBtn.addEventListener('click', function(e) {
            console.log('👆 Submit button clicked via event listener');
            submitAttendance();
        });
    }
});

// Export functions
window.showSection = showSection;
window.scanQR = scanQR;
window.startQRScanner = startQRScanner;
window.closeQRScanner = closeQRScanner;
window.captureSelfie = captureSelfie;
window.retakeSelfie = retakeSelfie;
window.submitAttendance = submitAttendance;
window.closeSelfieModal = closeSelfieModal;
window.viewSelfie = viewSelfie;
window.filterHistory = filterHistory;
window.updatePhoto = updatePhoto;
window.changePassword = changePassword;