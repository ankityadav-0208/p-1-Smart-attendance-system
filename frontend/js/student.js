// Student Dashboard Functions
let currentScanData = null;
let selfieImage = null;
let studentChart = null;

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
    document.getElementById('studentInfo').textContent = `${user.roll || ''} • ${user.section || ''}`;
    
    if (user.profilePhotoURL) {
        document.getElementById('profileImage').src = user.profilePhotoURL;
        document.getElementById('profilePhoto').src = user.profilePhotoURL;
    }

    // Load profile details
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileRoll').textContent = user.roll || 'N/A';
    document.getElementById('profileSection').textContent = user.section || 'N/A';
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileDeviceId').textContent = user.deviceId ? user.deviceId.substring(0, 16) + '...' : 'N/A';
    
    if (user.createdAt) {
        document.getElementById('profileJoined').textContent = new Date(user.createdAt).toLocaleDateString();
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
        history: 'Attendance History',
        analytics: 'Analytics',
        profile: 'Profile'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    // Load section-specific data
    if (section === 'history') loadAttendanceHistory();
    if (section === 'analytics') loadAnalytics();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Get total sessions
        const sessionsSnapshot = await db.collection('attendance_sessions')
            .where('active', '==', false)
            .get();
        const totalClasses = sessionsSnapshot.size;
        document.getElementById('totalClasses').textContent = totalClasses;

        // Get student's attendance
        const attendanceSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', user.uid)
            .get();
        
        const attended = attendanceSnapshot.size;
        document.getElementById('classesAttended').textContent = attended;

        // Calculate percentage
        const percentage = totalClasses > 0 ? (attended / totalClasses * 100).toFixed(1) : 0;
        document.getElementById('attendancePercentage').textContent = percentage + '%';

        // Load chart
        loadStudentChart();

        // Calculate rank (simplified - based on attendance percentage)
        const allStudentsSnapshot = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        
        const studentPercentages = [];
        for (const doc of allStudentsSnapshot.docs) {
            const studentAttendance = await db.collection('attendance_records')
                .where('studentId', '==', doc.id)
                .get();
            const studentPercentage = totalClasses > 0 ? (studentAttendance.size / totalClasses * 100) : 0;
            studentPercentages.push(studentPercentage);
        }
        
        studentPercentages.sort((a, b) => b - a);
        const rank = studentPercentages.indexOf(parseFloat(percentage)) + 1;
        document.getElementById('studentRank').textContent = rank || '-';

    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Load student chart
async function loadStudentChart() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    const ctx = document.getElementById('studentChart').getContext('2d');
    
    // Get last 30 days attendance
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const recordsSnapshot = await db.collection('attendance_records')
        .where('studentId', '==', user.uid)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

    // Create daily attendance map
    const dailyAttendance = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString();
        dailyAttendance[dateStr] = 0;
    }

    recordsSnapshot.forEach(doc => {
        const date = doc.data().timestamp.toDate().toLocaleDateString();
        dailyAttendance[date] = 1;
    });

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
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Load recent attendance
async function loadRecentAttendance() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        const recordsSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        const tbody = document.getElementById('recentAttendanceBody');
        tbody.innerHTML = '';

        recordsSnapshot.forEach(doc => {
            const record = doc.data();
            const date = record.timestamp.toDate();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${record.sessionId.substring(0, 8)}...</td>
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
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        const recordsSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .get();

        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        recordsSnapshot.forEach(doc => {
            const record = doc.data();
            const date = record.timestamp.toDate();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${record.sessionId.substring(0, 12)}...</td>
                <td>${record.location?.coords ? '✓ Verified' : 'N/A'}</td>
                <td>
                    ${record.selfieURL ? 
                        `<button class="btn btn-sm btn-primary" onclick="viewSelfie('${record.selfieURL}')">
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
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        const year = new Date().getFullYear();
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const recordsSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', user.uid)
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .orderBy('timestamp', 'desc')
            .get();

        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        recordsSnapshot.forEach(doc => {
            const record = doc.data();
            const date = record.timestamp.toDate();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${record.sessionId.substring(0, 12)}...</td>
                <td>${record.location?.coords ? '✓ Verified' : 'N/A'}</td>
                <td>
                    ${record.selfieURL ? 
                        `<button class="btn btn-sm btn-primary" onclick="viewSelfie('${record.selfieURL}')">
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

// Load analytics
async function loadAnalytics() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Get all attendance records
        const recordsSnapshot = await db.collection('attendance_records')
            .where('studentId', '==', user.uid)
            .get();
        
        const totalPresent = recordsSnapshot.size;
        
        // Get total classes
        const sessionsSnapshot = await db.collection('attendance_sessions')
            .where('active', '==', false)
            .get();
        const totalClasses = sessionsSnapshot.size;
        const totalAbsent = totalClasses - totalPresent;
        
        const percentage = totalClasses > 0 ? (totalPresent / totalClasses * 100).toFixed(1) : 0;

        // Update summary
        document.getElementById('presentCount').textContent = totalPresent;
        document.getElementById('absentCount').textContent = totalAbsent;
        document.getElementById('totalPercentage').textContent = percentage + '%';
        
        // Calculate required attendance to maintain 75%
        const requiredToMaintain = Math.max(0, Math.ceil(0.75 * totalClasses - totalPresent));
        document.getElementById('requiredAttendance').textContent = requiredToMaintain;

        // Load weekly chart
        loadWeeklyChart();
        
        // Load monthly comparison
        loadMonthlyComparison();
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Load weekly chart
async function loadWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // Get last 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const recordsSnapshot = await db.collection('attendance_records')
        .where('studentId', '==', user.uid)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();

    recordsSnapshot.forEach(doc => {
        const date = doc.data().timestamp.toDate();
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
            maintainAspectRatio: false
        }
    });
}

// Load monthly comparison
async function loadMonthlyComparison() {
    const ctx = document.getElementById('monthlyComparisonChart').getContext('2d');
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = new Array(12).fill(0);
    const monthlyTotal = new Array(12).fill(0);

    // Get all sessions by month
    const sessionsSnapshot = await db.collection('attendance_sessions')
        .where('active', '==', false)
        .get();

    sessionsSnapshot.forEach(doc => {
        const session = doc.data();
        if (session.startTime) {
            const month = session.startTime.toDate().getMonth();
            monthlyTotal[month]++;
        }
    });

    // Get student's attendance by month
    const recordsSnapshot = await db.collection('attendance_records')
        .where('studentId', '==', user.uid)
        .get();

    recordsSnapshot.forEach(doc => {
        const record = doc.data();
        const month = record.timestamp.toDate().getMonth();
        monthlyData[month]++;
    });

    // Calculate percentages
    const percentages = monthlyData.map((attended, index) => 
        monthlyTotal[index] > 0 ? (attended / monthlyTotal[index] * 100).toFixed(1) : 0
    );

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Attendance %',
                data: percentages,
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
        
        // Start scanning
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
                
                // Stop video stream
                video.srcObject.getTracks().forEach(track => track.stop());
            }
        }
    }, 500);
}

// Process QR code data
async function processQRCode(qrData) {
    try {
        const data = JSON.parse(qrData);
        
        // Validate QR data
        if (data.type !== 'attendance') {
            throw new Error('Invalid QR code');
        }

        // Check if session exists and is active
        const sessionDoc = await db.collection('attendance_sessions').doc(data.sessionId).get();
        
        if (!sessionDoc.exists) {
            throw new Error('Invalid session');
        }

        const session = sessionDoc.data();
        
        if (!session.active) {
            throw new Error('Session has ended');
        }

        // Check token
        if (session.sessionToken !== data.token) {
            throw new Error('Invalid session token');
        }

        // Check if already marked
        const user = JSON.parse(sessionStorage.getItem('currentUser'));
        const existingRecord = await db.collection('attendance_records')
            .where('sessionId', '==', data.sessionId)
            .where('studentId', '==', user.uid)
            .get();

        if (!existingRecord.empty) {
            throw new Error('Attendance already marked for this session');
        }

        // Check device ID
        const deviceId = await getDeviceId();
        if (user.deviceId !== deviceId) {
            throw new Error('Device not recognized. Please use your registered device.');
        }

        // Store scan data
        currentScanData = {
            sessionId: data.sessionId,
            token: data.token
        };

        // Close scanner and open selfie capture
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
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
        selfieImage = blob;
        
        // Show preview
        preview.src = URL.createObjectURL(blob);
        preview.classList.remove('hidden');
        video.classList.add('hidden');
        
        // Update buttons
        document.getElementById('submitAttendanceBtn').disabled = false;
        document.getElementById('retakeBtn').style.display = 'inline-block';
        
        // Stop video
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
    
    // Restart video
    openSelfieCapture();
}

// Submit attendance - SIMPLIFIED VERSION
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
        
        // Your classroom coordinates
        const classroomLocation = {
            latitude: 29.171743, // Change to your coordinates
            longitude: 75.735818
        };
        
        // Calculate distance
        const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            classroomLocation.latitude,
            classroomLocation.longitude
        );
        
        const distanceInMeters = Math.round(distance);
        
        if (distanceInMeters > 1000) {
            throw new Error(`You are ${distanceInMeters}m away. Max allowed: 1000m`);
        }
        
        // Upload selfie
        const selfieURL = await uploadSelfie(user.uid, currentScanData.sessionId, selfieImage);
        
        // Save attendance
        await db.collection('attendance_records').add({
            studentId: user.uid,
            sessionId: currentScanData.sessionId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            location: {
                coords: position.coords,
                distance: distanceInMeters
            },
            selfieURL: selfieURL
        });
        
        showToast('✅ Attendance marked successfully!', 'success');
        
        // Close modal
        closeSelfieModal();
        
        // Refresh data
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
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Upload selfie
async function uploadSelfie(userId, sessionId, blob) {
    const storageRef = storage.ref();
    const selfieRef = storageRef.child(`selfies/${userId}/${sessionId}_${Date.now()}.jpg`);
    
    try {
        const snapshot = await selfieRef.put(blob);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return downloadURL;
    } catch (error) {
        console.error('Selfie upload error:', error);
        throw new Error('Failed to upload selfie');
    }
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

// Update photo
async function updatePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                showLoading();
                const user = JSON.parse(sessionStorage.getItem('currentUser'));
                const photoURL = await uploadProfilePhoto(user.uid, file);
                
                await db.collection('users').doc(user.uid).update({
                    profilePhotoURL: photoURL
                });
                
                // Update session
                user.profilePhotoURL = photoURL;
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                
                // Update UI
                document.getElementById('profileImage').src = photoURL;
                document.getElementById('profilePhoto').src = photoURL;
                
                showToast('Profile photo updated', 'success');
            } catch (error) {
                showToast('Error updating photo', 'error');
            } finally {
                hideLoading();
            }
        }
    };
    
    input.click();
}

// Change password
async function changePassword() {
    const newPassword = prompt('Enter new password (minimum 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        try {
            showLoading();
            const user = auth.currentUser;
            await user.updatePassword(newPassword);
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


// Test function for submit button
document.addEventListener('DOMContentLoaded', function() {
    const submitBtn = document.getElementById('submitAttendanceBtn');
    if (submitBtn) {
        console.log('✅ Submit button found in DOM');
        submitBtn.addEventListener('click', function(e) {
            console.log('👆 Submit button clicked via event listener');
            submitAttendance();
        });
    } else {
        console.error('❌ Submit button not found in DOM');
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