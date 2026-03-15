const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const apiRoutes = require('./src/routes/apiRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting to prevent brute-force and DoS
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

// Apply rate limiting to all requests
app.use('/api', limiter);

// Make io accessible to our routes
app.set('io', io);

// Socket connection
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Routes
app.use('/api', apiRoutes);

// --------------------------------------------------------------------------
// DYNAMIC FRONTEND SERVING
// --------------------------------------------------------------------------
const path = require('path');
const fs = require('fs');

// Log current directory so we can debug paths
console.log('Current __dirname:', __dirname);

// List possible locations where frontend/dist could be
const possiblePaths = [
  path.join(__dirname, '../frontend/dist'), // If server.js is in backend/ and repo root is base
  path.join(__dirname, 'dist'),             // If frontend was copied into backend/dist (Render friendly)
  path.join(__dirname, 'frontend/dist'),    // If server.js is at root and frontend is a child
  path.join(__dirname, '../dist')           // Alternative structure
];

let frontendPath = null;

// Find the first path that actually exists
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    frontendPath = p;
    break;
  }
}

if (frontendPath) {
  console.log('✅ Frontend build FOUND at: ' + frontendPath);

  // Serve static files
  app.use(express.static(frontendPath));

  // Handle client-side routing (catch-all)
  // Using regex /.*/ to match all routes without triggering parameter errors
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.error('⚠️ Frontend build NOT found in any known location.');
  possiblePaths.forEach(p => console.log('Checked: ' + p));

  app.get('/', (req, res) => {
    res.send('FUGEN SmartPay API is running (Backend Only Mode)');
  });
}
// --------------------------------------------------------------------------

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || 500;
  const message = err.message || 'Something went wrong!';
  
  res.status(status).json({ 
    status: 'error', 
    message: message,
    ...(process.env.NODE_ENV === 'development' && { error: err.message, stack: err.stack })
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (on all interfaces)`);
});
