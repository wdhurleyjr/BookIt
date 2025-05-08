import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import session from 'express-session';

// test
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
  secret: 'cst336',
  resave: false,
  saveUninitialized: true,
}));

const pool = mysql.createPool({
  host: "cst336whurleyjrsp25.com",
  user: "cstwhurl_webuser",
  password: "cst-336!",
  database: "cstwhurl_bookit",
  connectionLimit: 10,
  waitForConnections: true
});

const conn = await pool.getConnection();

function isAuthenticated(req, res, next) {
  if (req.session.userAuth) {
    next();
  } else {
    res.redirect("/");
  }
}

// Routes
app.get('/', async (req, res) => {
  res.render('login.ejs');
});

app.get('/signup', (req, res) => {
  res.render('signup.ejs');
});

app.post('/signup', async (req, res) => {
  const { firstName, lastName, username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `
    INSERT INTO users (firstName, lastName, username, password)
    VALUES (?, ?, ?, ?)
  `;
  await conn.query(sql, [firstName, lastName, username, hashedPassword]);
  res.redirect('/');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const sql = `SELECT * FROM users WHERE username = ?`;
  const [rows] = await conn.query(sql, [username]);

  if (rows.length > 0) {
    const hashedPassword = rows[0].password;
    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
      req.session.userAuth = true;
      req.session.userId = rows[0].userId;
      req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
      res.redirect('/home');
      return;
    }
  }
  res.render('login.ejs', { error: "Wrong credentials!" });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('login.ejs');
});

// Protected Routes
app.get('/home', isAuthenticated, (req, res) => {
  res.render('home.ejs', { fullName: req.session.fullName });
});

app.get('/editEvent', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const sql = `SELECT * FROM event WHERE userId = ? ORDER BY eventDate ASC`;
  const [events] = await conn.query(sql, [userId]);
  res.render('editEvent.ejs', { events });
});

app.post('/createEvent', isAuthenticated, async (req, res) => {
  const { restaurantName, eventName, eventDate, eventTime } = req.body;
  const userId = req.session.userId;

  const sql = `
    INSERT INTO event (restName, eventName, eventDate, eventTime, userId)
    VALUES (?, ?, ?, ?, ?)
  `;
  await conn.query(sql, [restaurantName, eventName, eventDate, eventTime, userId]);
  res.redirect('/editEvent');
});

app.post('/updateEvent', isAuthenticated, async (req, res) => {
  const { eventId, restaurantName, eventName, eventDate, eventTime } = req.body;
  const userId = req.session.userId;

  const sql = `
    UPDATE event
    SET restName = ?, eventName = ?, eventDate = ?, eventTime = ?
    WHERE eventId = ? AND userId = ?
  `;

  await conn.query(sql, [restaurantName, eventName, eventDate, eventTime, eventId, userId]);
  res.redirect('/editEvent');
});

app.delete('/deleteEvent/:eventId', isAuthenticated, async (req, res) => {
  const { eventId } = req.params;
  const sql = `DELETE FROM event WHERE eventId = ?`;

  await conn.query(sql, [eventId]);
  res.json({ message: 'Event deleted successfully' });
});

// API Routes
app.get('/api/restaurants', isAuthenticated, async (req, res) => {
  const { lat, lng, radius = 1500 } = req.query;
  const apiKey = "AIzaSyDomEvMi4AHccGjMedgRCeJSFsBEZTaARM";

  console.log(`[API CALL] /api/restaurants lat=${lat}, lng=${lng}`);
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`[ERROR] /api/restaurants`, error);
    res.status(500).json({ message: "Error fetching restaurant data" });
  }
});

app.post('/api/savePlace', isAuthenticated, async (req, res) => {
  const { name, googlePlaceId, lat, lng, address, photo } = req.body;

  const checkSql = `SELECT * FROM place WHERE googlePlaceId = ?`;
  const [existing] = await conn.query(checkSql, [googlePlaceId]);

  if (existing.length > 0) {
    return res.json({ message: 'Place already exists' });
  }

  const insertSql = `
    INSERT INTO place (name, googlePlaceId, lat, lng, address, photo)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  await conn.query(insertSql, [name, googlePlaceId, lat, lng, address, photo]);
  res.json({ message: 'Place saved successfully' });
});

// Weather API
app.get('/api/weather', isAuthenticated, async (req, res) => {
  const { lat, lng } = req.query;
  const apiKey = "f28e28db5182453b865203056242803";

  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lng}&aqi=no`;
    const response = await fetch(url);
    const data = await response.json();

    // Map weather conditions to emojis
    const condition = data.current.condition.text.toLowerCase();
    let weatherEmoji = '';

    if (condition.includes('sunny') || condition.includes('clear')) {
      weatherEmoji = '☀️';
    } else if (condition.includes('cloudy')) {
      weatherEmoji = '☁️';
    } else if (condition.includes('rain') || condition.includes('drizzle')) {
      weatherEmoji = '🌧️';
    } else if (condition.includes('snow')) {
      weatherEmoji = '❄️';
    } else if (condition.includes('thunder') || condition.includes('storm')) {
      weatherEmoji = '⛈️';
    } else if (condition.includes('fog') || condition.includes('mist')) {
      weatherEmoji = '🌫️';
    } else {
      weatherEmoji = '🌤️'; // Default emoji for other conditions
    }

    // Add the emoji to the response
    data.current.weatherEmoji = weatherEmoji;

    res.json(data);
  } catch (error) {
    console.error(`[ERROR] /api/weather`, error);
    res.status(500).json({ message: "Error fetching weather data" });
  }
});
// Add these endpoints before app.listen()
app.post('/api/savePin', isAuthenticated, async (req, res) => {
  const { lat, lng, title, description } = req.body;
  const userId = req.session.userId;

  try {
    await conn.query(
      'INSERT INTO pin (userId, lat, lng, title, description) VALUES (?, ?, ?, ?, ?)',
      [userId, lat, lng, title, description]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving pin:', error);
    res.status(500).json({ success: false });
  }
});

app.get('/api/getPins', isAuthenticated, async (req, res) => {
  try {
    const [pins] = await conn.query('SELECT * FROM pin WHERE userId = ?', [req.session.userId]);
    res.json(pins);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ error: 'Failed to fetch pins' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});