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
                            console.log('Admin user, redirecting to teacher dashboard');
                            window.location.href = 'teacher-dashboard.html';
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

// Student Registration
async function registerStudent(userData) {
    try {
        showLoading();
        
        // Create authentication user
        const userCredential = await auth.createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );
        
        // Get device ID
        const deviceId = await getDeviceId();
        
        // Upload profile photo
        let photoURL = '';
        if (userData.photo) {
            photoURL = await uploadProfilePhoto(userCredential.user.uid, userData.photo);
        }
        
        // Store user data in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: userData.name,
            roll: userData.roll,
            section: userData.section,
            email: userData.email,
            role: 'student',
            deviceId: deviceId,
            profilePhotoURL: photoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Registration successful!', 'success');
        return userCredential.user;
        
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Registration failed. Please try again.';
        
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email already in use.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
        }
        
        showToast(errorMessage, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Teacher Registration
async function registerTeacher(userData) {
    try {
        showLoading();
        
        // Verify teacher code
        if (userData.verificationCode !== TEACHER_VERIFICATION_CODE) {
            throw new Error('Invalid teacher verification code');
        }
        
        // Check if email is from university domain
        if (!userData.email.includes('@university.edu')) {
            throw new Error('Please use your official university email');
        }
        
        // Create authentication user
        const userCredential = await auth.createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );
        
        // Upload profile photo
        let photoURL = '';
        if (userData.photo) {
            photoURL = await uploadProfilePhoto(userCredential.user.uid, userData.photo);
        }
        
        // Store user data in Firestore (pending approval)
        await db.collection('users').doc(userCredential.user.uid).set({
            name: userData.name,
            employeeId: userData.employeeId,
            department: userData.department,
            email: userData.email,
            role: 'pending_teacher',
            profilePhotoURL: photoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create teacher approval request
        await db.collection('teacher_approvals').doc(userCredential.user.uid).set({
            userId: userCredential.user.uid,
            name: userData.name,
            employeeId: userData.employeeId,
            department: userData.department,
            email: userData.email,
            status: 'pending',
            requestedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Registration submitted for approval!', 'success');
        return userCredential.user;
        
    } catch (error) {
        console.error('Teacher registration error:', error);
        showToast(error.message || 'Registration failed', 'error');
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
    const storageRef = storage.ref();
    const photoRef = storageRef.child(`profile_photos/${userId}/${Date.now()}_${file.name}`);
    
    try {
        const snapshot = await photoRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return downloadURL;
    } catch (error) {
        console.error('Photo upload error:', error);
        throw error;
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