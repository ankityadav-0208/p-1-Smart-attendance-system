const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @desc    Get all subjects
// @route   GET /api/subjects
router.get('/', async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'teacher') {
            query.teacherId = req.user.id;
        }
        const subjects = await Subject.find(query)
            .populate('teacherId', 'name')
            .sort('name');
        res.json({ success: true, data: subjects });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get single subject
// @route   GET /api/subjects/:id
router.get('/:id', async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id)
            .populate('teacherId', 'name');
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }
        res.json({ success: true, data: subject });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Create subject (admin only)
// @route   POST /api/subjects
router.post('/', authorize('admin'), async (req, res) => {
    try {
        const { name, code, department, semester, teacherId, description } = req.body;
        
        // Check if code already exists
        const existing = await Subject.findOne({ code });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Subject code already exists' });
        }
        
        const subject = await Subject.create({
            name,
            code: code.toUpperCase(),
            department,
            semester,
            teacherId,
            description
        });
        
        res.status(201).json({ success: true, data: subject });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Update subject (admin only)
// @route   PUT /api/subjects/:id
router.put('/:id', authorize('admin'), async (req, res) => {
    try {
        const subject = await Subject.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }
        res.json({ success: true, data: subject });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Delete subject (admin only)
// @route   DELETE /api/subjects/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
    try {
        const subject = await Subject.findByIdAndDelete(req.params.id);
        if (!subject) {
            return res.status(404).json({ success: false, message: 'Subject not found' });
        }
        res.json({ success: true, message: 'Subject deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;