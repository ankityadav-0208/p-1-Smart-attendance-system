const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Subject = require('../models/Subject');
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');

// All routes require teacher or admin role
router.use(protect);
router.use(authorize('teacher', 'admin'));

// @desc    Start attendance session
// @route   POST /api/teacher/start-session
router.post('/start-session', async (req, res) => {
    try {
        const { classroomLocation, allowedRadius, subjectId } = req.body;

        const session = await AttendanceSession.create({
            createdBy: req.user.id,
            sessionToken: uuidv4(),
            classroomLocation,
            allowedRadius: allowedRadius || 1000,
            expiresAt: new Date(Date.now() + 5 * 60000), // 5 minutes
            subjectId: subjectId || null
        });

        // Log session start in ActivityLog
        try {
            const subject = subjectId ? await Subject.findById(subjectId) : null;
            const subjectName = subject ? `${subject.name} (${subject.code})` : 'General';
            await ActivityLog.create({
                type: 'session_started',
                title: 'Attendance Session Started',
                description: `${req.user.name} started a session for ${subjectName}`
            });
        } catch (logErr) {
            console.error('Error logging session start:', logErr);
        }

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

        // Log session stop in ActivityLog
        try {
            const subject = session.subjectId ? await Subject.findById(session.subjectId) : null;
            const subjectName = subject ? `${subject.name} (${subject.code})` : 'General';
            await ActivityLog.create({
                type: 'session_ended',
                title: 'Attendance Session Ended',
                description: `${req.user.name} ended the session for ${subjectName}`
            });
        } catch (logErr) {
            console.error('Error logging session stop:', logErr);
        }

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

// @desc    Refresh session token every 5 seconds
// @route   PUT /api/teacher/refresh-token/:id
router.put('/refresh-token/:id', async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (session.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (!session.isActive || session.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Session is no longer active' });
        }

        session.sessionToken = uuidv4();
        await session.save();

        res.json({
            success: true,
            data: { sessionToken: session.sessionToken }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
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
        const { sessionId, startDate, endDate, subjectId } = req.query;

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

        if (req.user.role !== 'admin') {
            const allottedSubjects = await Subject.find({ teacherId: req.user.id });
            const subjectIds = allottedSubjects.map(sub => sub._id);
            if (subjectId) {
                if (subjectIds.map(id => id.toString()).includes(subjectId.toString())) {
                    query.subjectId = subjectId;
                } else {
                    query.subjectId = null;
                }
            } else {
                query.subjectId = { $in: subjectIds };
            }
        } else if (subjectId) {
            query.subjectId = subjectId;
        }

        const records = await AttendanceRecord.find(query)
            .populate('studentId', 'name rollNumber section')
            .populate('sessionId', 'startTime createdBy')
            .populate('subjectId', 'name code')
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

        // Fetch sessions created by this teacher (or all if admin)
        let sessionQuery = {};
        if (req.user.role !== 'admin') {
            sessionQuery.createdBy = req.user.id;
        }
        const sessions = await AttendanceSession.find(sessionQuery);
        const sessionIds = sessions.map(s => s._id);
        const totalSessionsCount = sessionIds.length;

        // Fetch records matching those sessions
        const records = await AttendanceRecord.find({ sessionId: { $in: sessionIds } });

        // Map records by studentId to compute unique sessions attended and last attendance date
        const studentRecordsMap = {};
        records.forEach(r => {
            if (!r.studentId) return;
            const sId = r.studentId.toString();
            if (!studentRecordsMap[sId]) {
                studentRecordsMap[sId] = {
                    sessions: new Set(),
                    lastTimestamp: null
                };
            }
            studentRecordsMap[sId].sessions.add(r.sessionId.toString());
            if (!studentRecordsMap[sId].lastTimestamp || r.timestamp > studentRecordsMap[sId].lastTimestamp) {
                studentRecordsMap[sId].lastTimestamp = r.timestamp;
            }
        });

        // Attach statistics to each student object
        const studentData = students.map(student => {
            const stats = studentRecordsMap[student._id.toString()] || { sessions: new Set(), lastTimestamp: null };
            let percentage = 0;
            if (totalSessionsCount > 0) {
                percentage = (stats.sessions.size / totalSessionsCount) * 100;
            }

            return {
                ...student.toObject(),
                attendancePercentage: parseFloat(percentage.toFixed(1)),
                lastAttendanceDate: stats.lastTimestamp ? stats.lastTimestamp.toISOString() : 'Never'
            };
        });

        res.json({
            success: true,
            data: studentData
        });

    } catch (error) {
        console.error('Error fetching students with stats:', error);
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

// @desc    Get session-wise attendance records for teacher
// @route   GET /api/teacher/session-attendance
router.get('/session-attendance', async (req, res) => {
    try {
        const { startDate, endDate, subjectId } = req.query;
        
        // Get all students for total count
        const allStudents = await User.find({ role: 'student' }).select('_id name rollNumber section');
        const totalStudentsCount = allStudents.length;
        
        // Get sessions created by this teacher (or all if admin)
        let sessionQuery = {};
        if (req.user.role !== 'admin') {
            sessionQuery.createdBy = req.user.id;
        }
        if (subjectId) {
            sessionQuery.subjectId = subjectId;
        }
        const sessionsList = await AttendanceSession.find(sessionQuery);
        const sessionIds = sessionsList.map(s => s._id);

        // Build query for attendance records scoped to these sessions
        let recordQuery = { sessionId: { $in: sessionIds } };
        if (startDate && endDate) {
            recordQuery.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        // Get all attendance records
        const records = await AttendanceRecord.find(recordQuery)
            .populate('studentId', 'name rollNumber section')
            .populate({
                path: 'sessionId',
                populate: {
                    path: 'subjectId',
                    select: 'name code'
                }
            })
            .sort('-timestamp');
        
        // Group by session
        const sessionsMap = new Map();
        
        for (const record of records) {
            const session = record.sessionId;
            if (!session) continue;
            
            const sessionId = session._id.toString();
            
            if (!sessionsMap.has(sessionId)) {
                sessionsMap.set(sessionId, {
                    sessionId: sessionId,
                    date: session.startTime ? new Date(session.startTime).toLocaleDateString() : new Date(record.timestamp).toLocaleDateString(),
                    time: session.startTime ? new Date(session.startTime).toLocaleTimeString() : new Date(record.timestamp).toLocaleTimeString(),
                    subject: session.subjectId?.name || 'General',
                    subjectCode: session.subjectId?.code || '',
                    presentStudents: [],
                    presentStudentIds: new Set(), // Track IDs to avoid duplicates
                    totalStudents: totalStudentsCount,
                    timestamp: session.startTime || record.timestamp
                });
            }
            
            const sessionData = sessionsMap.get(sessionId);
            const student = record.studentId;
            
            // Add student to present list if not already added
            if (student && !sessionData.presentStudentIds.has(student._id.toString())) {
                sessionData.presentStudentIds.add(student._id.toString());
                sessionData.presentStudents.push({
                    id: student._id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    section: student.section
                });
            }
        }
        
        // Calculate absent students for each session
        const sessions = Array.from(sessionsMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        for (const session of sessions) {
            // Get present student IDs
            const presentIds = session.presentStudentIds;
            
            // Find absent students (students not in presentIds)
            const absentStudents = allStudents.filter(student => !presentIds.has(student._id.toString()));
            
            session.absentStudents = absentStudents;
            session.absentCount = absentStudents.length;
            session.presentCount = session.presentStudents.length;
            
            // Remove the temporary Set before sending response
            delete session.presentStudentIds;
            
            session.attendancePercentage = session.totalStudents > 0 
                ? ((session.presentCount / session.totalStudents) * 100).toFixed(1) 
                : 0;
        }
        
        res.json({
            success: true,
            data: sessions
        });
        
    } catch (error) {
        console.error('Error in session-attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


// @desc    Get all subjects for teacher
// @route   GET /api/teacher/subjects
router.get('/subjects', async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'admin') {
            query.teacherId = req.user.id;
        }
        const subjects = await Subject.find(query).populate('teacherId', 'name').sort('name');
        res.json({ success: true, data: subjects });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
