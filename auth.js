var mysql = require('mysql2');
var crypto = require('crypto');

var pool = null;
var users = {};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function init(callback) {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'msrogue',
    waitForConnections: true,
    connectionLimit: 5
  });

  pool.query(
    'CREATE TABLE IF NOT EXISTS users (' +
    'username VARCHAR(14) PRIMARY KEY, ' +
    'password VARCHAR(100) NOT NULL, ' +
    'token VARCHAR(64), ' +
    'created BIGINT' +
    ')',
    function(err) {
      if (err) {
        console.error('DB Tabelle konnte nicht erstellt werden:', err.message);
        callback(err);
        return;
      }
      // Alle User in RAM laden
      pool.query('SELECT * FROM users', function(err, rows) {
        if (err) {
          console.error('DB Laden fehlgeschlagen:', err.message);
          callback(err);
          return;
        }
        users = {};
        for (var i = 0; i < rows.length; i++) {
          users[rows[i].username] = {
            username: rows[i].username,
            password: rows[i].password,
            token: rows[i].token,
            created: rows[i].created
          };
        }
        console.log('Auth: ' + Object.keys(users).length + ' Accounts geladen');
        callback(null);
      });
    }
  );
}

function register(username, password) {
  if (!username || username.length < 1 || username.length > 14) {
    return { success: false, error: "Name muss 1-14 Zeichen lang sein" };
  }
  if (!/^[A-Z0-9]+$/i.test(username)) {
    return { success: false, error: "Nur A-Z und 0-9 erlaubt" };
  }
  if (!password || password.length < 3) {
    return { success: false, error: "Passwort mind. 3 Zeichen" };
  }

  var key = username.toUpperCase();
  if (users[key]) {
    return { success: false, error: "Name bereits vergeben" };
  }

  var token = generateToken();
  users[key] = {
    username: key,
    password: password,
    token: token,
    created: Date.now()
  };

  // Async in DB schreiben
  pool.query(
    'INSERT INTO users (username, password, token, created) VALUES (?, ?, ?, ?)',
    [key, password, token, users[key].created],
    function(err) { if (err) console.error('DB Insert Fehler:', err.message); }
  );

  return { success: true, token: token, username: key };
}

function login(username, password) {
  var key = username.toUpperCase();

  if (!users[key]) {
    return { success: false, error: "Benutzer nicht gefunden" };
  }
  if (users[key].password !== password) {
    return { success: false, error: "Falsches Passwort" };
  }

  var token = generateToken();
  users[key].token = token;

  // Async Token updaten
  pool.query(
    'UPDATE users SET token = ? WHERE username = ?',
    [token, key],
    function(err) { if (err) console.error('DB Update Fehler:', err.message); }
  );

  return { success: true, token: token, username: key };
}

function validateToken(token) {
  if (!token) return { success: false };
  for (var key in users) {
    if (users[key].token === token) {
      return { success: true, username: users[key].username };
    }
  }
  return { success: false };
}

module.exports = {
  init: init,
  register: register,
  login: login,
  validateToken: validateToken
};
