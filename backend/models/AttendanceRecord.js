const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSession',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        distance: Number
    },
    // selfieUrl field REMOVED
    deviceId: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    }
}, {
    timestamps: true
});

// Ensure one student per session (unique compound index)
AttendanceRecordSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', AttendanceRecordSchema);