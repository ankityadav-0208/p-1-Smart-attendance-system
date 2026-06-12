const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['student_registered', 'teacher_approved', 'low_attendance', 'session_ended', 'session_started', 'teacher_registered', 'teacher_rejected', 'user_disabled', 'settings_updated']
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
