// controllers/filesController.js

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const deleteFile = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch file record from DB
    const result = await pool.query(`SELECT * FROM files WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '..', 'uploads', file.filename);

    // 2. Delete from filesystem
    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        return res.status(500).json({ error: 'Failed to delete file from server' });
      }

      // 3. Delete from DB
      await pool.query(`DELETE FROM files WHERE id = $1`, [id]);

      res.json({ message: 'File deleted successfully' });
    });

  } catch (err) {
    console.error('Error deleting file:', err.message);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

module.exports = { deleteFile };
