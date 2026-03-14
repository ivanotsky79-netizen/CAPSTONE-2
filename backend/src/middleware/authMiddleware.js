const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fugen_secret_key_2026');

            // Add user info to request
            req.user = decoded;

            return next();
        } catch (error) {
            console.error('[AUTH_ERROR] Token verification failed:', error.message);
            return res.status(401).json({ 
                status: 'error', 
                message: 'Your session has expired or the token is invalid. Please log in again.' 
            });
        }
    }

    if (!token) {
        return res.status(401).json({ 
            status: 'error', 
            message: 'Access denied. Professional authorization is required to access this endpoint.' 
        });
    }
};

// Middleware to check for specific roles if needed
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
