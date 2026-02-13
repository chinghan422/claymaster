import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In production, serve the built frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ─── Helper: build full state (matches AppState shape) ───

function getFullState() {
  const participants = db.prepare('SELECT * FROM participants').all();
  const admins = db.prepare('SELECT * FROM admins').all();
  const questionPool = db.prepare('SELECT * FROM question_pool').all();

  const roundRows = db.prepare('SELECT * FROM rounds ORDER BY roundNumber').all();
  const rounds = roundRows.map(r => {
    const pids = db.prepare('SELECT participantId FROM round_participants WHERE roundId = ?').all(r.id);
    return {
      id: r.id,
      roundNumber: r.roundNumber,
      topicImage: r.topicImage,
      isTopicRevealed: !!r.isTopicRevealed,
      status: r.status,
      participantIds: pids.map(p => p.participantId)
    };
  });

  const subRows = db.prepare('SELECT * FROM submissions').all();
  const submissions = subRows.map(s => {
    const scoreRows = db.prepare('SELECT voterNickname, score FROM scores WHERE submissionId = ?').all(s.id);
    const scores = {};
    scoreRows.forEach(sc => { scores[sc.voterNickname] = sc.score; });
    return { ...s, scores };
  });

  return { participants, admins, questionPool, rounds, submissions };
}

// ─── GET /api/state — single endpoint to fetch everything ───

app.get('/api/state', (req, res) => {
  res.json(getFullState());
});

// ─── Auth ───

app.post('/api/auth/admin-login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?').get(username, password);
  if (admin) {
    res.json({ success: true, username: admin.username });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/auth/participant-login', (req, res) => {
  const { id } = req.body;
  const participant = db.prepare('SELECT * FROM participants WHERE LOWER(id) = LOWER(?)').get(id);
  if (participant) {
    res.json({ success: true, participant });
  } else {
    res.status(404).json({ success: false, message: 'Participant not found' });
  }
});

// ─── Participants CRUD ───

app.get('/api/participants', (req, res) => {
  res.json(db.prepare('SELECT * FROM participants').all());
});

app.post('/api/participants', (req, res) => {
  const { id, name } = req.body;
  const existing = db.prepare('SELECT id FROM participants WHERE id = ?').get(id);
  if (existing) return res.status(409).json({ error: 'ID already exists' });
  const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${id}`;
  db.prepare('INSERT INTO participants (id, name, avatar) VALUES (?, ?, ?)').run(id, name, avatar);
  res.json({ id, name, avatar });
});

app.patch('/api/participants/:id', (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE participants SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ success: true });
});

app.delete('/api/participants/:id', (req, res) => {
  const deleteTransaction = db.transaction(() => {
    db.prepare('DELETE FROM participants WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM question_pool WHERE contributorId = ?').run(req.params.id);
  });
  deleteTransaction();
  res.json({ success: true });
});

// ─── Admins CRUD ───

app.get('/api/admins', (req, res) => {
  res.json(db.prepare('SELECT * FROM admins').all());
});

app.post('/api/admins', (req, res) => {
  const { username, password } = req.body;
  const existing = db.prepare('SELECT username FROM admins WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Admin already exists' });
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(username, password);
  res.json({ username, password });
});

app.patch('/api/admins/:username', (req, res) => {
  const { password } = req.body;
  db.prepare('UPDATE admins SET password = ? WHERE username = ?').run(password, req.params.username);
  res.json({ success: true });
});

app.delete('/api/admins/:username', (req, res) => {
  if (req.params.username === 'admin') {
    return res.status(403).json({ error: 'Cannot delete default admin' });
  }
  db.prepare('DELETE FROM admins WHERE username = ?').run(req.params.username);
  res.json({ success: true });
});

// ─── Question Pool ───

app.get('/api/question-pool', (req, res) => {
  res.json(db.prepare('SELECT * FROM question_pool').all());
});

app.post('/api/question-pool', (req, res) => {
  const { imageUrl, contributorId } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  db.prepare('INSERT INTO question_pool (id, imageUrl, contributorId) VALUES (?, ?, ?)').run(id, imageUrl, contributorId);
  res.json({ id, imageUrl, contributorId });
});

app.delete('/api/question-pool/:id', (req, res) => {
  db.prepare('DELETE FROM question_pool WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Rounds ───

app.get('/api/rounds', (req, res) => {
  const roundRows = db.prepare('SELECT * FROM rounds ORDER BY roundNumber').all();
  const rounds = roundRows.map(r => {
    const pids = db.prepare('SELECT participantId FROM round_participants WHERE roundId = ?').all(r.id);
    return {
      ...r,
      isTopicRevealed: !!r.isTopicRevealed,
      participantIds: pids.map(p => p.participantId)
    };
  });
  res.json(rounds);
});

app.post('/api/rounds', (req, res) => {
  const { roundNumber, participantIds } = req.body;

  // Pick a random unused topic from the pool
  const usedImages = db.prepare('SELECT topicImage FROM rounds').all().map(r => r.topicImage);
  const allPool = db.prepare('SELECT * FROM question_pool').all();
  const available = allPool.filter(item => !usedImages.includes(item.imageUrl));

  if (available.length === 0) {
    return res.status(400).json({ error: 'No unused topics available' });
  }

  const topicImage = available[Math.floor(Math.random() * available.length)].imageUrl;
  const id = Math.random().toString(36).substr(2, 9);

  const createRound = db.transaction(() => {
    db.prepare('INSERT INTO rounds (id, roundNumber, topicImage, isTopicRevealed, status) VALUES (?, ?, ?, 0, ?)').run(id, roundNumber, topicImage, 'UPCOMING');
    const insertRP = db.prepare('INSERT INTO round_participants (roundId, participantId) VALUES (?, ?)');
    for (const pid of participantIds) {
      insertRP.run(id, pid);
    }
  });
  createRound();

  res.json({ id, roundNumber, topicImage, isTopicRevealed: false, status: 'UPCOMING', participantIds });
});

app.post('/api/rounds/:id/reveal', (req, res) => {
  const roundId = req.params.id;

  const revealTransaction = db.transaction(() => {
    db.prepare("UPDATE rounds SET isTopicRevealed = 1, status = 'ACTIVE' WHERE id = ?").run(roundId);

    const pids = db.prepare('SELECT participantId FROM round_participants WHERE roundId = ?').all(roundId);
    const insertSub = db.prepare('INSERT OR IGNORE INTO submissions (id, participantId, roundId, imageUrl, timestamp) VALUES (?, ?, ?, ?, ?)');

    for (const { participantId } of pids) {
      const subId = `sub-${roundId}-${participantId}`;
      insertSub.run(subId, participantId, roundId, '', Date.now());
    }
  });
  revealTransaction();

  res.json({ success: true });
});

app.post('/api/rounds/:id/complete', (req, res) => {
  db.prepare("UPDATE rounds SET status = 'COMPLETED' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ─── Submissions ───

app.get('/api/submissions', (req, res) => {
  const subRows = db.prepare('SELECT * FROM submissions').all();
  const submissions = subRows.map(s => {
    const scoreRows = db.prepare('SELECT voterNickname, score FROM scores WHERE submissionId = ?').all(s.id);
    const scores = {};
    scoreRows.forEach(sc => { scores[sc.voterNickname] = sc.score; });
    return { ...s, scores };
  });
  res.json(submissions);
});

app.patch('/api/submissions/:roundId/:participantId', (req, res) => {
  const { imageUrl } = req.body;
  const { roundId, participantId } = req.params;
  db.prepare('UPDATE submissions SET imageUrl = ?, timestamp = ? WHERE roundId = ? AND participantId = ?')
    .run(imageUrl, Date.now(), roundId, participantId);
  res.json({ success: true });
});

app.post('/api/submissions/:id/rate', (req, res) => {
  const { voterNickname, score } = req.body;
  db.prepare('INSERT OR REPLACE INTO scores (submissionId, voterNickname, score) VALUES (?, ?, ?)')
    .run(req.params.id, voterNickname, score);
  res.json({ success: true });
});

// ─── Fallback: serve frontend for all non-API routes ───

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ───

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ClayMaster API server running on http://0.0.0.0:${PORT}`);
});
