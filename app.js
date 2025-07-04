const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./config/db');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Middleware
const authMiddleware = require('./middleware/authMiddleware');

// Public Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Protected Routes
const requestsRoutes = require('./routes/requests');
const requestedItemsRoutes = require('./routes/requestedItems');
const approvalsRoutes = require('./routes/approvals');
const auditLogRoutes = require('./routes/auditLog');
const attachmentsRoutes = require('./routes/attachments');
const filesRoutes = require('./routes/files');

app.use('/api/requests', authMiddleware, requestsRoutes);
app.use('/api/requested-items', authMiddleware, requestedItemsRoutes);
app.use('/api/approvals', authMiddleware, approvalsRoutes);
app.use('/api/audit-log', authMiddleware, auditLogRoutes);
app.use('/api/attachments', authMiddleware, attachmentsRoutes);

// File routes can stay public or be protected if needed
app.use('/api/files', filesRoutes);

// Test route (optional, used for sanity check)
app.get('/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
