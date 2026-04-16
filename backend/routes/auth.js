const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User'); 
const TeacherApproval = require('../models/TeacherApproval');
const { generateToken, getDeviceId } = require('../middleware/auth');

// @desc    Register student
// @route   POST /api/auth/register/student
router.post('/register/student', async (req, res) => {
    try {
        const { name, email, password, rollNumber, section } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Get device ID
        const deviceId = getDeviceId(req);

        // Create user
        user = await User.create({
            name,
            email,
            password,
            rollNumber,
            section,
            role: 'student',
            deviceId
        });

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                rollNumber: user.rollNumber,
                section: user.section
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

// @desc    Register teacher
// @route   POST /api/auth/register/teacher
router.post('/register/teacher', async (req, res) => {
    try {
        const { name, email, password, employeeId, department, verificationCode } = req.body;

        // Verify teacher code
        if (verificationCode !== process.env.TEACHER_VERIFICATION_CODE) {
            return res.status(400).json({
                success: false,
                message: 'Invalid teacher verification code'
            });
        }

        // Check email domain
        if (!email.includes('@university.edu')) {
            return res.status(400).json({
                success: false,
                message: 'Please use your official university email'
            });
        }

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Create user as pending_teacher
        user = await User.create({
            name,
            email,
            password,
            employeeId,
            department,
            role: 'pending_teacher'
        });

        // Create approval request
        await TeacherApproval.create({
            userId: user._id,
            name,
            employeeId,
            department,
            email,
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Registration submitted for approval',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
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

// @desc    Login user
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is disabled
        if (user.role === 'disabled') {
            return res.status(401).json({
                success: false,
                message: 'Your account has been disabled'
            });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                ...(user.rollNumber && { rollNumber: user.rollNumber }),
                ...(user.section && { section: user.section }),
                ...(user.employeeId && { employeeId: user.employeeId }),
                ...(user.department && { department: user.department })
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

// @desc    Get current logged in user
// @route   GET /api/auth/me
router.get('/me', require('../middleware/auth').protect, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;