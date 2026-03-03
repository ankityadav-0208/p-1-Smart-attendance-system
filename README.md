# Smart Attendance Management System

A production-ready attendance management system for universities that prevents proxy attendance using multi-factor verification.

## Features

### 🔐 Security Features
- **Dynamic QR Codes**: Refresh every 10 seconds to prevent sharing
- **Location Verification**: Students must be within 50 meters of classroom
- **Auto Selfie Capture**: Automatic face capture during attendance
- **Device Binding**: Students tied to registered devices
- **Time Restrictions**: Sessions expire after 5 minutes
- **Role-based Access**: Separate student/teacher dashboards
- **Teacher Verification**: Multi-layer teacher registration system

### 👨‍🎓 Student Features
- Scan QR codes to mark attendance
- View attendance history and analytics
- Monthly attendance graphs
- Profile management
- Real-time attendance percentage

### 👨‍🏫 Teacher Features
- Generate dynamic QR codes
- Monitor live attendance
- View/download attendance reports
- Approve teacher registrations (admin)
- Student management
- Analytics dashboard

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Libraries**: Chart.js, QRCode.js
- **Hosting**: GitHub Pages

## Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication (Email/Password)
4. Create Firestore Database
5. Enable Storage
6. Get your Firebase config object

### 2. Project Setup

1. Clone this repository
2. Update `js/firebase-config.js` with your Firebase credentials:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};