const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TeacherApproval = require('../models/TeacherApproval');
const AttendanceSession = require('../models/AttendanceSession');
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

module.exports = router;
