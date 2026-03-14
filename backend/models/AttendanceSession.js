const mongoose = require('mongoose');

const AttendanceSessionSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionToken: {
        type: String,
        required: true,
        unique: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    classroomLocation: {
        latitude: Number,
        longitude: Number
    },
    allowedRadius: {
        type: Number,
        default: 1000 // 1 km in meters
    },
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 5*60000) // 5 minutes from now
    }
});

module.exports = mongoose.model('AttendanceSession', AttendanceSessionSchema);