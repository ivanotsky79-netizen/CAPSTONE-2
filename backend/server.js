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
    origin: "*", // Adjust this in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

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

app.get('/', (req, res) => {
  res.send('FUGEN SmartPay API is running');
});

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production' || process.env.REPL_ID) {
  const path = require('path');
  console.log('Serving frontend from ../frontend/dist');
  // Serve static files from the React frontend app
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  // Anything that doesn't match the above, send back index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Something went wrong!', error: err.message });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (on all interfaces)`);
});

