const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin', 'pending_teacher', 'disabled'],
        default: 'student'
    },
    rollNumber: { type: String, sparse: true },
    section: { type: String, sparse: true },
    employeeId: { type: String, sparse: true },
    department: { type: String, sparse: true },
    deviceId: { type: String, sparse: true },
    profilePhoto: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
}, { timestamps: true });

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ FIXED: Check if model already exists before creating
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
