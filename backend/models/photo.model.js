const pool = require('../config/db');

async function savePhoto({ userId, filePath, photoDate, workoutId = null, tags = null }) {
  const [result] = await pool.query(
    'INSERT INTO ProgressPhotos (user_id, file_path, photo_date, workout_id, tags) VALUES (?, ?, ?, ?, ?)',
    [userId, filePath, photoDate, workoutId, tags && tags.length ? JSON.stringify(tags) : null]
  );
  return result.insertId;
}

async function getPhotos(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM ProgressPhotos WHERE user_id = ? ORDER BY photo_date DESC',
    [userId]
  );
  return rows;
}

async function getPhotosForWorkout(workoutId, userId) {
  const [rows] = await pool.query(
    'SELECT * FROM ProgressPhotos WHERE workout_id = ? AND user_id = ? ORDER BY created_at ASC',
    [workoutId, userId]
  );
  return rows;
}

async function deletePhoto(id, userId) {
  const [rows] = await pool.query(
    'SELECT file_path FROM ProgressPhotos WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if (!rows[0]) return null;
  await pool.query('DELETE FROM ProgressPhotos WHERE id = ?', [id]);
  return rows[0].file_path;
}

module.exports = { savePhoto, getPhotos, getPhotosForWorkout, deletePhoto };
