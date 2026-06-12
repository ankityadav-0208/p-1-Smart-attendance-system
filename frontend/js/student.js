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

    console.log('Loading student data:', user);

    // Update sidebar
    const studentNameElem = document.getElementById('studentName');
    if (studentNameElem) studentNameElem.textContent = user.name;
    
    const studentInfoElem = document.getElementById('studentInfo');
    if (studentInfoElem) studentInfoElem.textContent = `${user.rollNumber || ''} • ${user.section || ''}`;
    
    // Update profile images
    if (user.profilePhotoURL) {
        const profileImageElem = document.getElementById('profileImage');
        if (profileImageElem) profileImageElem.src = user.profilePhotoURL;
        
        const profilePhotoElem = document.getElementById('profilePhoto');
        if (profilePhotoElem) profilePhotoElem.src = user.profilePhotoURL;
    }

    // Update profile details
    const profileNameElem = document.getElementById('profileName');
    if (profileNameElem) profileNameElem.textContent = user.name;
    
    const profileRollElem = document.getElementById('profileRoll');
    if (profileRollElem) profileRollElem.textContent = user.rollNumber || 'N/A';
    
    const profileSectionElem = document.getElementById('profileSectionText');
    if (profileSectionElem) profileSectionElem.textContent = user.section || 'N/A';
    
    const profileEmailElem = document.getElementById('profileEmail');
    if (profileEmailElem) profileEmailElem.textContent = user.email;
    
    const profileDeviceIdElem = document.getElementById('profileDeviceId');
    if (profileDeviceIdElem) profileDeviceIdElem.textContent = user.deviceId ? user.deviceId.substring(0, 16) + '...' : 'N/A';
    
    const profileJoinedElem = document.getElementById('profileJoined');
    if (profileJoinedElem && user.createdAt) profileJoinedElem.textContent = new Date(user.createdAt).toLocaleDateString();
    
    // Load attendance summary for profile
    try {
        const statsResponse = await apiRequest('/student/stats');
        const stats = statsResponse.data;
        
        const profileAttendance = document.getElementById('profileAttendance');
        if (profileAttendance) profileAttendance.textContent = (stats.percentage || 0) + '%';
        
        const profileAttended = document.getElementById('profileAttended');
        if (profileAttended) profileAttended.textContent = stats.attended || 0;
        
        const profileTotal = document.getElementById('profileTotal');
        if (profileTotal) profileTotal.textContent = stats.total || 0;
        
        const profileRollBadge = document.getElementById('profileRollBadge');
        if (profileRollBadge) profileRollBadge.textContent = `Roll: ${user.rollNumber || 'N/A'} | Section: ${user.section || 'N/A'}`;
        
    } catch (error) {
        console.error('Error loading profile stats:', error);
    }
    
    console.log('Profile data loaded successfully');
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
        subjectAnalytics: 'Subject Analytics',
        profile: 'Profile'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    if (section === 'history') loadAttendanceHistory();
    if (section === 'subjectAnalytics') loadSubjectAnalytics();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await apiRequest('/student/stats');
        const stats = response.data;
        
        console.log('Stats received:', stats);
        
        const totalClassesElem = document.getElementById('totalClasses');
        if (totalClassesElem) totalClassesElem.textContent = stats.total || 0;
        
        const classesAttendedElem = document.getElementById('classesAttended');
        if (classesAttendedElem) classesAttendedElem.textContent = stats.attended || 0;
        
        const attendancePercentageElem = document.getElementById('attendancePercentage');
        if (attendancePercentageElem) attendancePercentageElem.textContent = (stats.percentage || 0) + '%';

        loadStudentChart(stats.dailyAttendance || {});
        
        const studentRankElem = document.getElementById('studentRank');
        if (studentRankElem) studentRankElem.textContent = '-';

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

// Load recent attendance
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

// Load attendance history
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
                <td>N/A</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Error loading attendance history', 'error');
    }
}

// ============ PHOTO UPLOAD FUNCTIONS ============
async function openPhotoUpload() {
    document.getElementById('photoModal').style.display = 'block';
    document.getElementById('photoPreview').src = '';
    document.getElementById('photoInput').value = '';
}

function closePhotoModal() {
    document.getElementById('photoModal').style.display = 'none';
}

async function uploadProfilePhoto() {
    const fileInput = document.getElementById('photoInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a photo first', 'warning');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showToast('Photo size should be less than 2MB', 'error');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        formData.append('profilePhoto', file);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API.baseURL}/users/profile-photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Upload failed');
        }
        
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        user.profilePhotoURL = result.data.profilePhotoURL;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        const profileImage = document.getElementById('profileImage');
        if (profileImage) profileImage.src = result.data.profilePhotoURL;
        
        const profilePhoto = document.getElementById('profilePhoto');
        if (profilePhoto) profilePhoto.src = result.data.profilePhotoURL;
        
        showToast('Profile photo updated successfully!', 'success');
        closePhotoModal();
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function removeProfilePhoto() {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    
    try {
        showLoading();
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API.baseURL}/users/profile-photo`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to remove photo');
        }
        
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        user.profilePhotoURL = '';
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        const profileImage = document.getElementById('profileImage');
        if (profileImage) profileImage.src = '';
        
        const profilePhoto = document.getElementById('profilePhoto');
        if (profilePhoto) profilePhoto.src = '';
        
        showToast('Profile photo removed', 'success');
        closePhotoModal();
        
    } catch (error) {
        console.error('Remove error:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============ SUBJECT ANALYTICS ============
let subjectChart = null;
let currentSubjectData = [];

async function loadSubjectAnalytics() {
    try {
        console.log('📊 Loading subject analytics...');
        
        const response = await apiRequest('/student/subject-attendance');
        const subjects = response.data;
        
        console.log('Subjects data:', subjects);
        
        currentSubjectData = subjects;
        
        const subjectFilter = document.getElementById('subjectFilter');
        if (subjectFilter) {
            subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.subjectId;
                option.textContent = `${subject.subjectName} (${subject.subjectCode}) - ${subject.percentage}%`;
                subjectFilter.appendChild(option);
            });
        }
        
        renderSubjectChart(subjects);
        renderSubjectCards(subjects);
        
    } catch (error) {
        console.error('Error loading subject analytics:', error);
        showToast('Error loading subject analytics', 'error');
    }
}

function renderSubjectChart(subjects) {
    const ctx = document.getElementById('subjectChart');
    if (!ctx) return;
    
    const canvas = ctx.getContext('2d');
    
    if (subjectChart) {
        subjectChart.destroy();
    }
    
    const labels = subjects.map(s => `${s.subjectName}\n(${s.subjectCode})`);
    const percentages = subjects.map(s => parseFloat(s.percentage));
    
    const backgroundColors = percentages.map(p => {
        if (p >= 75) return 'rgba(40, 167, 69, 0.7)';
        if (p >= 60) return 'rgba(255, 193, 7, 0.7)';
        return 'rgba(220, 53, 69, 0.7)';
    });
    
    subjectChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance Percentage (%)',
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
                    title: { display: true, text: 'Attendance (%)' },
                    ticks: { callback: value => value + '%' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const subject = subjects[context.dataIndex];
                            return [
                                `Attendance: ${subject.percentage}%`,
                                `Classes Attended: ${subject.attended}`,
                                `Total Classes: ${subject.total}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function renderSubjectCards(subjects) {
    const container = document.getElementById('subjectCards');
    if (!container) return;
    
    if (subjects.length === 0) {
        container.innerHTML = '<div class="glass-effect" style="padding: 20px; text-align: center;">No subjects found</div>';
        return;
    }
    
    container.innerHTML = '';
    
    subjects.forEach(subject => {
        const percentage = parseFloat(subject.percentage);
        let statusText = percentage >= 75 ? 'Good ✅' : (percentage >= 60 ? 'Warning! Below 75%' : 'Critical! Needs Improvement');
        
        const card = document.createElement('div');
        card.className = 'glass-effect';
        card.style.padding = '15px';
        card.style.borderRadius = '10px';
        card.style.borderLeft = `4px solid ${percentage >= 75 ? '#28a745' : (percentage >= 60 ? '#ffc107' : '#dc3545')}`;
        
        card.innerHTML = `
            <h4 style="margin: 0 0 5px 0;">${subject.subjectName}</h4>
            <p style="color: #666; font-size: 12px; margin-bottom: 10px;">${subject.subjectCode} | ${subject.department || 'General'}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 24px; font-weight: bold; color: ${percentage >= 75 ? '#28a745' : (percentage >= 60 ? '#ffc107' : '#dc3545')};">${percentage}%</span>
                    <span style="font-size: 12px; color: #666;"> attendance</span>
                </div>
                <div style="text-align: right;">
                    <div>Attended: ${subject.attended}</div>
                    <div>Total: ${subject.total}</div>
                </div>
            </div>
            <div style="margin-top: 10px;">
                <span style="font-size: 12px; color: ${percentage >= 75 ? '#28a745' : (percentage >= 60 ? '#856404' : '#dc3545')};">${statusText}</span>
            </div>
        `;
        
        container.appendChild(card);
    });
}

async function filterSubjectAttendance() {
    const subjectId = document.getElementById('subjectFilter')?.value || 'all';
    let filteredData = [...currentSubjectData];
    renderSubjectChart(filteredData);
    renderSubjectCards(filteredData);
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
                <td>N/A</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error filtering history:', error);
    }
}

// ============ QR SCANNER FUNCTIONS ============
async function scanQR() {
    document.getElementById('qrScannerModal').style.display = 'block';
}

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

function closeQRScanner() {
    const video = document.getElementById('qrVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById('qrScannerModal').style.display = 'none';
}

// ============ CONFIRM ATTENDANCE FUNCTIONS ============
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

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    window.currentLocation = null;
}

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
        
        const result = await API.student.markAttendance(
            currentScanData.sessionId,
            window.currentLocation,
            distanceInMeters
        );
        
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

// ============ HELPER FUNCTIONS ============
async function getCurrentLocation() {
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

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

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

// ============ EXPORT FUNCTIONS TO WINDOW ============
window.showSection = showSection;
window.scanQR = scanQR;
window.startQRScanner = startQRScanner;
window.closeQRScanner = closeQRScanner;
window.filterHistory = filterHistory;
window.changePassword = changePassword;
window.toggleDarkMode = toggleDarkMode;
window.closeConfirmModal = closeConfirmModal;
window.confirmAttendance = confirmAttendance;
window.openPhotoUpload = openPhotoUpload;
window.closePhotoModal = closePhotoModal;
window.uploadProfilePhoto = uploadProfilePhoto;
window.removeProfilePhoto = removeProfilePhoto;
window.filterSubjectAttendance = filterSubjectAttendance;