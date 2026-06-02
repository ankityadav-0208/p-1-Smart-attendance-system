const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const { protect, authorize, getDeviceId } = require('../middleware/auth');

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

// @desc    Submit attendance (without selfie)
// @route   POST /api/student/mark-attendance
router.post('/mark-attendance', async (req, res) => {
    try {
        const { sessionId, location, distance } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required'
            });
        }

        // Get session (this now includes subjectId)
        const session = await AttendanceSession.findById(sessionId);
        if (!session || !session.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or inactive session'
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

        // Check distance
        if (distance > session.allowedRadius) {
            return res.status(400).json({
                success: false,
                message: `You are ${Math.round(distance)} meters away. Maximum allowed distance is ${session.allowedRadius} meters.`
            });
        }

        // Create attendance record with subject from session
        const record = await AttendanceRecord.create({
            studentId: req.user.id,
            sessionId: session._id,
            subjectId: session.subjectId,
            location: location ? { ...location, distance } : null,
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
        console.error('Error in mark-attendance:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
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
            .populate('sessionId', 'startTime createdBy subjectId')
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

// @desc    Get student's subject-wise attendance
// @route   GET /api/student/subject-attendance
router.get('/subject-attendance', async (req, res) => {
    try {
        const Subject = require('../models/Subject');
        const subjects = await Subject.find();
        
        const subjectAttendance = [];
        
        for (const subject of subjects) {
            const sessions = await AttendanceSession.find({
                subjectId: subject._id,
                isActive: false
            });
            
            const totalSessions = sessions.length;
            
            const records = await AttendanceRecord.find({
                studentId: req.user.id,
                subjectId: subject._id
            });
            
            const attended = records.length;
            const percentage = totalSessions > 0 
                ? (attended / totalSessions * 100).toFixed(1) 
                : 0;
            
            subjectAttendance.push({
                subjectId: subject._id,
                subjectName: subject.name,
                subjectCode: subject.code,
                department: subject.department,
                semester: subject.semester,
                attended,
                total: totalSessions,
                percentage
            });
        }
        
        res.json({
            success: true,
            data: subjectAttendance
        });
        
    } catch (error) {
        console.error('Error in subject-attendance:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
});

module.exports = router;