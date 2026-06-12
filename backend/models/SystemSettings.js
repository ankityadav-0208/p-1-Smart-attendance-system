const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
    maxAllowedRadius: {
        type: Number,
        default: 1000 // in meters
    },
    sessionDuration: {
        type: Number,
        default: 5 // in minutes
    },
    qrRefreshInterval: {
        type: Number,
        default: 10 // in seconds
    },
    minAttendanceAlert: {
        type: Number,
        default: 75 // in percent
    },
    teacherVerificationCode: {
        type: String,
        default: 'TEACH2024SECURE'
    },
    masterAdminCode: {
        type: String,
        default: 'SUPER_ADMIN_2024'
    },
    lowAttendanceAlerts: {
        type: Boolean,
        default: true
    },
    newTeacherRegistration: {
        type: Boolean,
        default: true
    },
    sessionReports: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);
