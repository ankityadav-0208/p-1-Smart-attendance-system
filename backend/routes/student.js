const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const { protect, authorize, getDeviceId } = require('../middleware/auth');

// Configure multer for selfie uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = `uploads/selfies/${req.user.id}`;
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// All routes require student role
router.use(protect);
router.use(authorize('student'));

// @desc    Validate session QR
// @route   POST /api/student/validate-session
router.post('/validate-session', async (req, res) => {
    try {
        const { sessionId, token } = req.body;

        const session = await AttendanceSession.findOne({
            _id: sessionId,
            sessionToken: token,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired session'
            });
        }

        // Check if already marked
        const existing = await AttendanceRecord.findOne({
            studentId: req.user.id,
            sessionId: session._id
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Attendance already marked for this session'
            });
        }

        // Check device ID
        const deviceId = getDeviceId(req);
        if (req.user.deviceId && req.user.deviceId !== deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Device not recognized. Please use your registered device.'
            });
        }

        res.json({
            success: true,
            data: {
                sessionId: session._id,
                classroomLocation: session.classroomLocation,
                allowedRadius: session.allowedRadius
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Submit attendance with selfie
// @route   POST /api/student/mark-attendance
router.post('/mark-attendance', upload.single('selfie'), async (req, res) => {
    try {
        const { sessionId, location } = JSON.parse(req.body.data || '{}');
        const selfieFile = req.file;

        if (!selfieFile) {
            return res.status(400).json({
                success: false,
                message: 'Selfie is required'
            });
        }

        // Get session
        const session = await AttendanceSession.findById(sessionId);
        if (!session || !session.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or inactive session'
            });
        }

        // Calculate distance from classroom
        const studentLoc = JSON.parse(location);
        const distance = calculateDistance(
            studentLoc.latitude,
            studentLoc.longitude,
            session.classroomLocation.latitude,
            session.classroomLocation.longitude
        );

        if (distance > session.allowedRadius) {
            return res.status(400).json({
                success: false,
                message: `You are ${Math.round(distance)} meters away. Maximum allowed distance is ${session.allowedRadius} meters.`
            });
        }

        // Create selfie URL
        const selfieUrl = `${req.protocol}://${req.get('host')}/uploads/selfies/${req.user.id}/${selfieFile.filename}`;

        // Create attendance record
        const record = await AttendanceRecord.create({
            studentId: req.user.id,
            sessionId: session._id,
            location: {
                ...studentLoc,
                distance
            },
            selfieUrl,
            deviceId: getDeviceId(req),
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Attendance marked successfully',
            data: record
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Helper function to calculate distance between coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// @desc    Get student's attendance history
// @route   GET /api/student/history
router.get('/history', async (req, res) => {
    try {
        const records = await AttendanceRecord.find({ studentId: req.user.id })
            .populate('sessionId', 'startTime createdBy')
            .sort('-timestamp');

        res.json({
            success: true,
            data: records
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get student's attendance stats
// @route   GET /api/student/stats
router.get('/stats', async (req, res) => {
    try {
        const [records, sessions] = await Promise.all([
            AttendanceRecord.find({ studentId: req.user.id }),
            AttendanceSession.find({ isActive: false })
        ]);

        const attended = records.length;
        const total = sessions.length;
        const percentage = total > 0 ? (attended / total * 100).toFixed(1) : 0;

        // Get last 30 days attendance
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentRecords = await AttendanceRecord.find({
            studentId: req.user.id,
            timestamp: { $gte: thirtyDaysAgo }
        }).sort('timestamp');

        const dailyAttendance = {};
        for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dailyAttendance[dateStr] = 0;
        }

        recentRecords.forEach(record => {
            const dateStr = record.timestamp.toISOString().split('T')[0];
            dailyAttendance[dateStr] = 1;
        });

        res.json({
            success: true,
            data: {
                attended,
                total,
                percentage,
                dailyAttendance
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
