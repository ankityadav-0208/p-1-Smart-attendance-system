const express = require('express');
const router = express.Router();
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const Subject = require('../models/Subject');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// @desc    Get subject-wise attendance for teacher
// @route   GET /api/analytics/subject-attendance
router.get('/subject-attendance', authorize('teacher', 'admin'), async (req, res) => {
    try {
        let subjectQuery = {};
        if (req.user.role === 'teacher') {
            subjectQuery.teacherId = req.user.id;
        }
        
        const subjects = await Subject.find(subjectQuery);
        
        const subjectAttendance = [];
        
        for (const subject of subjects) {
            const sessions = await AttendanceSession.find({
                subjectId: subject._id,
                isActive: false
            });
            
            const totalSessions = sessions.length;
            
            const students = await User.find({ role: 'student' });
            
            let totalPresent = 0;
            for (const student of students) {
                const records = await AttendanceRecord.countDocuments({
                    studentId: student._id,
                    subjectId: subject._id
                });
                totalPresent += records;
            }
            
            const averageAttendance = students.length > 0 && totalSessions > 0
                ? (totalPresent / (students.length * totalSessions)) * 100
                : 0;
            
            subjectAttendance.push({
                subjectId: subject._id,
                subjectName: subject.name,
                subjectCode: subject.code,
                department: subject.department,
                semester: subject.semester,
                totalStudents: students.length,
                totalSessions,
                totalPresent,
                averageAttendance: averageAttendance.toFixed(1)
            });
        }
        
        res.json({ success: true, data: subjectAttendance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;