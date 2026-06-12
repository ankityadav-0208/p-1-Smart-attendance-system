const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TeacherApproval = require('../models/TeacherApproval');
const AttendanceSession = require('../models/AttendanceSession');
const SystemSettings = require('../models/SystemSettings');
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const [teachers, students, pending, sessions] = await Promise.all([
            User.countDocuments({ role: 'teacher' }),
            User.countDocuments({ role: 'student' }),
            TeacherApproval.countDocuments({ status: 'pending' }),
            AttendanceSession.countDocuments()
        ]);

        res.json({
            success: true,
            data: {
                teachers,
                students,
                pending,
                sessions
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

// @desc    Get all teachers
// @route   GET /api/admin/teachers
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' })
            .select('-password')
            .sort('-createdAt');

        res.json({
            success: true,
            data: teachers
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
// @route   GET /api/admin/students
router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('-password')
            .sort('-createdAt');

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

// @desc    Get pending teacher approvals
// @route   GET /api/admin/pending-approvals
router.get('/pending-approvals', async (req, res) => {
    try {
        const pending = await TeacherApproval.find({ status: 'pending' })
            .populate('userId', 'name email')
            .sort('-requestedAt');

        res.json({
            success: true,
            data: pending
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Approve teacher
// @route   PUT /api/admin/approve-teacher/:id
router.put('/approve-teacher/:id', async (req, res) => {
    try {
        const approval = await TeacherApproval.findById(req.params.id);
        
        if (!approval) {
            return res.status(404).json({
                success: false,
                message: 'Approval request not found'
            });
        }

        // Update user role
        await User.findByIdAndUpdate(approval.userId, {
            role: 'teacher'
        });

        // Update approval status
        approval.status = 'approved';
        approval.reviewedAt = Date.now();
        approval.reviewedBy = req.user.id;
        await approval.save();

        res.json({
            success: true,
            message: 'Teacher approved successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Reject teacher
// @route   PUT /api/admin/reject-teacher/:id
router.put('/reject-teacher/:id', async (req, res) => {
    try {
        const approval = await TeacherApproval.findById(req.params.id);
        
        if (!approval) {
            return res.status(404).json({
                success: false,
                message: 'Approval request not found'
            });
        }

        approval.status = 'rejected';
        approval.reviewedAt = Date.now();
        approval.reviewedBy = req.user.id;
        await approval.save();

        // Optionally delete or disable user
        await User.findByIdAndUpdate(approval.userId, {
            role: 'disabled'
        });

        res.json({
            success: true,
            message: 'Teacher request rejected'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Disable user
// @route   PUT /api/admin/disable-user/:id
router.put('/disable-user/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, {
            role: 'disabled'
        });

        res.json({
            success: true,
            message: 'User disabled successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get admin settings
// @route   GET /api/admin/settings
router.get('/settings', async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Update admin settings
// @route   PUT /api/admin/settings
router.put('/settings', async (req, res) => {
    try {
        const { maxAllowedRadius, sessionDuration, qrRefreshInterval, minAttendanceAlert } = req.body;
        
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = new SystemSettings();
        }
        
        if (maxAllowedRadius !== undefined) settings.maxAllowedRadius = maxAllowedRadius;
        if (sessionDuration !== undefined) settings.sessionDuration = sessionDuration;
        if (qrRefreshInterval !== undefined) settings.qrRefreshInterval = qrRefreshInterval;
        if (minAttendanceAlert !== undefined) settings.minAttendanceAlert = minAttendanceAlert;
        
        await settings.save();
        
        await ActivityLog.create({
            type: 'settings_updated',
            title: 'System Settings Updated',
            description: `Global behavior parameters updated.`
        });
        
        res.json({ success: true, message: 'Settings saved successfully', data: settings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Update admin access codes
// @route   PUT /api/admin/access-codes
router.put('/access-codes', async (req, res) => {
    try {
        const { teacherVerificationCode, masterAdminCode } = req.body;
        
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = new SystemSettings();
        }
        
        if (teacherVerificationCode) settings.teacherVerificationCode = teacherVerificationCode;
        if (masterAdminCode) settings.masterAdminCode = masterAdminCode;
        
        await settings.save();
        
        await ActivityLog.create({
            type: 'settings_updated',
            title: 'Access Codes Rotated',
            description: `Teacher registration or admin codes were modified.`
        });
        
        res.json({ success: true, message: 'Access codes updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Update admin notification settings
// @route   PUT /api/admin/notifications
router.put('/notifications', async (req, res) => {
    try {
        const { lowAttendanceAlerts, newTeacherRegistration, sessionReports } = req.body;
        
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = new SystemSettings();
        }
        
        if (lowAttendanceAlerts !== undefined) settings.lowAttendanceAlerts = lowAttendanceAlerts;
        if (newTeacherRegistration !== undefined) settings.newTeacherRegistration = newTeacherRegistration;
        if (sessionReports !== undefined) settings.sessionReports = sessionReports;
        
        await settings.save();
        res.json({ success: true, message: 'Notification preferences saved successfully', data: settings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get activity log
// @route   GET /api/admin/activity
router.get('/activity', async (req, res) => {
    try {
        const logs = await ActivityLog.find()
            .sort('-timestamp')
            .limit(10);
            
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Clear all sessions (Danger Zone)
// @route   POST /api/admin/clear-sessions
router.post('/clear-sessions', async (req, res) => {
    try {
        const AttendanceRecord = require('../models/AttendanceRecord');
        await AttendanceSession.deleteMany({});
        await AttendanceRecord.deleteMany({});
        
        await ActivityLog.create({
            type: 'session_ended',
            title: 'All Sessions Purged',
            description: 'All attendance sessions and check-in logs were cleared.'
        });
        
        res.json({ success: true, message: 'All attendance sessions and records cleared.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Remove all students (Danger Zone)
// @route   POST /api/admin/remove-students
router.post('/remove-students', async (req, res) => {
    try {
        await User.deleteMany({ role: 'student' });
        
        await ActivityLog.create({
            type: 'user_disabled',
            title: 'All Students Purged',
            description: 'All student accounts deleted permanently.'
        });
        
        res.json({ success: true, message: 'All student accounts deleted permanently.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;