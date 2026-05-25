const express = require('express');
const session = require('express-session');
const path = require('path');
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');
const { CLIENT_ID, CLIENT_SECRET, BASE_URL, GUILD_ID, ADMIN_ROLE_ID, SESSION_SECRET } = require('../config');

let clientRef = null;
function setClient(client) { clientRef = client; }
function getClient() { return clientRef; }

let authEnabled = false;

if (CLIENT_SECRET) {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `${BASE_URL}/auth/discord/callback`,
    scope: ['identify', 'guilds', 'guilds.members.read'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const guild = profile.guilds?.find((g) => g.id === GUILD_ID);
      if (!guild) return done(null, false, { message: 'Not in guild' });

      const memberRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${profile.id}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      });
      if (!memberRes.ok) return done(null, false, { message: 'Cannot verify membership' });

      const member = await memberRes.json();
      const isAdmin = member.roles?.includes(ADMIN_ROLE_ID);
      if (!isAdmin) return done(null, false, { message: 'Not admin' });

      return done(null, {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
      });
    } catch (err) {
      return done(err, null);
    }
  }));
  authEnabled = true;
} else {
  console.warn('[WebUI] CLIENT_SECRET not set — Discord OAuth2 disabled');
}

const app = express();

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
}));

if (authEnabled) {
  app.use(passport.initialize());
  app.use(passport.session());
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/static', express.static(path.join(__dirname, 'public')));

function ensureAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/login');
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

if (!authEnabled) {
  // Dev mode — no auth required
  app.use((req, res, next) => {
    req.user = { id: 'dev', username: 'Admin', avatar: '' };
    next();
  });
}

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', { error: req.query.error });
});

if (authEnabled) {
  app.get('/auth/discord', passport.authenticate('discord'));

  app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login?error=unauthorized' }),
    (req, res) => { res.redirect('/'); }
  );

  app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/login'));
  });

  app.get('/auth/me', (req, res) => {
    res.json(req.isAuthenticated() ? req.user : null);
  });
} else {
  app.get('/auth/me', (req, res) => res.json(req.user));
}

// ─── Page routes ──────────────────────────────────────────────────────────────

const { readSheet, getRawValues } = require('../utils/sheets');
const { SHEETS } = require('../config');

function ok(req, res, view, data) {
  data.error = null;
  data.user = req.user;
  res.render(view, data);
}

app.get('/', ensureAuth, async (req, res) => {
  try {
    const [users, subjects, homework, completions, logs] = await Promise.all([
      readSheet(SHEETS.USERS),
      readSheet(SHEETS.SUBJECTS),
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.COMPLETION),
      readSheet(SHEETS.LOGS),
    ]);

    const totalUsers = users.length;
    const totalSubjects = subjects.length;
    const totalHomework = homework.length;
    const totalCompletions = completions.length;
    const recentLogs = logs.slice(-10).reverse();

    ok(req, res, 'dashboard', {
      stats: { totalUsers, totalSubjects, totalHomework, totalCompletions },
      recentLogs,
    });
  } catch (err) {
    res.render('dashboard', { user: req.user, stats: {}, recentLogs: [], error: err.message });
  }
});

app.get('/users', ensureAuth, async (req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    ok(req, res, 'users/index', { users });
  } catch (err) {
    res.render('users/index', { user: req.user, users: [], error: err.message });
  }
});

app.get('/subjects', ensureAuth, async (req, res) => {
  try {
    const subjects = await readSheet(SHEETS.SUBJECTS);
    ok(req, res, 'subjects/index', { subjects });
  } catch (err) {
    res.render('subjects/index', { user: req.user, subjects: [], error: err.message });
  }
});

app.get('/homework', ensureAuth, async (req, res) => {
  try {
    const [homework, subjects] = await Promise.all([
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.SUBJECTS),
    ]);
    ok(req, res, 'homework/index', { homework, subjects });
  } catch (err) {
    res.render('homework/index', { user: req.user, homework: [], subjects: [], error: err.message });
  }
});

app.get('/grading', ensureAuth, async (req, res) => {
  try {
    const [homework, completions, users] = await Promise.all([
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.COMPLETION),
      readSheet(SHEETS.USERS),
    ]);
    ok(req, res, 'homework/grading', { homework, completions, users });
  } catch (err) {
    res.render('homework/grading', { user: req.user, homework: [], completions: [], users: [], error: err.message });
  }
});

app.get('/polls', ensureAuth, async (req, res) => {
  try {
    const polls = await readSheet(SHEETS.POLLS);
    const channels = clientRef ? clientRef.channels.cache
      .filter((c) => c.isTextBased() && c.guildId === GUILD_ID)
      .map((c) => ({ id: c.id, name: c.name })) : [];
    ok(req, res, 'polls/index', { polls, channels });
  } catch (err) {
    res.render('polls/index', { user: req.user, polls: [], channels: [], error: err.message });
  }
});

app.get('/attendance', ensureAuth, async (req, res) => {
  try {
    const completions = await readSheet(SHEETS.COMPLETION);
    ok(req, res, 'attendance/index', { completions });
  } catch (err) {
    res.render('attendance/index', { user: req.user, completions: [], error: err.message });
  }
});

app.get('/config', ensureAuth, async (req, res) => {
  try {
    const settings = await readSheet(SHEETS.SETTINGS);
    ok(req, res, 'config', { settings });
  } catch (err) {
    res.render('config', { user: req.user, settings: [], error: err.message });
  }
});

app.get('/logs', ensureAuth, async (req, res) => {
  try {
    const logs = await readSheet(SHEETS.LOGS);
    ok(req, res, 'logs', { logs: logs.reverse() });
  } catch (err) {
    res.render('logs', { user: req.user, logs: [], error: err.message });
  }
});

// ─── API routes ───────────────────────────────────────────────────────────────

const api = express.Router();
api.use(ensureAuth);

// Users
api.get('/users', async (req, res) => {
  try {
    const users = await readSheet(SHEETS.USERS);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.delete('/users/:studentId', async (req, res) => {
  try {
    const { hashPassword } = require('../utils/auth');
    const { appendRow, getRowIndex, deleteRow } = require('../utils/sheets');
    const users = await readSheet(SHEETS.USERS);
    const idx = users.findIndex((u) => u.studentId === req.params.studentId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    await deleteRow(SHEETS.USERS, idx + 2);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'delete_user', target: req.params.studentId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.post('/users/:studentId/password', async (req, res) => {
  try {
    const { hashPassword } = require('../utils/auth');
    const { readSheet, updateRow } = require('../utils/sheets');
    const users = await readSheet(SHEETS.USERS);
    const idx = users.findIndex((u) => u.studentId === req.params.studentId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const newHash = hashPassword(req.body.password);
    const user = users[idx];
    const updated = [user.discordId, user.firstName, user.lastName, user.studentId, newHash];
    await updateRow(SHEETS.USERS, idx + 2, updated);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'change_password', target: req.params.studentId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Subjects
api.get('/subjects', async (req, res) => {
  try {
    const subjects = await readSheet(SHEETS.SUBJECTS);
    res.json(subjects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.post('/subjects', async (req, res) => {
  try {
    const { subjectCode, subjectName, credits, instructor } = req.body;
    if (!subjectCode || !subjectName || !credits || !instructor) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const { appendRow } = require('../utils/sheets');
    await appendRow(SHEETS.SUBJECTS, [
      subjectCode.toUpperCase(), subjectName, String(credits), instructor,
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'add_subject', target: subjectCode });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.put('/subjects/:code', async (req, res) => {
  try {
    const { subjectName, credits, instructor } = req.body;
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const idx = subjects.findIndex((s) => s.subjectCode === req.params.code);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const s = subjects[idx];
    const { updateRow } = require('../utils/sheets');
    await updateRow(SHEETS.SUBJECTS, idx + 2, [
      s.subjectCode, subjectName || s.subjectName, String(credits || s.credits), instructor || s.instructor,
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'edit_subject', target: req.params.code });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.delete('/subjects/:code', async (req, res) => {
  try {
    const subjects = await readSheet(SHEETS.SUBJECTS);
    const idx = subjects.findIndex((s) => s.subjectCode === req.params.code);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const { deleteRow } = require('../utils/sheets');
    await deleteRow(SHEETS.SUBJECTS, idx + 2);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'delete_subject', target: req.params.code });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Homework
api.get('/homework', async (req, res) => {
  try {
    const homework = await readSheet(SHEETS.HOMEWORK);
    res.json(homework);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.post('/homework', async (req, res) => {
  try {
    const { subjectCode, title, details, imageUrl, link, dueDate } = req.body;
    if (!subjectCode || !title || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { appendRow } = require('../utils/sheets');
    const homeworkId = `HW-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const assignDate = new Date().toISOString().split('T')[0];
    await appendRow(SHEETS.HOMEWORK, [
      homeworkId, subjectCode, title, details || '', imageUrl || '', link || '',
      dueDate, assignDate, req.user.username,
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'add_homework', target: homeworkId });

    if (clientRef) {
      try {
        const { sendNewHomeworkDM } = require('../utils/reminders');
        const hw = { homeworkId, subjectCode, title, details, imageUrl, link, dueDate, assignDate };
        sendNewHomeworkDM(clientRef, hw).catch(() => {});
      } catch {}
    }
    res.json({ success: true, homeworkId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.put('/homework/:id', async (req, res) => {
  try {
    const { title, details, imageUrl, link, dueDate } = req.body;
    const homework = await readSheet(SHEETS.HOMEWORK);
    const idx = homework.findIndex((h) => h.homeworkId === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const h = homework[idx];
    const { updateRow } = require('../utils/sheets');
    await updateRow(SHEETS.HOMEWORK, idx + 2, [
      h.homeworkId, h.subjectCode, title || h.title, details !== undefined ? details : h.details,
      imageUrl !== undefined ? imageUrl : h.imageUrl, link !== undefined ? link : h.link,
      dueDate || h.dueDate, h.assignDate, h.addedBy,
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'edit_homework', target: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.delete('/homework/:id', async (req, res) => {
  try {
    const homework = await readSheet(SHEETS.HOMEWORK);
    const idx = homework.findIndex((h) => h.homeworkId === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const { deleteRow } = require('../utils/sheets');
    await deleteRow(SHEETS.HOMEWORK, idx + 2);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'delete_homework', target: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Completions / Grading
api.get('/completions', async (req, res) => {
  try {
    const completions = await readSheet(SHEETS.COMPLETION);
    res.json(completions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.put('/completions/:id/score', async (req, res) => {
  try {
    const { score } = req.body;
    const completions = await readSheet(SHEETS.COMPLETION);
    const idx = completions.findIndex((c) => c.homeworkId === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const c = completions[idx];
    const { updateRow } = require('../utils/sheets');
    await updateRow(SHEETS.COMPLETION, idx + 2, [
      c.homeworkId, c.studentId, c.completedAt, String(score || ''),
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'grade', target: req.params.id, details: `score: ${score}` });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Polls
api.post('/polls', async (req, res) => {
  try {
    const { question, options, channelId } = req.body;
    if (!question || !options || !options.length || !channelId) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (!clientRef) return res.status(503).json({ error: 'Bot not ready' });

    const { postPoll } = require('../utils/polls');
    const { appendRow } = require('../utils/sheets');
    const pollId = `POLL-${Date.now()}`;

    const messageId = await postPoll(clientRef, channelId, question, options, pollId);
    await appendRow(SHEETS.POLLS, [
      pollId, question, JSON.stringify(options), channelId, messageId,
      req.user.id, new Date().toISOString(), 'true',
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'create_poll', target: pollId });
    res.json({ success: true, pollId, messageId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.post('/polls/:id/close', async (req, res) => {
  try {
    const polls = await readSheet(SHEETS.POLLS);
    const idx = polls.findIndex((p) => p.pollId === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const { updateRow } = require('../utils/sheets');
    await updateRow(SHEETS.POLLS, idx + 2, [
      polls[idx].pollId, polls[idx].question, polls[idx].options,
      polls[idx].channelId, polls[idx].messageId, polls[idx].createdBy,
      polls[idx].createdAt, 'false',
    ]);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'close_poll', target: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings / Config
api.get('/settings', async (req, res) => {
  try {
    const settings = await readSheet(SHEETS.SETTINGS);
    const obj = {};
    for (const s of settings) obj[s.key] = s.value;
    res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.put('/settings/:key', async (req, res) => {
  try {
    const settings = await readSheet(SHEETS.SETTINGS);
    const { value } = req.body;
    const idx = settings.findIndex((s) => s.key === req.params.key);
    const { updateRow, appendRow } = require('../utils/sheets');

    if (idx !== -1) {
      await updateRow(SHEETS.SETTINGS, idx + 2, [req.params.key, String(value)]);
    } else {
      await appendRow(SHEETS.SETTINGS, [req.params.key, String(value)]);
    }
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'update_config', target: req.params.key, details: String(value) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Logs
api.get('/logs', async (req, res) => {
  try {
    const logs = await readSheet(SHEETS.LOGS).catch(() => []);
    res.json(logs.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

api.delete('/logs', async (req, res) => {
  try {
    const { clearSheet } = require('../utils/sheets');
    await clearSheet(SHEETS.LOGS);
    const { log } = require('../utils/audit');
    await log({ adminId: req.user.id, adminName: req.user.username, action: 'clear_logs' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats
api.get('/stats', async (req, res) => {
  try {
    const [users, subjects, homework, completions] = await Promise.all([
      readSheet(SHEETS.USERS),
      readSheet(SHEETS.SUBJECTS),
      readSheet(SHEETS.HOMEWORK),
      readSheet(SHEETS.COMPLETION),
    ]);

    const completedCount = completions.length;
    const now = Date.now();
    const pending = homework.filter((h) => {
      if (!h.dueDate) return true;
      return new Date(h.dueDate.replace(' ', 'T')).getTime() >= now;
    });
    const overdue = homework.filter((h) => {
      if (!h.dueDate) return false;
      return new Date(h.dueDate.replace(' ', 'T')).getTime() < now;
    });

    res.json({
      totalUsers: users.length,
      totalSubjects: subjects.length,
      totalHomework: homework.length,
      pendingHomework: pending.length,
      overdueHomework: overdue.length,
      totalCompletions: completedCount,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', api);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: !!clientRef });
});

module.exports = { app, setClient, getClient };
