const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  var parts = stored.split(':');
  var salt = parts[0];
  var hash = parts[1];
  var test = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === test;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function register(username, password) {
  if (!username || username.length < 1 || username.length > 14) {
    return { success: false, error: "Name muss 1-14 Zeichen lang sein" };
  }
  if (!/^[A-Z0-9]+$/i.test(username)) {
    return { success: false, error: "Nur A-Z und 0-9 erlaubt" };
  }
  if (!password || password.length < 3) {
    return { success: false, error: "Passwort muss mind. 3 Zeichen haben" };
  }

  var users = loadUsers();
  var key = username.toUpperCase();

  if (users[key]) {
    return { success: false, error: "Name bereits vergeben" };
  }

  var token = generateToken();
  users[key] = {
    username: key,
    password: hashPassword(password),
    token: token,
    created: Date.now()
  };
  saveUsers(users);
  return { success: true, token: token, username: key };
}

function login(username, password) {
  var users = loadUsers();
  var key = username.toUpperCase();

  if (!users[key]) {
    return { success: false, error: "Benutzer nicht gefunden" };
  }
  if (!verifyPassword(password, users[key].password)) {
    return { success: false, error: "Falsches Passwort" };
  }

  var token = generateToken();
  users[key].token = token;
  saveUsers(users);
  return { success: true, token: token, username: users[key].username };
}

function validateToken(token) {
  if (!token) return { success: false };
  var users = loadUsers();
  for (var key in users) {
    if (users[key].token === token) {
      return { success: true, username: users[key].username };
    }
  }
  return { success: false };
}

module.exports = { register: register, login: login, validateToken: validateToken };
