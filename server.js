require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const Customer = require('./models/Customer');
const FollowUp = require('./models/FollowUp');
const Note = require('./models/Note');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === 'production';

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB connection string.');
  process.exit(1);
}
if (!process.env.SESSION_SECRET || !process.env.APP_USERNAME || !process.env.APP_PASSWORD) {
  console.error('Missing SESSION_SECRET, APP_USERNAME or APP_PASSWORD in your environment.');
  process.exit(1);
}

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: 'bankfollowup.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI, collectionName: 'sessions', ttl: 8 * 60 * 60 }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

const publicDir = path.join(__dirname, 'public');
app.use('/assets', express.static(publicDir, { index: false, maxAge: isProduction ? '1d' : 0 }));

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Please log in again.' });
  return res.redirect('/login');
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getISTDayBounds(dateText) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateText || '')) ? dateText : todayInIndia();
  const start = new Date(`${date}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid date.');
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date or time.');
  return parsed;
}

function parseNoteDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error('Select a valid note date.');
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Select a valid note date.');
  return parsed;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function handleError(res, error) {
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.message === 'Invalid date.' || error.message === 'Invalid date or time.' || error.message === 'Select a valid note date.') {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again after 15 minutes.' }
});

app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/');
  return res.sendFile(path.join(publicDir, 'login.html'));
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!safeEqual(username, process.env.APP_USERNAME) || !safeEqual(password, process.env.APP_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: 'Unable to start your session.' });
    req.session.authenticated = true;
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ error: 'Unable to save your session.' });
      return res.json({ ok: true });
    });
  });
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('bankfollowup.sid', { httpOnly: true, sameSite: 'strict', secure: isProduction });
    res.json({ ok: true });
  });
});

app.get('/', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/api/session', requireAuth, (req, res) => res.json({ loggedIn: true }));

// Dashboard: every selected date is interpreted in India Standard Time.
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const { start, end } = getISTDayBounds(req.query.date);
    const scheduledQuery = { status: 'Pending', nextFollowUpAt: { $gte: start, $lt: end } };
    const activityQuery = { followedAt: { $gte: start, $lt: end } };
    const [scheduled, activities, recoveredCount, pendingCount, overdueCount] = await Promise.all([
      Customer.find(scheduledQuery).sort({ nextFollowUpAt: 1, name: 1 }).lean(),
      FollowUp.find(activityQuery).populate('customerId', 'name mobile groupName').sort({ followedAt: -1 }).lean(),
      FollowUp.countDocuments({ ...activityQuery, outcome: 'Recovered' }),
      Customer.countDocuments({ status: 'Pending' }),
      Customer.countDocuments({ status: 'Pending', nextFollowUpAt: { $lt: start } })
    ]);
    res.json({
      date: req.query.date || todayInIndia(),
      stats: {
        scheduled: scheduled.length,
        followed: activities.length,
        recovered: recoveredCount,
        pending: pendingCount,
        overdue: overdueCount
      },
      scheduled,
      activities
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/groups', requireAuth, async (req, res) => {
  try {
    const groups = await Customer.distinct('groupName');
    res.json(['List 1', 'List 2', ...groups].filter((value, index, values) => value && values.indexOf(value) === index).sort());
  } catch (error) {
    handleError(res, error);
  }
});

// Customer CRUD.
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const filter = {};
    const { search, groupName, category, status, dueDate } = req.query;
    if (search) {
      const expression = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: expression }, { mobile: expression }, { location: expression }, { lastRemark: expression }];
    }
    if (groupName) filter.groupName = groupName;
    if (category) filter.repaymentCategory = category;
    if (status) filter.status = status;
    if (dueDate) {
      const { start, end } = getISTDayBounds(dueDate);
      filter.nextFollowUpAt = { $gte: start, $lt: end };
    }
    const customers = await Customer.find(filter).sort({ updatedAt: -1 }).limit(1500).lean();
    res.json(customers);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.create({
      name: req.body.name,
      mobile: req.body.mobile,
      location: req.body.location || '',
      repaymentCategory: req.body.repaymentCategory || 'Standard Regular',
      groupName: req.body.groupName || 'List 1',
      status: req.body.status || 'Pending'
    });
    res.status(201).json(customer);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const updates = {
      name: req.body.name,
      mobile: req.body.mobile,
      location: req.body.location || '',
      repaymentCategory: req.body.repaymentCategory,
      groupName: req.body.groupName,
      status: req.body.status
    };
    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    res.json(customer);
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    await FollowUp.deleteMany({ customerId: customer._id });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

// Add a dated follow-up, update the customer's latest remark and current status.
app.post('/api/customers/:id/followups', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const outcome = req.body.outcome;
    if (!['Pending', 'Recovered'].includes(outcome)) return res.status(400).json({ error: 'Choose Pending or Recovered.' });
    const remark = String(req.body.remark || '').trim();
    const requestedNextDate = req.body.nextFollowUpAt ? parseDate(req.body.nextFollowUpAt) : null;
    const followedAt = new Date();

    customer.status = outcome;
    customer.lastRemark = remark;
    customer.lastContactedAt = followedAt;
    if (outcome === 'Recovered') {
      customer.nextFollowUpAt = null;
    } else if (requestedNextDate) {
      customer.nextFollowUpAt = requestedNextDate;
    }
    await customer.save();

    const followUp = await FollowUp.create({
      customerId: customer._id,
      outcome,
      remark,
      followedAt,
      nextFollowUpAt: customer.nextFollowUpAt
    });
    res.status(201).json({ customer, followUp });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/customers/:id/followups', requireAuth, async (req, res) => {
  try {
    const history = await FollowUp.find({ customerId: req.params.id }).sort({ followedAt: -1 }).lean();
    res.json(history);
  } catch (error) {
    handleError(res, error);
  }
});

// Dated short notes CRUD.
app.get('/api/notes', requireAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) {
      const { start, end } = getISTDayBounds(req.query.date);
      filter.noteDate = { $gte: start, $lt: end };
    }
    if (req.query.search) {
      const expression = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      filter.$or = [{ title: expression }, { content: expression }];
    }
    const notes = await Note.find(filter).sort({ noteDate: -1, updatedAt: -1 }).limit(500).lean();
    res.json(notes);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/notes', requireAuth, async (req, res) => {
  try {
    const note = await Note.create({
      title: req.body.title,
      content: req.body.content,
      noteDate: parseNoteDate(req.body.noteDate)
    });
    res.status(201).json(note);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/notes/:id', requireAuth, async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { title: req.body.title, content: req.body.content, noteDate: parseNoteDate(req.body.noteDate) },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    res.json(note);
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  return res.redirect('/');
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Bank Follow-up Manager running on port  http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
