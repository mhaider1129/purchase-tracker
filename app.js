const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./config/db');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

const requestsRoutes = require('./routes/requests');
const requestedItemsRoutes = require('./routes/requestedItems');
const approvalsRoutes = require('./routes/approvals');

// Public route
app.use('/auth', authRoutes);

// Protected routes
app.use('/requests', authMiddleware, requestsRoutes);
app.use('/requested-items', authMiddleware, requestedItemsRoutes);
app.use('/approvals', authMiddleware, approvalsRoutes);

// Test endpoint
app.get('/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

const auditLogRoutes = require('./routes/auditLog');
app.use('/audit-log', authMiddleware, auditLogRoutes);

const attachmentsRoutes = require('./routes/attachments');

app.use('/attachments', authMiddleware, attachmentsRoutes);

const filesRoutes = require('./routes/files');
app.use('/files', filesRoutes);
