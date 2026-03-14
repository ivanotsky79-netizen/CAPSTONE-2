const jwt = require('jsonwebtoken');

// Simple authentication for Admin and Canteen roles
// In a real production app, these would be in a database with hashed passwords
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fugen2026';
        const CANTEEN_USERNAME = process.env.CANTEEN_USERNAME || 'canteen';
        const CANTEEN_PASSWORD = process.env.CANTEEN_PASSWORD || 'canteen2026';

        let role = null;

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            role = 'admin';
        } else if (username === CANTEEN_USERNAME && password === CANTEEN_PASSWORD) {
            role = 'canteen';
        }

        if (!role) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { username, role },
            process.env.JWT_SECRET || 'fugen_secret_key_2026',
            { expiresIn: '30d' }
        );

        res.status(200).json({
            status: 'success',
            token,
            user: { username, role }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.verifyToken = async (req, res) => {
    res.status(200).json({ status: 'success', user: req.user });
};
