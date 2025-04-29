import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

// For Express to get values using POST method (form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// ✅ ADD THIS to parse JSON bodies (e.g., fetch POST requests)
app.use(express.json());

app.set('trust proxy', 1);
app.use(session({
  secret: 'cst336',
  resave: false,
  saveUninitialized: true,
  //cookie: { secure: true }
}));

// Setting up database connection pool
const pool = mysql.createPool({
  host: "cst336whurleyjrsp25.com",
  user: "cstwhurl_webuser",
  password: "cst-336!",
  database: "cstwhurl_bookit",
  connectionLimit: 10,
  waitForConnections: true
});

const conn = await pool.getConnection();

// Login, Signup, and Logout Services
app.get('/', async (req, res) => {
  res.render('login.ejs');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
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

app.get('/profile', isAuthenticated, (req, res) => {
  res.render('profile.ejs', { fullName: req.session.fullName });
});

app.post("/login", async (req, res) => {
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
      res.render('home.ejs', { fullName: req.session.fullName });
      return;
    }
  }
  res.render('login.ejs', { error: "Wrong credentials!" });
});

function isAuthenticated(req, res, next) {
  if (req.session.userAuth) {
    next();
  } else {
    res.redirect("/");
  }
}

// Google Places API
app.get('/api/restaurants', async (req, res) => {
    const lat = req.query.lat;
    const lng = req.query.lng;
    const radius = req.query.radius || 1500;
    const apiKey = "AIzaSyDomEvMi4AHccGjMedgRCeJSFsBEZTaARM";
  
    console.log(`[API CALL] /api/restaurants`);
    console.log(`Query Parameters - lat: ${lat}, lng: ${lng}, radius: ${radius}`);
  
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${apiKey}`;
      console.log(`Fetching data from: ${url}`);
  
      const response = await fetch(url);
      const data = await response.json();
  
      console.log(`Fetched ${data.results ? data.results.length : 0} restaurants.`);
  
      res.json(data);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch restaurants:`, error);
      res.status(500).json({ message: 'Error fetching restaurant data' });
    }
  });
  

// Save Places
app.post('/api/savePlace', async (req, res) => {
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

// WeatherAPI.com - Fetch weather data
app.get('/api/weather', async (req, res) => {
  const lat = req.query.lat;
  const lng = req.query.lng;
  const apiKey = "f28e28db5182453b865203056242803";

  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lng}`;
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
});

// Create Event
app.post('/createEvent', async (req, res) => {
  const { restaurantName, eventName, eventDate, eventTime } = req.body;
  const userId = req.session.userId;

  const sql = `
    INSERT INTO event (restName, eventName, eventDate, eventTime, userId)
    VALUES (?, ?, ?, ?, ?)
  `;

  await conn.query(sql, [restaurantName, eventName, eventDate, eventTime, userId]);
  res.redirect('home');
});

app.listen(3000, () => {
  console.log("Express server running");
});
