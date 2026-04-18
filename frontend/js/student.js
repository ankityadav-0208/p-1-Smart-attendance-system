// Student Dashboard Functions
let currentScanData = null;
let studentChart = null;

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
        profile: 'Profile'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    if (section === 'history') loadAttendanceHistory();
}

// Load dashboard statistics - Using API
async function loadDashboardStats() {
    try {
        const response = await apiRequest('/student/stats');
        const stats = response.data;
        
        document.getElementById('totalClasses').textContent = stats.total || 0;
        document.getElementById('classesAttended').textContent = stats.attended || 0;
        document.getElementById('attendancePercentage').textContent = (stats.percentage || 0) + '%';

        loadStudentChart(stats.dailyAttendance || {});
        
        document.getElementById('studentRank').textContent = '-';

    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load student chart
function loadStudentChart(dailyAttendance = {}) {
    const ctx = document.getElementById('studentChart').getContext('2d');
    
    const dates = Object.keys(dailyAttendance);
    const values = Object.values(dailyAttendance);

    if (window.studentChartInstance) {
        window.studentChartInstance.destroy();
    }

    window.studentChartInstance = new Chart(ctx, {
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
                <td>N/A
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
                <td>N/A
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error filtering history:', error);
    }
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

        const response = await apiRequest('/student/validate-session', {
            method: 'POST',
            body: JSON.stringify({ sessionId: data.sessionId, token: data.token })
        });

        if (!response.success) {
            throw new Error(response.message);
        }

        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        const deviceId = await getDeviceId();
        if (user.deviceId && user.deviceId !== deviceId) {
            throw new Error('Device not recognized. Please use your registered device.');
        }

        currentScanData = {
            sessionId: data.sessionId,
            token: data.token
        };

        closeQRScanner();
        openConfirmModal();

    } catch (error) {
        console.error('QR processing error:', error);
        showToast(error.message, 'error');
        closeQRScanner();
    }
}

// Open confirm modal
async function openConfirmModal() {
    document.getElementById('confirmModal').style.display = 'block';
    
    try {
        const position = await getCurrentLocation();
        const distance = await calculateDistanceFromClassroom(position.coords);
        document.getElementById('locationStatus').innerHTML = `
            Latitude: ${position.coords.latitude.toFixed(6)}<br>
            Longitude: ${position.coords.longitude.toFixed(6)}<br>
            Distance from classroom: ${Math.round(distance)} meters
        `;
        window.currentLocation = position.coords;
    } catch (error) {
        document.getElementById('locationStatus').innerHTML = 'Unable to fetch location. Please enable location services.';
        window.currentLocation = null;
    }
}

// Calculate distance from classroom
async function calculateDistanceFromClassroom(studentLoc) {
    const classroomLocation = {
        latitude: 29.171743,
        longitude: 75.735818
    };
    
    return calculateDistance(
        studentLoc.latitude,
        studentLoc.longitude,
        classroomLocation.latitude,
        classroomLocation.longitude
    );
}

// Confirm attendance (without selfie)
async function confirmAttendance() {
    console.log('📝 Confirm Attendance button clicked!');
    
    try {
        showLoading();
        
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        if (!currentScanData) {
            throw new Error('No QR code data found');
        }
        
        if (!window.currentLocation) {
            throw new Error('Location not available. Please try again.');
        }
        
        const distance = await calculateDistanceFromClassroom(window.currentLocation);
        const distanceInMeters = Math.round(distance);
        
        if (distanceInMeters > 1000) {
            throw new Error(`You are ${distanceInMeters}m away. Max allowed: 1000m`);
        }
        
        const response = await fetch(`${API.baseURL}/student/mark-attendance-without-selfie`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                sessionId: currentScanData.sessionId,
                location: window.currentLocation,
                distance: distanceInMeters
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to mark attendance');
        }
        
        showToast('✅ Attendance marked successfully!', 'success');
        
        closeConfirmModal();
        await loadDashboardStats();
        await loadRecentAttendance();
        
        currentScanData = null;
        window.currentLocation = null;
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Close confirm modal
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    window.currentLocation = null;
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

// Calculate distance between two coordinates
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
            await apiRequest('/users/change-password', {
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

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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

// EXPORT FUNCTIONS TO WINDOW
window.showSection = showSection;
window.scanQR = scanQR;
window.startQRScanner = startQRScanner;
window.closeQRScanner = closeQRScanner;
window.filterHistory = filterHistory;
window.updatePhoto = updatePhoto;
window.changePassword = changePassword;
window.toggleDarkMode = toggleDarkMode;
window.closeConfirmModal = closeConfirmModal;
window.confirmAttendance = confirmAttendance;