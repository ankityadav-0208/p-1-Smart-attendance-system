const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const { protect, authorize } = require('../middleware/auth');

// All routes require teacher or admin role
router.use(protect);
router.use(authorize('teacher', 'admin'));

// @desc    Start attendance session
// @route   POST /api/teacher/start-session
router.post('/start-session', async (req, res) => {
    try {
        const { classroomLocation, allowedRadius } = req.body;

        const session = await AttendanceSession.create({
            createdBy: req.user.id,
            sessionToken: uuidv4(),
            classroomLocation,
            allowedRadius: allowedRadius || 1000,
            expiresAt: new Date(Date.now() + 5 * 60000) // 5 minutes
        });

        res.json({
            success: true,
            data: {
                sessionId: session._id,
                sessionToken: session.sessionToken,
                expiresAt: session.expiresAt
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

// @desc    Stop attendance session
// @route   PUT /api/teacher/stop-session/:id
router.put('/stop-session/:id', async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // Check if user owns this session
        if (session.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        session.isActive = false;
        session.endTime = Date.now();
        await session.save();

        res.json({
            success: true,
            message: 'Session stopped successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get active sessions
// @route   GET /api/teacher/active-sessions
router.get('/active-sessions', async (req, res) => {
    try {
        const sessions = await AttendanceSession.find({
            createdBy: req.user.id,
            isActive: true
        }).sort('-startTime');

        res.json({
            success: true,
            data: sessions
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get attendance records
// @route   GET /api/teacher/attendance-records
router.get('/attendance-records', async (req, res) => {
    try {
        const { sessionId, startDate, endDate } = req.query;

        let query = {};
        
        if (sessionId) {
            query.sessionId = sessionId;
        }

        if (startDate && endDate) {
            query.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const records = await AttendanceRecord.find(query)
            .populate('studentId', 'name rollNumber section')
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

// @desc    Get all students
// @route   GET /api/teacher/students
router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('name rollNumber section email profilePhoto')
            .sort('rollNumber');

        res.json({
            success: true,
            data: students
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get attendance report
// @route   GET /api/teacher/report
router.get('/report', async (req, res) => {
    try {
        const { month, year, section } = req.query;

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        // Get all students (filter by section if provided)
        let studentQuery = { role: 'student' };
        if (section) {
            studentQuery.section = section;
        }
        const students = await User.find(studentQuery).select('name rollNumber section');

        // Get attendance records for the month
        const records = await AttendanceRecord.find({
            timestamp: { $gte: startDate, $lte: endDate }
        });

        // Get total sessions in the month
        const sessions = await AttendanceSession.find({
            startTime: { $gte: startDate, $lte: endDate }
        });

        // Calculate attendance percentage for each student
        const report = students.map(student => {
            const studentRecords = records.filter(r => 
                r.studentId.toString() === student._id.toString()
            );
            const percentage = sessions.length > 0 
                ? (studentRecords.length / sessions.length * 100).toFixed(1)
                : 0;

            return {
                ...student.toObject(),
                attended: studentRecords.length,
                total: sessions.length,
                percentage
            };
        });

        res.json({
            success: true,
            data: report
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
