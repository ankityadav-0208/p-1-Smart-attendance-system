// Authentication State Observer
auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
    
    if (user) {
        console.log('User UID:', user.uid);
        
        try {
            console.log('Fetching user data from Firestore...');
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('User data:', userData);
                
                // Store user data in session
                sessionStorage.setItem('currentUser', JSON.stringify({
                    uid: user.uid,
                    ...userData
                }));

                // Get current page filename
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                console.log('Current page:', currentPage);
                console.log('User role:', userData.role);
                
                // Don't redirect if already on dashboard pages
                if (currentPage === 'index.html' || currentPage === '' || currentPage.includes('index')) {
                    console.log('On index page, redirecting based on role...');
                    
                    // Redirect based on role
                    switch(userData.role) {
                        case 'student':
                            console.log('Redirecting to student dashboard');
                            window.location.href = 'student-dashboard.html';
                            break;
                        case 'teacher':
                            console.log('Redirecting to teacher dashboard');
                            window.location.href = 'teacher-dashboard.html';
                            break;
                        case 'admin':
                            console.log('Redirecting to admin dashboard');
                            window.location.href = 'admin-dashboard.html';
                            break;
                        case 'pending_teacher':
                            console.log('Redirecting to pending approval');
                            window.location.href = 'pending-approval.html';
                            break;
                        default:
                            console.log('Unknown role:', userData.role);
                    }
                } else {
                    console.log('Already on a dashboard page, no redirect needed');
                }
            } else {
                console.log('No user document found in Firestore');
                // Sign out if no user document
                auth.signOut();
                showToast('User data not found', 'error');
            }
        } catch (error) {
            console.error('Auth state error:', error);
            showToast('Error loading user data', 'error');
        }
    } else {
        // User is signed out
        console.log('User is signed out');
        sessionStorage.removeItem('currentUser');
        
        // If not on index page, redirect to index
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage !== 'index.html' && currentPage !== '') {
            console.log('Redirecting to index page');
            window.location.href = 'index.html';
        }
    }
});

// Login Function
async function login(email, password) {
    try {
        showLoading();
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!', 'success');
        
        // Don't redirect here - let the onAuthStateChanged handle it
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No user found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
        }
        
        showToast(errorMessage, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Student Registration - Ultra Simple Version
async function registerStudent(userData) {
    try {
        showLoading();
        console.log('Starting registration for:', userData.email);
        
        // Create authentication user
        const userCredential = await auth.createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );
        
        console.log('User created in Auth:', userCredential.user.uid);
        
        // Get device ID
        const deviceId = await getDeviceId();
        
        // Simple user data
        const userDocData = {
            name: userData.name,
            roll: userData.roll,
            section: userData.section,
            email: userData.email,
            role: 'student',
            deviceId: deviceId,
            profilePhotoURL: '',
            createdAt: new Date().toISOString() // Simple timestamp
        };
        
        console.log('Saving to Firestore:', userDocData);
        
        // Save to Firestore
        await db.collection('users').doc(userCredential.user.uid).set(userDocData);
        
        console.log('Firestore save complete');
        showToast('Registration successful!', 'success');
        
        closeModals();
        
        // Redirect
        setTimeout(() => {
            window.location.href = 'student-dashboard.html';
        }, 1500);
        
        return userCredential.user;
        
    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Show the actual error
        showToast('Error: ' + error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Teacher Registration - COMPLETELY FIXED VERSION
// In your auth.js, replace the registerTeacher function with this WORKING version:
async function registerTeacher(userData) {
    try {
        showLoading();
        
        // Verify teacher code
        if (userData.verificationCode !== TEACHER_VERIFICATION_CODE) {
            throw new Error('Invalid teacher verification code');
        }
        
        // Check email domain
        if (!userData.email.includes('@university.edu')) {
            throw new Error('Please use your official university email');
        }
        
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );
        
        const userId = userCredential.user.uid;
        
        // Save to users collection
        await db.collection('users').doc(userId).set({
            name: userData.name,
            employeeId: userData.employeeId,
            department: userData.department,
            email: userData.email,
            role: 'pending_teacher',
            profilePhotoURL: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Save to teacher_approvals collection
        await db.collection('teacher_approvals').doc(userId).set({
            userId: userId,
            name: userData.name,
            employeeId: userData.employeeId,
            department: userData.department,
            email: userData.email,
            status: 'pending',
            requestedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Registration submitted for approval!', 'success');
        closeModals();
        
        setTimeout(() => {
            window.location.href = 'pending-approval.html';
        }, 1500);
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
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
    
    // Create a hash of the fingerprint
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// Upload Profile Photo
async function uploadProfilePhoto(userId, file) {
    if (!file) {
        console.log('No file provided');
        return '';
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Photo size should be less than 5MB', 'warning');
        return '';
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'warning');
        return '';
    }
    
    try {
        console.log('Starting photo upload for user:', userId);
        console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        const storageRef = storage.ref();
        
        // Create a clean filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `profile_${timestamp}.${fileExtension}`;
        const photoRef = storageRef.child(`profile_photos/${userId}/${fileName}`);
        
        // Upload the file
        const snapshot = await photoRef.put(file, {
            contentType: file.type
        });
        
        console.log('Upload successful, getting download URL...');
        
        // Get the download URL
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log('Photo uploaded successfully. URL:', downloadURL);
        
        return downloadURL;
        
    } catch (error) {
        console.error('Photo upload error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Show specific error message
        if (error.code === 'storage/unauthorized') {
            showToast('Storage permission denied. Check Firebase Storage rules.', 'error');
        } else if (error.code === 'storage/canceled') {
            showToast('Upload was canceled', 'warning');
        } else if (error.code === 'storage/unknown') {
            showToast('Network error. Check your connection.', 'error');
        } else {
            showToast('Photo upload failed: ' + error.message, 'error');
        }
        
        return ''; // Return empty string on error
    }
}

// Logout Function
async function logout() {
    try {
        showLoading();
        await auth.signOut();
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    } finally {
        hideLoading();
    }
}

// Inactivity Timer
let inactivityTimer;
const INACTIVITY_TIME = 5 * 60 * 1000; // 5 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        showToast('Session expired due to inactivity', 'warning');
        logout();
    }, INACTIVITY_TIME);
}

// Initialize inactivity timer on user interaction
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('scroll', resetInactivityTimer);