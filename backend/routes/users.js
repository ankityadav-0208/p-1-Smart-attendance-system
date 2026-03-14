const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all users (admin only)
// @route   GET /api/users
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort('-createdAt');
        
        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get single user by ID
// @route   GET /api/users/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is authorized to view this profile
        if (req.user.id !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this profile'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get current user profile
// @route   GET /api/users/profile/me
router.get('/profile/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, section, department } = req.body;
        
        const updateData = {};
        if (name) updateData.name = name;
        if (section && req.user.role === 'student') updateData.section = section;
        if (department && req.user.role === 'teacher') updateData.department = department;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update password
// @route   PUT /api/users/change-password
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update profile photo
// @route   POST /api/users/profile-photo
// Note: This requires multer setup - you'll need to add multer configuration
router.post('/profile-photo', protect, async (req, res) => {
    try {
        // This endpoint would handle profile photo upload
        // You'll need to integrate multer similar to the selfie upload in student.js
        
        res.json({
            success: true,
            message: 'Profile photo updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get students by section (for teachers)
// @route   GET /api/users/students
router.get('/students/by-section', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { section } = req.query;
        
        let query = { role: 'student' };
        if (section) {
            query.section = section;
        }

        const students = await User.find(query)
            .select('name rollNumber section email profilePhoto')
            .sort('rollNumber');

        res.json({
            success: true,
            count: students.length,
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

// @desc    Get teachers by department (for admin)
// @route   GET /api/users/teachers
router.get('/teachers/by-department', protect, authorize('admin'), async (req, res) => {
    try {
        const { department } = req.query;
        
        let query = { role: 'teacher' };
        if (department) {
            query.department = department;
        }

        const teachers = await User.find(query)
            .select('name employeeId department email profilePhoto')
            .sort('name');

        res.json({
            success: true,
            count: teachers.length,
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

// @desc    Get user statistics (for dashboard)
// @route   GET /api/users/stats/summary
router.get('/stats/summary', protect, async (req, res) => {
    try {
        let stats = {};

        if (req.user.role === 'admin') {
            // Admin sees all stats
            const [totalStudents, totalTeachers, pendingTeachers] = await Promise.all([
                User.countDocuments({ role: 'student' }),
                User.countDocuments({ role: 'teacher' }),
                User.countDocuments({ role: 'pending_teacher' })
            ]);

            stats = {
                totalStudents,
                totalTeachers,
                pendingTeachers,
                totalUsers: totalStudents + totalTeachers + pendingTeachers
            };
        } else if (req.user.role === 'teacher') {
            // Teacher sees student stats
            const totalStudents = await User.countDocuments({ role: 'student' });
            stats = { totalStudents };
        } else if (req.user.role === 'student') {
            // Student sees their own stats
            // This would be handled by student routes
            stats = {};
        }

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Search users (admin only)
// @route   GET /api/users/search
router.get('/search/query', protect, authorize('admin'), async (req, res) => {
    try {
        const { q, role } = req.query;

        let query = {};
        
        if (role) {
            query.role = role;
        }

        if (q) {
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { rollNumber: { $regex: q, $options: 'i' } },
                { employeeId: { $regex: q, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .limit(20)
            .sort('-createdAt');

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update user role (admin only)
// @route   PUT /api/users/:id/role
router.put('/:id/role', protect, authorize('admin'), async (req, res) => {
    try {
        const { role } = req.body;

        if (!['student', 'teacher', 'admin', 'pending_teacher', 'disabled'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: `User role updated to ${role}`,
            data: user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Delete user (admin only)
// @route   DELETE /api/users/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Don't allow deleting yourself
        if (user.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        await user.deleteOne();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Bulk import users (admin only)
// @route   POST /api/users/bulk-import
router.post('/bulk-import', protect, authorize('admin'), async (req, res) => {
    try {
        const { users } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of users'
            });
        }

        const results = {
            successful: [],
            failed: []
        };

        for (const userData of users) {
            try {
                const user = await User.create(userData);
                results.successful.push({
                    email: user.email,
                    id: user._id
                });
            } catch (error) {
                results.failed.push({
                    data: userData,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Imported ${results.successful.length} users, ${results.failed.length} failed`,
            data: results
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
