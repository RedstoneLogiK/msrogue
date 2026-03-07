var mysql = require('mysql2');
var crypto = require('crypto');

var pool = null;
var users = {};

var DEFAULT_STATS = {
  score: 0,
  speed_level: 1,
  value_multiplier: 1,
  rogue_speed: 2.5,
  cost_speed: 10,
  cost_value: 15,
  lives: 3,
  godmode: 0,
  godmode_timer: 0,
  totems: 0
};

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

  var createSQL = 'CREATE TABLE IF NOT EXISTS users (' +
    'username VARCHAR(14) PRIMARY KEY, ' +
    'password VARCHAR(100) NOT NULL, ' +
    'token VARCHAR(64), ' +
    'created BIGINT, ' +
    'score INT DEFAULT 0, ' +
    'speed_level INT DEFAULT 1, ' +
    'value_multiplier INT DEFAULT 1, ' +
    'rogue_speed FLOAT DEFAULT 2.5, ' +
    'cost_speed INT DEFAULT 10, ' +
    'cost_value INT DEFAULT 15, ' +
    'lives INT DEFAULT 3, ' +
    'godmode INT DEFAULT 0, ' +
    'godmode_timer INT DEFAULT 0, ' +
    'totems INT DEFAULT 0, ' +
    'pos_x FLOAT DEFAULT 0, ' +
    'pos_y FLOAT DEFAULT 0, ' +
    'volume INT DEFAULT 100, ' +
    'skin INT DEFAULT 1, ' +
    'is_admin INT DEFAULT 0' +
    ')';

  pool.query(createSQL, function(err) {
    if (err) {
      console.error('DB Tabelle konnte nicht erstellt werden:', err.message);
      callback(err);
      return;
    }
    // Spalten nachtraeglich hinzufuegen falls Tabelle schon existiert
    var cols = ['score INT DEFAULT 0', 'speed_level INT DEFAULT 1',
      'value_multiplier INT DEFAULT 1', 'rogue_speed FLOAT DEFAULT 2.5',
      'cost_speed INT DEFAULT 10', 'cost_value INT DEFAULT 15',
      'lives INT DEFAULT 3', 'godmode INT DEFAULT 0',
      'godmode_timer INT DEFAULT 0', 'totems INT DEFAULT 0',
      'pos_x FLOAT DEFAULT 0', 'pos_y FLOAT DEFAULT 0',
      'volume INT DEFAULT 100', 'skin INT DEFAULT 1', 'is_admin INT DEFAULT 0'];
    var done = 0;
    for (var c = 0; c < cols.length; c++) {
      var colName = cols[c].split(' ')[0];
      pool.query('ALTER TABLE users ADD COLUMN ' + cols[c], function(e) {
        done++;
        if (done === cols.length) loadAllUsers(callback);
      });
    }
  });
}

function loadAllUsers(callback) {
  pool.query('SELECT * FROM users', function(err, rows) {
    if (err) {
      console.error('DB Laden fehlgeschlagen:', err.message);
      callback(err);
      return;
    }
    users = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      users[r.username] = {
        username: r.username,
        password: r.password,
        token: r.token,
        created: r.created,
        score: r.score || 0,
        speed_level: r.speed_level || 1,
        value_multiplier: r.value_multiplier || 1,
        rogue_speed: r.rogue_speed || 2.5,
        cost_speed: r.cost_speed || 10,
        cost_value: r.cost_value || 15,
        lives: r.lives || 3,
        godmode: r.godmode || 0,
        godmode_timer: r.godmode_timer || 0,
        totems: r.totems || 0,
        pos_x: r.pos_x || 0,
        pos_y: r.pos_y || 0,
        volume: (r.volume != null) ? r.volume : 100,
        skin: r.skin || 1,
        is_admin: r.is_admin || 0
      };
    }
    console.log('Auth: ' + Object.keys(users).length + ' Accounts geladen');
    callback(null);
  });
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
    created: Date.now(),
    score: 0, speed_level: 1, value_multiplier: 1, rogue_speed: 2.5,
    cost_speed: 10, cost_value: 15, lives: 3,
    godmode: 0, godmode_timer: 0, totems: 0,
    pos_x: 0, pos_y: 0, volume: 100, skin: 1, is_admin: 0
  };

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

  pool.query('UPDATE users SET token = ? WHERE username = ?', [token, key],
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

function getPlayerData(username) {
  var key = username.toUpperCase();
  if (!users[key]) return null;
  var u = users[key];
  return {
    score: u.score || 0,
    speed_level: u.speed_level || 1,
    value_multiplier: u.value_multiplier || 1,
    rogue_speed: u.rogue_speed || 2.5,
    cost_speed: u.cost_speed || 10,
    cost_value: u.cost_value || 15,
    lives: u.lives || 3,
    godmode: u.godmode || 0,
    godmode_timer: u.godmode_timer || 0,
    totems: u.totems || 0,
    pos_x: u.pos_x || 0,
    pos_y: u.pos_y || 0,
    volume: (u.volume != null) ? u.volume : 100,
    skin: u.skin || 1,
    is_admin: u.is_admin || 0
  };
}

function savePlayerData(username, data) {
  var key = username.toUpperCase();
  if (!users[key]) return;

  users[key].score = data.score;
  users[key].speed_level = data.speed_level;
  users[key].value_multiplier = data.value_multiplier;
  users[key].rogue_speed = data.rogue_speed;
  users[key].cost_speed = data.cost_speed;
  users[key].cost_value = data.cost_value;
  users[key].lives = data.lives;
  users[key].godmode = data.godmode;
  users[key].godmode_timer = data.godmode_timer;
  users[key].totems = data.totems;
  users[key].pos_x = data.pos_x || 0;
  users[key].pos_y = data.pos_y || 0;
  if (data.volume != null) users[key].volume = data.volume;
  if (data.skin != null) users[key].skin = data.skin;

  pool.query(
    'UPDATE users SET score=?, speed_level=?, value_multiplier=?, rogue_speed=?, ' +
    'cost_speed=?, cost_value=?, lives=?, godmode=?, godmode_timer=?, totems=?, ' +
    'pos_x=?, pos_y=?, volume=?, skin=? WHERE username=?',
    [data.score, data.speed_level, data.value_multiplier, data.rogue_speed,
     data.cost_speed, data.cost_value, data.lives, data.godmode,
     data.godmode_timer, data.totems, data.pos_x || 0, data.pos_y || 0,
     (data.volume != null) ? data.volume : 100, data.skin || 1, key],
    function(err) { if (err) console.error('DB Save Fehler:', err.message); }
  );
}

function resetPlayerData(username) {
  var key = username.toUpperCase();
  if (!users[key]) return;
  var d = DEFAULT_STATS;
  savePlayerData(key, d);
}

module.exports = {
  init: init,
  register: register,
  login: login,
  validateToken: validateToken,
  getPlayerData: getPlayerData,
  savePlayerData: savePlayerData,
  resetPlayerData: resetPlayerData
};
