import express from "express";
import serverless from "serverless-http";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";

// Use /tmp for serverless environment
const dbPath = process.env.NETLIFY ? "/tmp/reviews.db" : "reviews.db";
const db = new Database(dbPath);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-123";

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT NOT NULL,
    user_id INTEGER,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT NOT NULL,
    vote_type INTEGER NOT NULL, -- 1 for up, -1 for down
    user_fingerprint TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    place_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, place_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const app = express();
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth Routes
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const info = db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(username, email, hashedPassword);
    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET);
    res.json({ token, user: { id: info.lastInsertRowid, username, email } });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

app.get("/api/auth/me", authenticateToken, (req: any, res) => {
  const user = db.prepare("SELECT id, username, email FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(user);
});

// API Routes
app.get("/api/reviews/:placeId", (req, res) => {
  const { placeId } = req.params;
  const reviews = db.prepare(`
    SELECT r.*, u.username as verified_username 
    FROM reviews r 
    LEFT JOIN users u ON r.user_id = u.id 
    WHERE r.place_id = ? 
    ORDER BY r.created_at DESC
  `).all(placeId);
  res.json(reviews);
});

app.post("/api/reviews", authenticateToken, (req: any, res) => {
  const { place_id, rating, comment } = req.body;
  const user_id = req.user.id;
  const user_name = req.user.username; // Fallback or use from token

  if (!place_id || !rating) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const info = db.prepare("INSERT INTO reviews (place_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)").run(place_id, user_id, user_name, rating, comment);
  
  // Notify subscribers
  const subscribers = db.prepare("SELECT user_id FROM subscriptions WHERE place_id = ? AND user_id != ?").all(place_id, user_id) as any[];
  const insertNotification = db.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)");
  
  subscribers.forEach(sub => {
    insertNotification.run(sub.user_id, `New review for ${place_id}: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`);
  });

  res.json({ id: info.lastInsertRowid, user_name });
});

// Notifications & Subscriptions
app.post("/api/subscribe", authenticateToken, (req: any, res) => {
  const { place_id } = req.body;
  try {
    db.prepare("INSERT INTO subscriptions (user_id, place_id) VALUES (?, ?)").run(req.user.id, place_id);
    // Create a welcome notification
    db.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)").run(req.user.id, `You are now subscribed to updates for ${place_id}`);
    res.json({ success: true });
  } catch (error) {
    // Ignore unique constraint errors (already subscribed)
    res.json({ success: true });
  }
});

app.get("/api/notifications", authenticateToken, (req: any, res) => {
  const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json(notifications);
});

app.post("/api/notifications/read", authenticateToken, (req: any, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user.id);
  res.json({ success: true });
});

app.get("/api/votes/:placeId", (req, res) => {
  const { placeId } = req.params;
  const upvotes = db.prepare("SELECT COUNT(*) as count FROM votes WHERE place_id = ? AND vote_type = 1").get(placeId) as { count: number };
  const downvotes = db.prepare("SELECT COUNT(*) as count FROM votes WHERE place_id = ? AND vote_type = -1").get(placeId) as { count: number };
  res.json({ up: upvotes.count, down: downvotes.count });
});

app.post("/api/votes", (req, res) => {
  const { place_id, vote_type, user_fingerprint } = req.body;
  if (!place_id || !vote_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  // Simple check to prevent multiple votes from same fingerprint (basic)
  const existing = db.prepare("SELECT id FROM votes WHERE place_id = ? AND user_fingerprint = ?").get(place_id, user_fingerprint);
  if (existing) {
    db.prepare("UPDATE votes SET vote_type = ? WHERE id = ?").run(vote_type, (existing as any).id);
  } else {
    db.prepare("INSERT INTO votes (place_id, vote_type, user_fingerprint) VALUES (?, ?, ?)").run(place_id, vote_type, user_fingerprint);
  }
  res.json({ success: true });
});

export const handler = serverless(app);
