/**
 * MAC CAR — Google Sheets backend (Google Apps Script)
 *
 * All app data lives in the Google Sheet this script is attached to,
 * inside the Admin's own Google Drive. The web/mobile app talks to this
 * script as a JSON API.
 *
 * Setup (see README):
 *   1. Create a Google Sheet → Extensions → Apps Script → paste this file
 *      (and appsscript.json).
 *   2. Run `setup` once from the editor and approve permissions.
 *   3. Deploy → New deployment → Web app → Execute as: Me,
 *      Who has access: Anyone → copy the /exec URL into the app.
 */

// ---------------------------------------------------------------- config

var TOKEN_DAYS = 30;

/** Sheet layout. `num` columns are stored as numbers, everything else as text. */
var TABLES = {
  users: {
    sheet: 'Users',
    cols: ['id', 'username', 'email', 'full_name', 'phone', 'role', 'active', 'nationality', 'iqama_no',
      'iqama_expiry', 'license_no', 'license_expiry', 'notes', 'created_at', 'set_password', 'password_hash', 'salt', 'monthly_salary', 'permissions'],
    num: ['monthly_salary'],
    bool: ['active'],
  },
  cars: {
    sheet: 'Cars',
    cols: ['id', 'plate_no', 'make', 'model', 'year', 'color', 'vin', 'status', 'purchase_date',
      'purchase_price', 'current_odometer', 'notes', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['year', 'purchase_price', 'current_odometer'],
    bool: ['archived'],
  },
  car_documents: {
    sheet: 'Documents',
    cols: ['id', 'car_id', 'car_plate', 'driver_id', 'driver_name', 'doc_type', 'doc_number', 'issue_date', 'expiry_date', 'notes',
      'file_id', 'file_name', 'file_type', 'file_size', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['file_size'],
    bool: ['archived'],
  },
  assignments: {
    sheet: 'Assignments',
    cols: ['id', 'car_id', 'car_plate', 'driver_id', 'driver_name', 'start_date', 'end_date', 'notes', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: [],
    bool: ['archived'],
  },
  incomes: {
    sheet: 'Income',
    cols: ['id', 'car_id', 'car_plate', 'driver_id', 'driver_name', 'customer_name', 'amount', 'income_date',
      'period_from', 'period_to', 'payment_status', 'description', 'created_by', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['amount'],
    bool: ['archived'],
  },
  expenses: {
    sheet: 'Expenses',
    cols: ['id', 'car_id', 'car_plate', 'driver_id', 'driver_name', 'category', 'amount', 'expense_date',
      'description', 'reference', 'odometer', 'paid_by', 'status', 'created_by', 'created_at', 'waived', 'archived', 'archived_at', 'archived_by',
      'file_id', 'file_name', 'file_type', 'file_size'],
    num: ['amount', 'odometer', 'file_size'],
    bool: ['waived', 'archived'],
  },
  payroll: {
    sheet: 'Payroll',
    cols: ['id', 'driver_id', 'driver_name', 'type', 'amount', 'entry_date', 'month', 'method', 'description',
      'created_by', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['amount'],
    bool: ['archived'],
  },
  daily_logs: {
    sheet: 'DailyLogs',
    cols: ['id', 'driver_id', 'driver_name', 'car_id', 'car_plate', 'log_date', 'start_odometer', 'end_odometer',
      'trips', 'cash_collected', 'work_details', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['start_odometer', 'end_odometer', 'trips', 'cash_collected'],
    bool: ['archived'],
  },
};

var HIDDEN_USER_FIELDS = ['password_hash', 'salt', 'set_password'];
var READ_ONLY = ['id', 'created_at', 'car_plate', 'driver_name', 'created_by', 'file_id', 'file_name', 'file_type', 'file_size',
  'archived', 'archived_at', 'archived_by'];
var FILE_TABLES = ['car_documents', 'expenses'];
var MAX_FILE_BYTES = 10 * 1024 * 1024;

var ENUMS = {
  cars: { status: ['active', 'maintenance', 'inactive', 'sold'] },
  incomes: { payment_status: ['paid', 'due'] },
  expenses: {
    category: ['fuel', 'maintenance', 'repair', 'fine', 'toll', 'wash', 'tyre', 'insurance', 'registration', 'salary', 'other'],
    paid_by: ['company', 'driver'],
    status: ['pending', 'approved', 'rejected'],
  },
  users: { role: ['admin', 'manager', 'driver'] },
  payroll: {
    type: ['salary', 'bonus', 'advance', 'deduction', 'payment', 'refund'],
    method: ['cash', 'bank', 'other'],
  },
};

var REQUIRED = {
  cars: ['plate_no', 'status'],
  car_documents: ['doc_type'],
  assignments: ['car_id', 'driver_id', 'start_date'],
  incomes: ['car_id', 'amount', 'income_date', 'payment_status'],
  expenses: ['car_id', 'category', 'amount', 'expense_date', 'paid_by', 'status'],
  daily_logs: ['car_id', 'driver_id', 'log_date', 'work_details'],
  payroll: ['driver_id', 'type', 'amount', 'entry_date'],
};

var MONEY_FIELDS = ['amount', 'purchase_price', 'monthly_salary'];

/** Round money to 2 decimals exactly (avoids 2500.555 → 2500.55 floating-point errors). */
function round2_(v) {
  var n = Number(v);
  if (!isFinite(n)) return n;
  var str = String(Math.abs(n));
  var r = str.indexOf('e') >= 0 ? Math.round(Math.abs(n) * 100) / 100 : Number(Math.round(Number(str + 'e2')) + 'e-2');
  return n < 0 ? -r : r;
}

var DATE_FIELDS = ['iqama_expiry', 'license_expiry', 'purchase_date', 'issue_date', 'expiry_date', 'start_date',
  'end_date', 'income_date', 'period_from', 'period_to', 'expense_date', 'log_date'];

// ---------------------------------------------------------------- entry points

function doGet() {
  return json_({ ok: true, app: 'MAC CAR API', time: new Date().toISOString() });
}

function doPost(e) {
  var res;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    res = { ok: true, data: route_(body) };
  } catch (err) {
    res = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return json_(res);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function route_(b) {
  switch (b.action) {
    case 'ping':
      return { ok: true, googleLogin: !!prop_('GOOGLE_CLIENT_ID') };
    case 'login':
      return passwordLogin_(b.username, b.password);
    case 'googleLogin':
      return googleLogin_(b.credential);
  }

  var me = auth_(b.token);
  switch (b.action) {
    case 'me':
      return publicUser_(me);
    case 'data':
      return loadData_(me);
    case 'save':
      return withLock_(function () { return save_(me, b.table, b.row || {}); });
    case 'remove':
      return withLock_(function () { return remove_(me, b.table, b.id); });
    case 'saveUser':
      return withLock_(function () { return saveUser_(me, b.user || {}); });
    case 'restore':
      return withLock_(function () { return restore_(me, b.table, b.id); });
    case 'uploadFile':
      return withLock_(function () { return uploadFile_(me, b.table || 'car_documents', b.id, b.name, b.mimeType, b.base64); });
    case 'getFile':
      return getFile_(me, b.table || 'car_documents', b.id);
    case 'removeFile':
      return withLock_(function () { return removeFile_(me, b.table || 'car_documents', b.id); });
    case 'changePassword':
      return withLock_(function () { return changePassword_(me, b.oldPassword, b.newPassword); });
    default:
      throw new Error('Unknown action: ' + b.action);
  }
}

// ---------------------------------------------------------------- setup

/** Run once from the Apps Script editor. Creates sheets and a first admin login. */
function setup() {
  Object.keys(TABLES).forEach(function (t) { sheet_(t); });
  secret_();
  filesFolder_();
  var users = readTable_('users');
  var owner = Session.getEffectiveUser().getEmail();
  var msg = 'Sheets ready.\n';
  if (!users.some(function (u) { return u.role === 'admin'; })) {
    var pw = Utilities.getUuid().slice(0, 8);
    var salt = Utilities.getUuid();
    insertRow_('users', {
      username: 'admin',
      email: owner ? owner.toLowerCase() : '',
      full_name: 'Admin',
      role: 'admin',
      active: true,
      salt: salt,
      password_hash: hash_(pw, salt),
    });
    msg += 'First admin created → username: admin   password: ' + pw + '\n' +
      'You can also sign in with Google as ' + owner + ' (after setting GOOGLE_CLIENT_ID).\n';
  }
  Logger.log(msg);
  return msg;
}

/**
 * Set your own admin password: change NEW_PASSWORD below, then Run this function.
 * Username stays "admin".
 */
function setAdminPassword() {
  var NEW_PASSWORD = 'CHANGE-ME-123';
  if (NEW_PASSWORD === 'CHANGE-ME-123' || NEW_PASSWORD.length < 6) {
    throw new Error('Password NOT changed. First replace CHANGE-ME-123 with your own password (6+ characters), click Save, then Run again.');
  }
  var admin = findBy_('users', 'username', 'admin');
  if (!admin) {
    setup();
    admin = findBy_('users', 'username', 'admin');
  }
  var salt = Utilities.getUuid();
  updateRow_('users', admin.id, merge_(admin, { salt: salt, password_hash: hash_(NEW_PASSWORD, salt), active: true }));
  _cache = {};
  passwordLogin_('admin', NEW_PASSWORD); // self-check: throws if login would fail
  Logger.log('Done and checked. Sign in with  username: admin   password: ' + NEW_PASSWORD);
}

/** Optional: run once to enable "Sign in with Google". Paste your OAuth Web client ID here first. */
function setGoogleClientId() {
  var id = 'PASTE-YOUR-CLIENT-ID.apps.googleusercontent.com';
  PropertiesService.getScriptProperties().setProperty('GOOGLE_CLIENT_ID', id);
  Logger.log('GOOGLE_CLIENT_ID saved: ' + id);
}

// ---------------------------------------------------------------- auth

function prop_(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function secret_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('TOKEN_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('TOKEN_SECRET', s);
  }
  return s;
}

function hash_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + password, Utilities.Charset.UTF_8);
  for (var i = 0; i < 200; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes.concat(Utilities.newBlob(salt).getBytes()));
  }
  return Utilities.base64Encode(bytes);
}

function sign_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret_()));
}

function makeToken_(user) {
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    uid: user.id,
    exp: Date.now() + TOKEN_DAYS * 86400000,
  }));
  return payload + '.' + sign_(payload);
}

function auth_(token) {
  if (!token) throw new Error('Please sign in');
  var parts = String(token).split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) throw new Error('Session expired, please sign in again');
  var p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!p.exp || p.exp < Date.now()) throw new Error('Session expired, please sign in again');
  var user = findBy_('users', 'id', p.uid);
  if (!user || !user.active) throw new Error('Your account is not active. Contact the admin.');
  return user;
}

function session_(user) {
  return { token: makeToken_(user), user: publicUser_(user) };
}

function passwordLogin_(username, password) {
  var key = String(username || '').trim().toLowerCase();
  var pw = String(password || '');
  if (!key || !pw) throw new Error('Enter username and password');
  var user = readTable_('users').filter(function (u) {
    return String(u.username || '').toLowerCase() === key || String(u.email || '').toLowerCase() === key;
  })[0];
  if (!user) throw new Error('Username "' + key + '" not found');

  // Password typed into the "set_password" column of the Users sheet → becomes the new password.
  if (user.set_password) {
    user = withLock_(function () {
      var salt = Utilities.getUuid();
      return updateRow_('users', user.id, merge_(user, {
        salt: salt,
        password_hash: hash_(String(user.set_password).trim(), salt),
        set_password: null,
      }));
    });
  }

  if (!user.salt || !user.password_hash) {
    throw new Error('No password is set for "' + key + '". Type one in the set_password column of the Users sheet.');
  }
  var ok = hash_(pw, user.salt) === user.password_hash || hash_(pw.trim(), user.salt) === user.password_hash;
  if (!ok) throw new Error('Wrong password for "' + key + '"');
  if (!user.active) throw new Error('Your account is not active. Contact the admin.');
  return session_(user);
}

function googleLogin_(credential) {
  var clientId = prop_('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('Google sign-in is not set up yet (GOOGLE_CLIENT_ID missing)');
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), {
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) throw new Error('Google sign-in failed');
  var info = JSON.parse(r.getContentText());
  if (info.aud !== clientId) throw new Error('Google sign-in: wrong client ID');
  if (String(info.email_verified) !== 'true') throw new Error('Google email is not verified');
  var email = String(info.email).toLowerCase();

  var user = findBy_('users', 'email', email, true);
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  var extraAdmins = String(prop_('ADMIN_EMAILS') || '').toLowerCase().split(',').map(function (s) { return s.trim(); });

  if (!user && (email === owner || extraAdmins.indexOf(email) >= 0)) {
    return withLock_(function () {
      var created = insertRow_('users', {
        username: email.split('@')[0],
        email: email,
        full_name: info.name || email,
        role: 'admin',
        active: true,
      });
      return session_(created);
    });
  }
  if (!user) throw new Error('This Google account (' + email + ') has no access. Ask the admin to add it.');
  if (!user.active) throw new Error('Your account is not active. Contact the admin.');
  return session_(user);
}

function publicUser_(u) {
  var out = {};
  Object.keys(u).forEach(function (k) {
    if (HIDDEN_USER_FIELDS.indexOf(k) < 0) out[k] = u[k];
  });
  out.has_password = !!u.password_hash;
  return out;
}

function isAdmin_(u) {
  return u.role === 'admin' && u.active;
}

function requireAdmin_(u) {
  if (!isAdmin_(u)) throw new Error('Only an admin can do this');
}

// ---------------------------------------------------------------- manager (admin assistant) permissions
//
// A manager helps the admin. The admin ticks what each manager may do; it is stored in the
// "permissions" column as a list, e.g. "cars:edit,expenses:view,approve,reports".
//   areas (view or edit): cars, drivers, expenses, income, salary
//   extras (on/off):      approve  – approve/reject expenses, waive fines
//                         logins   – create driver logins, reset driver passwords, (de)activate drivers
//                         reports  – reports, profit and all money totals (read only)
//                         archive  – see archived items and restore them (in areas they can edit)
// A manager can never touch admins, other managers or anyone's permissions.

var PERM_AREAS = ['cars', 'drivers', 'expenses', 'income', 'salary'];
var PERM_FLAGS = ['approve', 'logins', 'reports', 'archive'];

function isManager_(u) {
  return u.role === 'manager' && !!u.active;
}

function isStaff_(u) {
  return isAdmin_(u) || isManager_(u);
}

/** Parse + clean a permissions list. Unknown entries are dropped. */
function parsePerms_(text) {
  var out = {};
  String(text || '').split(/[\s,;]+/).forEach(function (t) {
    var bits = t.trim().toLowerCase().split(':');
    var k = bits[0];
    if (PERM_AREAS.indexOf(k) >= 0) {
      var lvl = bits[1] === 'edit' ? 'edit' : 'view';
      if (out[k] !== 'edit') out[k] = lvl;
    } else if (PERM_FLAGS.indexOf(k) >= 0) {
      out[k] = true;
    }
  });
  return out;
}

function permsText_(text) {
  var p = parsePerms_(text);
  var out = [];
  PERM_AREAS.forEach(function (a) { if (p[a]) out.push(a + ':' + p[a]); });
  PERM_FLAGS.forEach(function (f) { if (p[f]) out.push(f); });
  return out.join(',');
}

/** can_(me, 'cars', 'edit'), can_(me, 'expenses') (= view), can_(me, 'approve') */
function can_(u, what, level) {
  if (isAdmin_(u)) return true;
  if (!isManager_(u)) return false;
  var p = parsePerms_(u.permissions);
  if (PERM_FLAGS.indexOf(what) >= 0) return !!p[what];
  if (level === 'edit') return p[what] === 'edit';
  return p[what] === 'view' || p[what] === 'edit';
}

function need_(u, what, level) {
  if (!can_(u, what, level)) throw new Error('You do not have permission for this (' + what + (level ? ' ' + level : '') + '). Ask the admin.');
}

/** Which permission area a row belongs to. */
function areaOf_(table, row) {
  if (table === 'car_documents') return row.car_id ? 'cars' : 'drivers';
  return { cars: 'cars', assignments: 'cars', daily_logs: 'drivers', incomes: 'income', expenses: 'expenses', payroll: 'salary' }[table];
}

/** Can this person read expenses (they also feed salary accounts and reports)? */
function canReadExpenses_(u) {
  return can_(u, 'expenses') || can_(u, 'approve') || can_(u, 'salary') || can_(u, 'reports');
}

/** Rules for a manager saving a row (old = current row when editing). Throws or adjusts row. */
function checkManagerSave_(me, table, row, old) {
  var merged = old ? merge_(old, row) : row;
  if (table !== 'expenses') {
    need_(me, areaOf_(table, merged), 'edit');
    if (old && table === 'car_documents' && areaOf_(table, old) !== areaOf_(table, merged)) need_(me, areaOf_(table, old), 'edit');
    return;
  }
  var approve = can_(me, 'approve');
  if (!old) {
    need_(me, 'expenses', 'edit');
    if (!approve) {
      row.status = 'pending';
      delete row.waived;
    }
    return;
  }
  var norm = function (v) { return v === null || v === undefined ? '' : String(v); };
  var touched = Object.keys(row).filter(function (k) { return norm(row[k]) !== norm(old[k]); });
  var decision = touched.filter(function (k) { return k === 'status' || k === 'waived'; });
  var other = touched.filter(function (k) { return k !== 'status' && k !== 'waived'; });
  if (decision.length) need_(me, 'approve');
  if (other.length) {
    need_(me, 'expenses', 'edit');
    if (!approve && old.status !== 'pending') throw new Error('Only someone who can approve may change an approved or rejected expense');
  }
}

// ---------------------------------------------------------------- data

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function activeOn_(a, day) {
  return a.start_date <= day && (!a.end_date || a.end_date >= day);
}

function loadData_(me) {
  var cars = readTable_('cars');
  var users = readTable_('users');
  var docs = readTable_('car_documents');
  var assignments = readTable_('assignments');
  var expenses = readTable_('expenses');
  var logs = readTable_('daily_logs');

  if (isAdmin_(me)) {
    return {
      me: publicUser_(me),
      cars: cars,
      profiles: users.map(publicUser_),
      docs: docs,
      assignments: assignments,
      incomes: readTable_('incomes'),
      expenses: expenses,
      logs: logs,
      payroll: readTable_('payroll'),
    };
  }

  var live = function (r) { return !r.archived; };
  if (isManager_(me)) return managerData_(me, users, cars, docs, assignments, expenses, logs);
  cars = cars.filter(live);
  docs = docs.filter(live);
  expenses = expenses.filter(live);
  logs = logs.filter(live);
  var day = today_();
  var mine = assignments.filter(function (a) { return a.driver_id === me.id && !a.archived; });
  var everCar = {};
  var nowCar = {};
  mine.forEach(function (a) {
    everCar[a.car_id] = true;
    if (activeOn_(a, day)) nowCar[a.car_id] = true;
  });
  return {
    me: publicUser_(me),
    cars: cars.filter(function (c) { return everCar[c.id]; }),
    profiles: [publicUser_(me)],
    docs: docs.filter(function (d) { return nowCar[d.car_id] || d.driver_id === me.id; }),
    assignments: mine,
    incomes: [],
    expenses: expenses.filter(function (x) { return x.driver_id === me.id; }),
    logs: logs.filter(function (l) { return l.driver_id === me.id; }),
    payroll: readTable_('payroll').filter(function (x) { return x.driver_id === me.id && !x.archived; }),
  };
}

/** A manager only receives the tables their permissions allow. */
function managerData_(me, users, cars, docs, assignments, expenses, logs) {
  var keep = function (rows) { return can_(me, 'archive') ? rows : rows.filter(function (r) { return !r.archived; }); };
  var seeDrivers = can_(me, 'drivers');
  var seePay = can_(me, 'salary') || can_(me, 'reports');
  var profiles = users.map(function (u) {
    if (u.id === me.id) return publicUser_(u);
    if (u.role !== 'driver') return { id: u.id, full_name: u.full_name, username: u.username, role: u.role, active: u.active };
    var p = publicUser_(u);
    if (!seePay) delete p.monthly_salary;
    if (!seeDrivers) {
      return { id: p.id, full_name: p.full_name, username: p.username, role: p.role, active: p.active, monthly_salary: p.monthly_salary };
    }
    return p;
  });
  return {
    me: publicUser_(me),
    cars: keep(cars),
    profiles: profiles,
    docs: keep(docs).filter(function (d) { return can_(me, areaOf_('car_documents', d)); }),
    assignments: keep(assignments),
    incomes: can_(me, 'income') || can_(me, 'reports') ? keep(readTable_('incomes')) : [],
    expenses: canReadExpenses_(me) ? keep(expenses) : [],
    logs: can_(me, 'drivers') || can_(me, 'cars') ? keep(logs) : [],
    payroll: seePay ? keep(readTable_('payroll')) : [],
  };
}

function drivesNow_(me, carId) {
  var day = today_();
  return readTable_('assignments').some(function (a) {
    return a.driver_id === me.id && a.car_id === carId && !a.archived && activeOn_(a, day);
  });
}

/** Keep only known, writable fields and validate them. */
function clean_(table, row) {
  var def = TABLES[table];
  var out = {};
  def.cols.forEach(function (c) {
    if (READ_ONLY.indexOf(c) >= 0 || HIDDEN_USER_FIELDS.indexOf(c) >= 0) return;
    if (!(c in row)) return;
    var v = row[c];
    if (v === '' || v === undefined) v = null;
    if (v !== null && def.num.indexOf(c) >= 0) {
      v = Number(v);
      if (isNaN(v)) throw new Error(c + ' must be a number');
      if (MONEY_FIELDS.indexOf(c) >= 0) {
        if (v < 0) throw new Error(c.replace(/_/g, ' ') + ' cannot be negative');
        v = round2_(v); // exact halala rounding (2500.555 → 2500.56)
      }
    }
    if (v !== null && DATE_FIELDS.indexOf(c) >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
      throw new Error(c + ' must be a date (YYYY-MM-DD)');
    }
    var allowed = ENUMS[table] && ENUMS[table][c];
    if (allowed && v !== null && allowed.indexOf(v) < 0) throw new Error('Invalid ' + c + ': ' + v);
    out[c] = v;
  });
  return out;
}

function checkRequired_(table, row) {
  if (table === 'car_documents' && !row.car_id && !row.driver_id) throw new Error('Choose a car or a driver for this document');
  (REQUIRED[table] || []).forEach(function (c) {
    if (row[c] === null || row[c] === undefined || row[c] === '') throw new Error(c.replace(/_/g, ' ') + ' is required');
  });
}

/** Fill car_plate / driver_name helper columns so the sheet is readable. */
function decorate_(row) {
  if (row.car_id) {
    var car = findBy_('cars', 'id', row.car_id);
    if (!car) throw new Error('Car not found');
    row.car_plate = car.plate_no;
  }
  if ('driver_id' in row) {
    var d = row.driver_id ? findBy_('users', 'id', row.driver_id) : null;
    if (row.driver_id && !d) throw new Error('Driver not found');
    row.driver_name = d ? d.full_name || d.username : null;
  }
  return row;
}

function save_(me, table, input) {
  if (!TABLES[table] || table === 'users') throw new Error('Unknown table');
  var id = input.id;
  var row = clean_(table, input);
  var saved;

  if (isStaff_(me)) {
    if (isManager_(me)) {
      var before = id ? findBy_(table, 'id', id) : null;
      if (id && !before) throw new Error('Record not found');
      checkManagerSave_(me, table, row, before);
    }
    if (table === 'payroll') checkPayroll_(id ? merge_(findBy_('payroll', 'id', id) || {}, row) : row, id);
    if (table === 'cars' && row.plate_no) {
      var dup = readTable_('cars').filter(function (c) {
        return !c.archived && String(c.plate_no).toLowerCase() === String(row.plate_no).toLowerCase() && c.id !== id;
      });
      if (dup.length) throw new Error('A car with plate ' + row.plate_no + ' already exists');
    }
    if (id) {
      var old = findBy_(table, 'id', id);
      if (!old) throw new Error('Record not found');
      var merged = merge_(old, row);
      checkRequired_(table, merged);
      saved = updateRow_(table, id, decorate_(merged));
      if (table === 'cars' && old.plate_no !== saved.plate_no) renamePlate_(saved);
    } else {
      if (table === 'incomes' || table === 'expenses') row.created_by = me.id;
      checkRequired_(table, row);
      saved = insertRow_(table, decorate_(row));
    }
  } else {
    // Drivers: only add new expenses and daily logs for the car they drive today
    if (id) throw new Error('Only an admin can edit saved entries');
    if (table !== 'expenses' && table !== 'daily_logs') throw new Error('Not allowed');
    row.driver_id = me.id;
    delete row.waived; // only the admin can waive a fine
    if (table === 'expenses') {
      row.status = 'pending';
      row.created_by = me.id;
      if (!row.paid_by) row.paid_by = 'driver';
    }
    checkRequired_(table, row);
    if (!drivesNow_(me, row.car_id)) throw new Error('You are not assigned to this car today');
    saved = insertRow_(table, decorate_(row));
  }

  bumpOdometer_(table, saved);
  return saved;
}

/** Salary account rules, so the driver's balance is always right. */
function checkPayroll_(row, id) {
  if (!(Number(row.amount) > 0)) throw new Error('Amount must be more than 0');
  var drv = findBy_('users', 'id', row.driver_id);
  if (!drv || drv.role !== 'driver') throw new Error('Choose a driver');
  if (row.type === 'salary') {
    if (!/^\d{4}-\d{2}$/.test(String(row.month || ''))) throw new Error('Choose the salary month');
    var dup = readTable_('payroll').some(function (x) {
      return x.type === 'salary' && !x.archived && x.driver_id === row.driver_id && x.month === row.month && x.id !== id;
    });
    if (dup) throw new Error('Salary for ' + row.month + ' is already added for ' + (drv.full_name || drv.username));
  }
}

function merge_(old, patch) {
  var out = {};
  Object.keys(old).forEach(function (k) { out[k] = old[k]; });
  Object.keys(patch).forEach(function (k) { out[k] = patch[k]; });
  return out;
}

function renamePlate_(car) {
  ['car_documents', 'assignments', 'incomes', 'expenses', 'daily_logs'].forEach(function (t) {
    updateWhere_(t, 'car_id', car.id, { car_plate: car.plate_no });
  });
}

function bumpOdometer_(table, row) {
  var reading = null;
  if (table === 'expenses') reading = row.odometer;
  if (table === 'daily_logs') reading = row.end_odometer !== null ? row.end_odometer : row.start_odometer;
  if (reading === null || reading === undefined || !row.car_id) return;
  var car = findBy_('cars', 'id', row.car_id);
  if (car && (car.current_odometer === null || Number(car.current_odometer) < Number(reading))) {
    updateRow_('cars', car.id, merge_(car, { current_odometer: Number(reading) }));
  }
}

/**
 * "Delete" never erases anything: the row is marked archived (hidden in the app, kept in the sheet)
 * and can be restored from the Archive page.
 */
function remove_(me, table, id) {
  if (!TABLES[table] || table === 'users') throw new Error('Unknown table');
  var row = findBy_(table, 'id', id);
  if (!row) throw new Error('Record not found');

  if (isManager_(me)) {
    need_(me, areaOf_(table, row), 'edit');
    if (table === 'expenses' && !can_(me, 'approve') && row.status !== 'pending') {
      throw new Error('Only someone who can approve may delete an approved or rejected expense');
    }
  } else if (!isAdmin_(me)) {
    var own = row.driver_id === me.id;
    var okExpense = table === 'expenses' && own && row.status === 'pending';
    var okLog = table === 'daily_logs' && own && row.log_date === today_();
    if (!okExpense && !okLog) throw new Error('Not allowed');
  }
  return updateRow_(table, id, merge_(row, { archived: true, archived_at: new Date().toISOString(), archived_by: me.id }));
}

function restore_(me, table, id) {
  if (!isAdmin_(me)) need_(me, 'archive');
  if (!TABLES[table] || table === 'users') throw new Error('Unknown table');
  var row = findBy_(table, 'id', id);
  if (!row) throw new Error('Record not found');
  if (isManager_(me)) need_(me, areaOf_(table, row), 'edit');
  if (table === 'payroll' && row.type === 'salary') checkPayroll_(merge_(row, { archived: false }), id);
  if (table === 'cars') {
    var dup = readTable_('cars').some(function (c) {
      return !c.archived && c.id !== id && String(c.plate_no).toLowerCase() === String(row.plate_no).toLowerCase();
    });
    if (dup) throw new Error('Another car with plate ' + row.plate_no + ' exists. Archive or rename it first.');
  }
  return updateRow_(table, id, merge_(row, { archived: false, archived_at: null, archived_by: null }));
}

function saveUser_(me, input) {
  var id = input.id;
  var isSelf = id && id === me.id;
  var helper = isManager_(me) && !isSelf; // a manager managing driver logins
  if (!isAdmin_(me) && !isSelf && !(helper && can_(me, 'logins'))) throw new Error('Only an admin can manage users');

  var row = clean_('users', input);
  if (row.username) row.username = String(row.username).trim().toLowerCase();
  if (row.email) row.email = String(row.email).trim().toLowerCase();
  if ('permissions' in row) row.permissions = permsText_(row.permissions);

  if (!isAdmin_(me) && isSelf) {
    // Drivers and managers may only update their own phone number
    row = { phone: row.phone };
  } else if (helper) {
    // Managers create / edit driver logins only, never admins or managers
    if (id) {
      var target = findBy_('users', 'id', id);
      if (!target) throw new Error('User not found');
      if (target.role !== 'driver') throw new Error('Only the admin can change admin or manager accounts');
    }
    if (row.role && row.role !== 'driver') throw new Error('Only the admin can give admin or manager access');
    row.role = 'driver';
    delete row.permissions;
    if (!can_(me, 'salary', 'edit')) delete row.monthly_salary;
  }

  var all = readTable_('users');
  if (row.username && all.some(function (u) { return u.username === row.username && u.id !== id; })) {
    throw new Error('Username "' + row.username + '" is already taken');
  }
  if (row.email && all.some(function (u) { return u.email === row.email && u.id !== id; })) {
    throw new Error('Email "' + row.email + '" is already used by another user');
  }

  var password = input.password ? String(input.password) : '';
  if (password && password.length < 6) throw new Error('Password must be at least 6 characters');

  var saved;
  if (id) {
    var old = findBy_('users', 'id', id);
    if (!old) throw new Error('User not found');
    if (isSelf && isAdmin_(me) && ((row.role && row.role !== 'admin') || row.active === false)) {
      throw new Error('You cannot remove your own admin access');
    }
    var merged = merge_(old, row);
    if (password && (isAdmin_(me) || helper)) {
      merged.salt = Utilities.getUuid();
      merged.password_hash = hash_(password, merged.salt);
    }
    saved = updateRow_('users', id, merged);
    // keep helper names in other sheets in sync
    if (old.full_name !== saved.full_name) {
      ['assignments', 'incomes', 'expenses', 'daily_logs', 'payroll', 'car_documents'].forEach(function (t) {
        updateWhere_(t, 'driver_id', id, { driver_name: saved.full_name || saved.username });
      });
    }
  } else {
    if (!row.username) throw new Error('Username is required');
    if (!row.full_name) throw new Error('Full name is required');
    if (!password) throw new Error('Password is required');
    row.role = row.role || 'driver';
    row.active = row.active === null || row.active === undefined ? true : row.active;
    row.salt = Utilities.getUuid();
    row.password_hash = hash_(password, row.salt);
    saved = insertRow_('users', row);
  }
  return publicUser_(saved);
}

function changePassword_(me, oldPw, newPw) {
  if (!newPw || String(newPw).length < 6) throw new Error('New password must be at least 6 characters');
  if (me.password_hash && hash_(String(oldPw || ''), me.salt) !== me.password_hash) {
    throw new Error('Current password is wrong');
  }
  var salt = Utilities.getUuid();
  updateRow_('users', me.id, merge_(me, { salt: salt, password_hash: hash_(String(newPw), salt) }));
  return { ok: true };
}

// ---------------------------------------------------------------- files (Google Drive)

/** "MAC CAR Files" folder in the admin's Google Drive. */
function filesFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FILES_FOLDER_ID');
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) {
      // folder deleted — make a new one
    }
  }
  var folder = DriveApp.createFolder('MAC CAR Files');
  props.setProperty('FILES_FOLDER_ID', folder.getId());
  return folder;
}

function trashFile_(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    // already gone
  }
}

function canSeeDoc_(me, doc) {
  if (isAdmin_(me)) return true;
  if (isManager_(me)) return can_(me, areaOf_('car_documents', doc));
  return doc.driver_id === me.id || (doc.car_id && drivesNow_(me, doc.car_id));
}

/** Old files are never deleted from Drive — they are renamed so the history stays. */
function retireFile_(fileId, why) {
  if (!fileId) return;
  try {
    var f = DriveApp.getFileById(fileId);
    f.setName('[' + why + '] ' + f.getName());
  } catch (e) {
    // gone already
  }
}

function fileRow_(me, table, id, forWrite) {
  if (FILE_TABLES.indexOf(table) < 0) throw new Error('Files are not supported here');
  var row = findBy_(table, 'id', id);
  if (!row) throw new Error('Record not found');
  if (isAdmin_(me)) return row;
  if (isManager_(me)) {
    if (table === 'car_documents') {
      need_(me, areaOf_(table, row), forWrite ? 'edit' : 'view');
    } else if (forWrite) {
      need_(me, 'expenses', 'edit');
      if (!can_(me, 'approve') && row.status !== 'pending') throw new Error('Only someone who can approve may change the receipt after approval');
    } else if (!canReadExpenses_(me)) {
      throw new Error('Not allowed');
    }
    return row;
  }
  if (table === 'car_documents') {
    if (forWrite) throw new Error('Only an admin can change document files');
    if (!canSeeDoc_(me, row)) throw new Error('Not allowed');
    return row;
  }
  // expenses: the driver who entered it can attach / view the receipt
  if (row.driver_id !== me.id || row.archived) throw new Error('Not allowed');
  if (forWrite === 'remove' && row.status !== 'pending') throw new Error('Only the admin can change the receipt after approval');
  return row;
}

function uploadFile_(me, table, id, name, mimeType, base64) {
  var row = fileRow_(me, table, id, 'upload');
  if (!base64) throw new Error('No file received');
  var bytes = Utilities.base64Decode(String(base64).replace(/^data:[^,]*,/, ''));
  if (bytes.length > MAX_FILE_BYTES) throw new Error('File is too big (max 10 MB)');
  var label = table === 'expenses'
    ? ['Receipt', row.car_plate || '', row.expense_date || '', row.driver_name || ''].filter(String).join(' - ')
    : [row.car_plate || row.driver_name || '', row.doc_type].filter(String).join(' - ');
  var cleanName = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_');
  var blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', label ? label + ' - ' + cleanName : cleanName);
  var file = filesFolder_().createFile(blob);
  retireFile_(row.file_id, 'replaced');
  return updateRow_(table, row.id, merge_(row, {
    file_id: file.getId(),
    file_name: cleanName,
    file_type: blob.getContentType(),
    file_size: bytes.length,
  }));
}

function getFile_(me, table, id) {
  var row = fileRow_(me, table, id, false);
  if (!row.file_id) throw new Error('No file attached');
  var blob = DriveApp.getFileById(row.file_id).getBlob();
  return { name: row.file_name, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

function removeFile_(me, table, id) {
  var row = fileRow_(me, table, id, 'remove');
  retireFile_(row.file_id, 'removed');
  return updateRow_(table, row.id, merge_(row, { file_id: null, file_name: null, file_type: null, file_size: null }));
}

// ---------------------------------------------------------------- sheet helpers

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var out = fn();
    SpreadsheetApp.flush();
    return out;
  } finally {
    lock.releaseLock();
  }
}

var _cache = {};

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(table) {
  var def = TABLES[table];
  var sh = ss_().getSheetByName(def.sheet);
  if (!sh) {
    sh = ss_().insertSheet(def.sheet);
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols])
      .setFontWeight('bold').setBackground('#0b1324').setFontColor('#00e5ff');
    sh.setFrozenRows(1);
    if (table === 'users') {
      var hidden = def.cols.indexOf('password_hash') + 1;
      sh.hideColumns(hidden, 2);
    }
  } else {
    // add any new columns (safe upgrade)
    var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    def.cols.forEach(function (c) {
      if (have.indexOf(c) < 0) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
        have.push(c);
      }
    });
  }
  return sh;
}

function header_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function fromCell_(table, col, v) {
  var def = TABLES[table];
  if (v === '' || v === null || v === undefined) return def.bool && def.bool.indexOf(col) >= 0 ? false : null;
  if (def.bool && def.bool.indexOf(col) >= 0) return v === true || String(v).toLowerCase() === 'true';
  if (v instanceof Date) {
    if (col === 'created_at') return v.toISOString();
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (def.num.indexOf(col) >= 0) {
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  return String(v);
}

function readTable_(table) {
  if (_cache[table]) return _cache[table];
  var sh = sheet_(table);
  var last = sh.getLastRow();
  var head = header_(sh);
  var rows = [];
  if (last >= 2) {
    var values = sh.getRange(2, 1, last - 1, head.length).getValues();
    values.forEach(function (r) {
      if (!r[0]) return;
      var o = {};
      head.forEach(function (c, i) {
        if (TABLES[table].cols.indexOf(c) >= 0) o[c] = fromCell_(table, c, r[i]);
      });
      rows.push(o);
    });
  }
  _cache[table] = rows;
  return rows;
}

function findBy_(table, col, value, ci) {
  if (value === null || value === undefined || value === '') return null;
  var v = ci ? String(value).toLowerCase() : value;
  return readTable_(table).filter(function (r) {
    return (ci ? String(r[col] || '').toLowerCase() : r[col]) === v;
  })[0] || null;
}

function rowValues_(table, head, obj) {
  var def = TABLES[table];
  return head.map(function (c) {
    var v = obj[c];
    if (v === null || v === undefined) return '';
    if (def.bool && def.bool.indexOf(c) >= 0) return v ? true : false;
    return v;
  });
}

function rowFormats_(table, head) {
  var def = TABLES[table];
  return head.map(function (c) {
    if (def.num.indexOf(c) >= 0) return '0.##';
    if (def.bool && def.bool.indexOf(c) >= 0) return 'General';
    return '@'; // plain text keeps dates as YYYY-MM-DD
  });
}

function writeRow_(table, sh, rowIndex, obj) {
  var head = header_(sh);
  var range = sh.getRange(rowIndex, 1, 1, head.length);
  range.setNumberFormats([rowFormats_(table, head)]);
  range.setValues([rowValues_(table, head, obj)]);
}

function insertRow_(table, row) {
  var sh = sheet_(table);
  var obj = merge_(row, { id: Utilities.getUuid(), created_at: new Date().toISOString() });
  writeRow_(table, sh, sh.getLastRow() + 1, obj);
  delete _cache[table];
  return clientRow_(table, obj);
}

function rowIndex_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

function updateRow_(table, id, obj) {
  var sh = sheet_(table);
  var idx = rowIndex_(sh, id);
  if (idx < 0) throw new Error('Record not found');
  obj.id = id;
  writeRow_(table, sh, idx, obj);
  delete _cache[table];
  return clientRow_(table, obj);
}

function updateWhere_(table, col, value, patch) {
  readTable_(table).forEach(function (r) {
    if (r[col] === value) updateRow_(table, r.id, merge_(r, patch));
  });
}

function deleteRow_(table, id) {
  var sh = sheet_(table);
  var idx = rowIndex_(sh, id);
  if (idx > 0) sh.deleteRow(idx);
  delete _cache[table];
}

function deleteWhere_(table, col, value) {
  var sh = sheet_(table);
  var head = header_(sh);
  var c = head.indexOf(col);
  var last = sh.getLastRow();
  if (c < 0 || last < 2) return;
  var vals = sh.getRange(2, c + 1, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] === value) sh.deleteRow(i + 2);
  }
  delete _cache[table];
}

function clientRow_(table, obj) {
  var out = {};
  TABLES[table].cols.forEach(function (c) {
    var v = obj[c];
    out[c] = v === undefined || v === '' ? null : v;
  });
  if (table === 'users') return out; // publicUser_ strips secrets later
  return out;
}
