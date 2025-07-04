// routes/attachments.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/authMiddleware');

// POST /attachments/:requestId
router.post('/:requestId', authMiddleware, upload.single('file'), async (req, res) => {
  const requestId = req.params.requestId;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    await pool.query(
      `INSERT INTO attachments (request_id, file_name, file_path, uploaded_by)
       VALUES ($1, $2, $3, $4)`,
      [requestId, file.originalname, file.path, req.user.user_id]
    );

    res.status(201).json({ message: 'File uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /attachments/:requestId
router.get('/:requestId', authMiddleware, async (req, res) => {
  const requestId = req.params.requestId;

  try {
    const result = await pool.query(
      `SELECT id, file_name, file_path, uploaded_by, uploaded_at
       FROM attachments
       WHERE request_id = $1`,
      [requestId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching attachments:', err.message);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// GET /attachments/download/:filename
const path = require('path');

router.get('/download/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, '..', 'uploads', fileName);
  res.download(filePath, fileName, err => {
    if (err) {
      console.error('Download error:', err.message);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// DELETE /attachments/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const fileId = req.params.id;
  const userId = req.user.user_id;

  try {
    // Get file info
    const fileRes = await pool.query(`SELECT * FROM attachments WHERE id = $1`, [fileId]);
    if (fileRes.rows.length === 0) return res.status(404).json({ error: 'File not found' });

    const file = fileRes.rows[0];

    // Only allow uploader or admin to delete
    if (file.uploaded_by !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }

    // Delete from DB
    await pool.query(`DELETE FROM attachments WHERE id = $1`, [fileId]);

    // Delete from disk
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '..', file.file_path);

    fs.unlink(filePath, err => {
      if (err) console.warn('File missing from disk, only DB entry deleted');
    });

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Delete file error:', err.message);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
