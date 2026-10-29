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
      'iqama_expiry', 'license_no', 'license_expiry', 'notes', 'created_at', 'set_password', 'password_hash', 'salt', 'monthly_salary', 'permissions',
      'basic_salary', 'food_allowance', 'housing_allowance', 'transport_allowance', 'other_allowance',
      'date_of_birth', 'address', 'emergency_name', 'emergency_phone', 'bank_name', 'iban', 'profile_updated_at'],
    num: ['monthly_salary', 'basic_salary', 'food_allowance', 'housing_allowance', 'transport_allowance', 'other_allowance'],
    bool: ['active'],
  },
  cars: {
    sheet: 'Cars',
    cols: ['id', 'plate_no', 'make', 'model', 'year', 'color', 'vin', 'status', 'purchase_date',
      'purchase_price', 'current_odometer', 'notes', 'created_at', 'archived', 'archived_at', 'archived_by',
      'ownership', 'rent_owner', 'rent_owner_phone', 'monthly_rent', 'rent_start', 'rent_end'],
    num: ['year', 'purchase_price', 'current_odometer', 'monthly_rent'],
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
  // Company money a driver holds for car work (fuel, repairs…). Separate from salary.
  //   given        company gives cash to the driver            (+ cash in hand)
  //   returned     driver gives unused cash back               (− cash in hand)
  //   to_salary    driver kept cash → taken from his salary    (− cash in hand, − salary)
  //   from_salary  driver spent more than he had → paid via salary (+ cash in hand, + salary)
  // Expenses with paid_by = 'cash' are paid from this money.
  cash: {
    sheet: 'CompanyCash',
    cols: ['id', 'driver_id', 'driver_name', 'type', 'amount', 'entry_date', 'method', 'description',
      'created_by', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['amount'],
    bool: ['archived'],
  },
  // Partners (share holders) of a car: they get share_percent of the car's monthly profit
  // after the company's management fee (fee_percent).
  car_shares: {
    sheet: 'CarShares',
    cols: ['id', 'car_id', 'car_plate', 'partner_id', 'partner_name', 'share_percent', 'fee_percent', 'start_date', 'end_date', 'notes',
      'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['share_percent', 'fee_percent'],
    bool: ['archived'],
  },
  // Money paid to a partner (payout) or other corrections to the partner's wallet.
  partner_ledger: {
    sheet: 'PartnerWallet',
    cols: ['id', 'partner_id', 'partner_name', 'car_id', 'car_plate', 'type', 'amount', 'entry_date', 'method', 'description',
      'created_by', 'created_at', 'archived', 'archived_at', 'archived_by'],
    num: ['amount'],
    bool: ['archived'],
  },
};

var HIDDEN_USER_FIELDS = ['password_hash', 'salt', 'set_password'];
var READ_ONLY = ['id', 'created_at', 'car_plate', 'driver_name', 'created_by', 'file_id', 'file_name', 'file_type', 'file_size',
  'archived', 'archived_at', 'archived_by'];
var FILE_TABLES = ['car_documents', 'expenses'];
var MAX_FILE_BYTES = 10 * 1024 * 1024;

var ENUMS = {
  cars: { status: ['active', 'maintenance', 'inactive', 'sold'], ownership: ['own', 'rented', 'shared'] },
  cash: { type: ['given', 'returned', 'to_salary', 'from_salary'], method: ['cash', 'bank', 'other'] },
  partner_ledger: { type: ['payout', 'adjust_add', 'adjust_less'], method: ['cash', 'bank', 'other'] },
  incomes: { payment_status: ['paid', 'due'] },
  expenses: {
    category: ['fuel', 'maintenance', 'repair', 'fine', 'toll', 'wash', 'tyre', 'insurance', 'registration', 'salary', 'rent', 'other'],
    paid_by: ['company', 'driver', 'cash'],
    status: ['pending', 'approved', 'rejected'],
  },
  users: { role: ['admin', 'manager', 'driver', 'partner'] },
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
  cash: ['driver_id', 'type', 'amount', 'entry_date'],
  car_shares: ['car_id', 'partner_id', 'share_percent', 'start_date'],
  partner_ledger: ['partner_id', 'type', 'amount', 'entry_date'],
};

/** What every user may fill in / change on their own profile (they can never clear a filled field). */
var SELF_FIELDS = ['full_name', 'phone', 'nationality', 'date_of_birth', 'address', 'emergency_name', 'emergency_phone',
  'iqama_no', 'iqama_expiry', 'license_no', 'license_expiry', 'bank_name', 'iban'];

var SALARY_PARTS = ['basic_salary', 'food_allowance', 'housing_allowance', 'transport_allowance', 'other_allowance'];
var MONEY_FIELDS = ['amount', 'purchase_price', 'monthly_salary'].concat(SALARY_PARTS);

/** Monthly salary = basic + food + housing + transport + other (when any part is set). */
function salaryTotal_(u) {
  var any = false;
  var cents = 0;
  SALARY_PARTS.forEach(function (k) {
    if (u[k] !== null && u[k] !== undefined && u[k] !== '') {
      any = true;
      cents += Math.round(Number(u[k]) * 100);
    }
  });
  return any ? cents / 100 : null;
}

/** Round money to 2 decimals exactly (avoids 2500.555 → 2500.55 floating-point errors). */
function round2_(v) {
  var n = Number(v);
  if (!isFinite(n)) return n;
  var str = String(Math.abs(n));
  var r = str.indexOf('e') >= 0 ? Math.round(Math.abs(n) * 100) / 100 : Number(Math.round(Number(str + 'e2')) + 'e-2');
  return n < 0 ? -r : r;
}

var DATE_FIELDS = ['date_of_birth', 'rent_start', 'rent_end', 'iqama_expiry', 'license_expiry', 'purchase_date', 'issue_date', 'expiry_date', 'start_date',
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
    case 'getSettings':
      requireAdmin_(me);
      return waSettings_();
    case 'saveSettings':
      requireAdmin_(me);
      return withLock_(function () { return saveWaSettings_(b.settings || {}); });
    case 'sendReportNow':
      requireAdmin_(me);
      return sendDailyReport_(b.day || null, true);
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
  try {
    filesFolder_();
  } catch (e) {
    throw new Error('Google Drive permission is missing, so document and receipt files cannot be saved. ' +
      'Fix: Project Settings → tick "Show appsscript.json manifest file" → open appsscript.json → paste the one from GitHub ' +
      '(apps-script/appsscript.json, it contains https://www.googleapis.com/auth/drive) → Save → run setup again and click Allow. ' +
      'Original error: ' + e.message);
  }
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

var PERM_AREAS = ['cars', 'drivers', 'expenses', 'income', 'salary', 'partners'];
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
  return { cars: 'cars', assignments: 'cars', daily_logs: 'drivers', incomes: 'income', expenses: 'expenses', payroll: 'salary',
    cash: 'salary', car_shares: 'partners', partner_ledger: 'partners' }[table];
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
      cash: readTable_('cash'),
      shares: readTable_('car_shares'),
      partnerLedger: readTable_('partner_ledger'),
    };
  }

  var live = function (r) { return !r.archived; };
  if (isManager_(me)) return managerData_(me, users, cars, docs, assignments, expenses, logs);
  if (me.role === 'partner') return partnerData_(me, cars, expenses);
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
    cash: readTable_('cash').filter(function (x) { return x.driver_id === me.id && !x.archived; }),
    shares: [],
    partnerLedger: [],
  };
}

/** A partner sees only the cars they hold a share in: income and approved expenses (no driver details), and their own wallet. */
function partnerData_(me, cars, expenses) {
  var live = function (r) { return !r.archived; };
  var shares = readTable_('car_shares').filter(function (x) { return x.partner_id === me.id && live(x); });
  var mine = {};
  shares.forEach(function (x) { mine[x.car_id] = true; });
  var strip = function (r) {
    var o = {};
    Object.keys(r).forEach(function (k) { if (k !== 'driver_id' && k !== 'driver_name' && k !== 'created_by' && k.indexOf('file_') !== 0) o[k] = r[k]; });
    o.driver_id = null;
    return o;
  };
  return {
    me: publicUser_(me),
    cars: cars.filter(function (c) { return mine[c.id] && live(c); }).map(function (c) {
      return { id: c.id, plate_no: c.plate_no, make: c.make, model: c.model, year: c.year, color: c.color, status: c.status, ownership: c.ownership, created_at: c.created_at };
    }),
    profiles: [publicUser_(me)],
    docs: [],
    assignments: [],
    incomes: readTable_('incomes').filter(function (x) { return mine[x.car_id] && live(x); }).map(strip),
    expenses: expenses.filter(function (x) { return mine[x.car_id] && live(x) && x.status === 'approved'; }).map(strip),
    logs: [],
    payroll: [],
    cash: [],
    shares: shares,
    partnerLedger: readTable_('partner_ledger').filter(function (x) { return x.partner_id === me.id && live(x); }),
  };
}

/** Company cash a driver holds right now (can be negative = he spent his own money on top). */
function cashBalance_(driverId) {
  var c = 0;
  readTable_('cash').forEach(function (x) {
    if (x.archived || x.driver_id !== driverId) return;
    var v = Math.round(Number(x.amount) * 100);
    c += x.type === 'given' || x.type === 'from_salary' ? v : -v;
  });
  readTable_('expenses').forEach(function (e) {
    if (e.archived || e.driver_id !== driverId || e.paid_by !== 'cash' || e.status === 'rejected') return;
    c -= Math.round(Number(e.amount) * 100);
  });
  return c / 100;
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
    if (!seePay) {
      delete p.monthly_salary;
      SALARY_PARTS.forEach(function (k) { delete p[k]; });
    }
    if (!seeDrivers) {
      var slim = { id: p.id, full_name: p.full_name, username: p.username, role: p.role, active: p.active, monthly_salary: p.monthly_salary };
      if (seePay) SALARY_PARTS.forEach(function (k) { slim[k] = p[k]; });
      return slim;
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
    cash: seePay || canReadExpenses_(me) ? keep(readTable_('cash')) : [],
    shares: can_(me, 'partners') ? keep(readTable_('car_shares')) : [],
    partnerLedger: can_(me, 'partners') ? keep(readTable_('partner_ledger')) : [],
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
  if (table === 'daily_logs' && row.start_odometer != null && row.end_odometer != null && Number(row.end_odometer) < Number(row.start_odometer)) {
    throw new Error('End odometer cannot be less than start odometer');
  }
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
  if ('partner_id' in row) {
    var pt = row.partner_id ? findBy_('users', 'id', row.partner_id) : null;
    if (!pt || pt.role !== 'partner') throw new Error('Choose a partner');
    row.partner_name = pt.full_name || pt.username;
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
    if (table === 'cash') checkCash_(id ? merge_(findBy_('cash', 'id', id) || {}, row) : row);
    if (table === 'car_shares') checkShare_(id ? merge_(findBy_('car_shares', 'id', id) || {}, row) : row, id);
    if (table === 'partner_ledger' && !(Number(id ? merge_(findBy_('partner_ledger', 'id', id) || {}, row).amount : row.amount) > 0)) throw new Error('Amount must be more than 0');
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
      if (['incomes', 'expenses', 'payroll', 'cash', 'partner_ledger'].indexOf(table) >= 0) row.created_by = me.id;
      checkRequired_(table, row);
      saved = insertRow_(table, decorate_(row));
    }
  } else {
    // Drivers: only add new expenses and daily logs for the car they drive today
    if (me.role !== 'driver') throw new Error('Not allowed');
    if (table === 'car_documents') return saveOwnDoc_(me, id, row);
    if (table !== 'expenses' && table !== 'daily_logs') throw new Error('Not allowed');
    if (id) return updateOwnEntry_(me, table, id, row);
    row.driver_id = me.id;
    delete row.waived; // only the admin can waive a fine
    if (table === 'expenses') {
      row.status = 'pending';
      row.created_by = me.id;
      // not chosen: use the company cash the driver holds, otherwise his own pocket
      if (!row.paid_by) row.paid_by = cashBalance_(me.id) > 0 ? 'cash' : 'driver';
    }
    checkRequired_(table, row);
    if (!drivesNow_(me, row.car_id)) throw new Error('You are not assigned to this car today');
    saved = insertRow_(table, decorate_(row));
  }

  bumpOdometer_(table, saved);
  return saved;
}

/** Salary account rules, so the driver's balance is always right. */
/** A driver adds / updates his own documents (Iqama, license…). He can never delete them. */
function saveOwnDoc_(me, id, row) {
  delete row.car_id;
  row.driver_id = me.id;
  if (id) {
    var old = findBy_('car_documents', 'id', id);
    if (!old || old.driver_id !== me.id || old.car_id || old.archived) throw new Error('Not allowed');
    Object.keys(row).forEach(function (k) {
      var filled = old[k] !== null && old[k] !== undefined && old[k] !== '';
      if (row[k] === null && filled) row[k] = old[k]; // update only: filled fields are never cleared
    });
    var merged = merge_(old, row);
    checkRequired_('car_documents', merged);
    return updateRow_('car_documents', id, decorate_(merged));
  }
  checkRequired_('car_documents', row);
  return insertRow_('car_documents', decorate_(row));
}

/** A driver changes his own entry while it is still open: an expense waiting for approval, or today's daily report. */
function updateOwnEntry_(me, table, id, row) {
  var old = findBy_(table, 'id', id);
  if (!old || old.driver_id !== me.id || old.archived) throw new Error('Not allowed');
  if (table === 'expenses' && old.status !== 'pending') throw new Error('This expense is already checked by the admin — ask the admin to change it');
  if (table === 'daily_logs' && old.log_date !== today_()) throw new Error('Only today\'s report can be changed');
  delete row.driver_id;
  delete row.status;
  delete row.waived;
  var merged = merge_(old, row);
  checkRequired_(table, merged);
  if (merged.car_id !== old.car_id && !drivesNow_(me, merged.car_id)) throw new Error('You are not assigned to this car today');
  var saved = updateRow_(table, id, decorate_(merged));
  bumpOdometer_(table, saved);
  return saved;
}

function checkCash_(row) {
  if (!(Number(row.amount) > 0)) throw new Error('Amount must be more than 0');
  var drv = findBy_('users', 'id', row.driver_id);
  if (!drv || drv.role !== 'driver') throw new Error('Choose a driver');
}

/** Shares of one car may not add up to more than 100% at the same time. */
function checkShare_(row, id) {
  var pct = Number(row.share_percent);
  if (!(pct > 0 && pct <= 100)) throw new Error('Share must be between 0 and 100%');
  var fee = Number(row.fee_percent || 0);
  if (fee < 0 || fee > 100) throw new Error('Management fee must be between 0 and 100%');
  if (row.end_date && row.end_date < row.start_date) throw new Error('End date is before start date');
  var overlap = function (a, b) { return a.start_date <= (b.end_date || '9999') && b.start_date <= (a.end_date || '9999'); };
  var total = pct;
  readTable_('car_shares').forEach(function (x) {
    if (x.archived || x.id === id || x.car_id !== row.car_id || !overlap(x, row)) return;
    if (x.partner_id === row.partner_id) throw new Error('This partner already has a share in this car for these dates');
    total += Number(x.share_percent);
  });
  if (total > 100.0001) throw new Error('Shares of this car add up to ' + (Math.round(total * 100) / 100) + '% (max 100%)');
}

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
    throw new Error('You cannot delete. You can change (update) your entry instead.');
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
  if (table === 'car_shares') checkShare_(row, id);
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
    // Everyone fills in their own profile: update only, nothing can be removed
    var mine = findBy_('users', 'id', me.id);
    var own = {};
    SELF_FIELDS.forEach(function (k) {
      if (!(k in row)) return;
      var filled = mine[k] !== null && mine[k] !== undefined && mine[k] !== '';
      if (row[k] === null && filled) throw new Error(k.replace(/_/g, ' ') + ' cannot be removed — you can only change it');
      own[k] = row[k];
    });
    if (own.iban) own.iban = String(own.iban).replace(/\s+/g, '').toUpperCase();
    own.profile_updated_at = new Date().toISOString();
    row = own;
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
    if (!can_(me, 'salary', 'edit')) {
      delete row.monthly_salary;
      SALARY_PARTS.forEach(function (k) { delete row[k]; });
    }
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
    var total = salaryTotal_(merged);
    if (total !== null) merged.monthly_salary = total;
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
    var total0 = salaryTotal_(row);
    if (total0 !== null) row.monthly_salary = total0;
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
  if (forWrite === 'remove') throw new Error('Files cannot be removed — upload a new one to replace it');
  if (table === 'car_documents') {
    var ownDoc = row.driver_id === me.id && !row.car_id && !row.archived;
    if (forWrite && !ownDoc) throw new Error('Only an admin can change this document');
    if (!canSeeDoc_(me, row)) throw new Error('Not allowed');
    return row;
  }
  // expenses: the driver who entered it can attach / replace / view the receipt
  if (row.driver_id !== me.id || row.archived) throw new Error('Not allowed');
  if (forWrite && row.status !== 'pending') throw new Error('Only the admin can change the receipt after approval');
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


// ---------------------------------------------------------------- daily WhatsApp report
//
// Uses the official WhatsApp Business Cloud API (Meta). The admin enters, in the app (Settings):
//   access token, phone-number ID, the WhatsApp numbers to send to, the hour, what to include,
//   PDF or picture, and (optional) an approved message template.
// A daily time trigger runs dailyWhatsAppReport() at that hour.

var WA_SECTIONS = ['summary', 'logs', 'expenses', 'income', 'pending', 'nolog', 'docs', 'cash', 'salary'];
var WA_KEYS = ['WA_ENABLED', 'WA_TOKEN', 'WA_PHONE_ID', 'WA_TO', 'WA_HOUR', 'WA_SECTIONS', 'WA_FORMAT', 'WA_TEMPLATE', 'WA_LANG', 'WA_VERSION', 'WA_DAY', 'WA_COMPANY'];

function waSettings_() {
  var p = PropertiesService.getScriptProperties();
  var get = function (k, d) { var v = p.getProperty(k); return v === null || v === undefined || v === '' ? d : v; };
  return {
    enabled: get('WA_ENABLED', 'false') === 'true',
    hasToken: !!get('WA_TOKEN', ''),
    phoneId: get('WA_PHONE_ID', ''),
    to: get('WA_TO', ''),
    hour: Number(get('WA_HOUR', '21')),
    sections: get('WA_SECTIONS', 'summary,logs,expenses,income,pending,nolog').split(',').filter(String),
    format: get('WA_FORMAT', 'pdf'),
    template: get('WA_TEMPLATE', ''),
    lang: get('WA_LANG', 'en'),
    version: get('WA_VERSION', 'v21.0'),
    day: get('WA_DAY', 'today'),
    company: get('WA_COMPANY', 'MAC CAR'),
    last: JSON.parse(get('WA_LAST', 'null')),
  };
}

function saveWaSettings_(st) {
  var p = PropertiesService.getScriptProperties();
  var hour = Math.max(0, Math.min(23, Math.floor(Number(st.hour))));
  if (isNaN(hour)) hour = 21;
  var to = String(st.to || '').split(/[,;\n]+/).map(function (n) {
    var d = n.replace(/[^\d]/g, '').replace(/^00/, '');
    if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1); // Saudi mobile written locally
    return d;
  }).filter(function (n) { return n.length >= 8; });
  var sections = (st.sections || []).filter(function (x) { return WA_SECTIONS.indexOf(x) >= 0; });
  if (st.enabled && !to.length) throw new Error('Add at least one WhatsApp number (with country code, e.g. 9665XXXXXXXX)');
  if (st.enabled && !sections.length) throw new Error('Choose at least one thing to include');
  p.setProperty('WA_ENABLED', st.enabled ? 'true' : 'false');
  if (st.token) p.setProperty('WA_TOKEN', String(st.token).trim()); // kept if left empty
  p.setProperty('WA_PHONE_ID', String(st.phoneId || '').trim());
  p.setProperty('WA_TO', to.join(','));
  p.setProperty('WA_HOUR', String(hour));
  p.setProperty('WA_SECTIONS', sections.join(','));
  p.setProperty('WA_FORMAT', st.format === 'image' ? 'image' : 'pdf');
  p.setProperty('WA_TEMPLATE', String(st.template || '').trim());
  p.setProperty('WA_LANG', String(st.lang || 'en').trim());
  p.setProperty('WA_VERSION', String(st.version || 'v21.0').trim());
  p.setProperty('WA_DAY', st.day === 'yesterday' ? 'yesterday' : 'today');
  p.setProperty('WA_COMPANY', String(st.company || 'MAC CAR').trim());
  if (st.enabled && (!p.getProperty('WA_TOKEN') || !p.getProperty('WA_PHONE_ID'))) throw new Error('Enter the access token and phone-number ID');
  installWaTrigger_(st.enabled, hour);
  return waSettings_();
}

function installWaTrigger_(on, hour) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyWhatsAppReport') ScriptApp.deleteTrigger(t);
  });
  if (on) {
    ScriptApp.newTrigger('dailyWhatsAppReport').timeBased().atHour(hour).everyDays(1).inTimezone(Session.getScriptTimeZone()).create();
  }
}

/** Runs every day from the time trigger. */
function dailyWhatsAppReport() {
  var st = waSettings_();
  if (!st.enabled) return;
  sendDailyReport_(null, false);
}

function shiftDay_(day, n) {
  var d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function esc_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sar_(n) {
  var v = Math.round(Number(n || 0) * 100) / 100;
  var parts = Math.abs(v).toFixed(2).replace(/\.00$/, '').split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + 'SAR ' + parts.join('.');
}

function sumC_(rows, k) {
  return rows.reduce(function (c, r) { return c + Math.round(Number(r[k] || 0) * 100); }, 0) / 100;
}

/** Collects the numbers for one day. Returns { day, title, summary (text), html, rows (for picture) }. */
function buildDailyReport_(day, sections) {
  var live = function (r) { return !r.archived; };
  var cars = readTable_('cars').filter(live);
  var users = readTable_('users');
  var name = function (id) { var u = users.filter(function (x) { return x.id === id; })[0]; return u ? u.full_name || u.username : ''; };
  var plate = function (id) { var c = cars.filter(function (x) { return x.id === id; })[0]; return c ? c.plate_no : ''; };
  var logs = readTable_('daily_logs').filter(function (l) { return live(l) && l.log_date === day; });
  var exps = readTable_('expenses').filter(function (e) { return live(e) && e.expense_date === day && e.status !== 'rejected'; });
  var incs = readTable_('incomes').filter(function (i) { return live(i) && i.income_date === day; });
  var pending = readTable_('expenses').filter(function (e) { return live(e) && e.status === 'pending'; });
  var asg = readTable_('assignments').filter(function (a) { return live(a) && activeOn_(a, day); });
  var has = function (k) { return sections.indexOf(k) >= 0; };
  var company = waSettings_().company;
  var km = logs.reduce(function (c, l) { return c + (l.end_odometer != null && l.start_odometer != null ? Math.max(0, l.end_odometer - l.start_odometer) : 0); }, 0);
  var lines = [];
  var rows = [];
  var html = '<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#1e1b39;font-size:11px}h1{color:#7C5CFC;font-size:20px;margin:0}' +
    'h2{font-size:13px;margin:16px 0 6px;color:#5B4BB7}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e3defc;padding:5px;text-align:left}' +
    'th{background:#f2f0ff}.n{text-align:right}.k{display:inline-block;margin:4px 10px 4px 0;padding:6px 10px;background:#f2f0ff;border-radius:8px}</style></head><body>';
  html += '<h1>' + esc_(company) + ' · Daily report</h1><div>' + esc_(day) + '</div>';
  var table = function (title, head, data) {
    if (!data.length) return '<h2>' + esc_(title) + '</h2><div>None</div>';
    return '<h2>' + esc_(title) + '</h2><table><tr>' + head.map(function (h) { return '<th>' + esc_(h) + '</th>'; }).join('') + '</tr>' +
      data.map(function (r) { return '<tr>' + r.map(function (v, i) { return '<td' + (typeof v === 'number' || /^(-)?SAR /.test(v) ? ' class="n"' : '') + '>' + esc_(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  };
  if (has('summary')) {
    var tIn = sumC_(incs, 'amount');
    var tOut = sumC_(exps, 'amount');
    lines.push('Income ' + sar_(tIn) + ' · Expenses ' + sar_(tOut) + ' · Reports ' + logs.length + '/' + asg.length + ' · ' + km + ' km');
    html += '<h2>Summary</h2><span class="k">Income <b>' + sar_(tIn) + '</b></span><span class="k">Expenses <b>' + sar_(tOut) + '</b></span>' +
      '<span class="k">Daily reports <b>' + logs.length + ' of ' + asg.length + '</b></span><span class="k">Km <b>' + km + '</b></span>' +
      '<span class="k">Cash collected <b>' + sar_(sumC_(logs, 'cash_collected')) + '</b></span>';
    rows.push(['Income', sar_(tIn)], ['Expenses', sar_(tOut)], ['Daily reports', logs.length + ' of ' + asg.length], ['Km driven', String(km)]);
  }
  if (has('logs')) {
    html += table('Daily reports', ['Car', 'Driver', 'Km', 'Trips', 'Cash', 'Work'], logs.map(function (l) {
      return [plate(l.car_id), name(l.driver_id), l.end_odometer != null && l.start_odometer != null ? Math.max(0, l.end_odometer - l.start_odometer) : '', l.trips || '', sar_(l.cash_collected), l.work_details || ''];
    }));
    logs.forEach(function (l) { rows.push([plate(l.car_id) + ' · ' + name(l.driver_id), (l.trips || 0) + ' trips · ' + sar_(l.cash_collected)]); });
  }
  if (has('nolog')) {
    var done = {};
    logs.forEach(function (l) { done[l.car_id] = true; });
    var miss = asg.filter(function (a) { return !done[a.car_id]; });
    if (miss.length) lines.push('No report: ' + miss.map(function (a) { return plate(a.car_id); }).join(', '));
    html += table('Cars without a daily report', ['Car', 'Driver'], miss.map(function (a) { return [plate(a.car_id), name(a.driver_id)]; }));
    miss.forEach(function (a) { rows.push(['No report: ' + plate(a.car_id), name(a.driver_id)]); });
  }
  if (has('expenses')) {
    html += table('Expenses', ['Car', 'Category', 'Driver', 'Paid by', 'Status', 'Amount'], exps.map(function (e) {
      return [plate(e.car_id), e.category, name(e.driver_id), e.paid_by === 'cash' ? 'company cash' : e.paid_by, e.status, sar_(e.amount)];
    }));
    exps.forEach(function (e) { rows.push(['Expense · ' + plate(e.car_id) + ' · ' + e.category, sar_(e.amount)]); });
  }
  if (has('income')) {
    html += table('Income', ['Car', 'Customer', 'Payment', 'Amount'], incs.map(function (i) { return [plate(i.car_id), i.customer_name || '', i.payment_status, sar_(i.amount)]; }));
    incs.forEach(function (i) { rows.push(['Income · ' + plate(i.car_id), sar_(i.amount)]); });
  }
  if (has('pending')) {
    if (pending.length) lines.push(pending.length + ' entries waiting for approval');
    html += table('Waiting for approval', ['Date', 'Car', 'Driver', 'Category', 'Amount'], pending.map(function (e) {
      return [e.expense_date, plate(e.car_id), name(e.driver_id), e.category, sar_(e.amount)];
    }));
    if (pending.length) rows.push(['Waiting for approval', String(pending.length)]);
  }
  if (has('docs')) {
    var lim = shiftDay_(day, 30);
    var docs = readTable_('car_documents').filter(function (d) { return live(d) && d.expiry_date && d.expiry_date <= lim; });
    html += table('Documents expiring in 30 days', ['Document', 'Car / driver', 'Expiry'], docs.map(function (d) {
      return [d.doc_type, d.car_id ? plate(d.car_id) : name(d.driver_id), d.expiry_date];
    }));
    if (docs.length) rows.push(['Documents expiring (30 days)', String(docs.length)]);
  }
  if (has('cash')) {
    var drivers = users.filter(function (u) { return u.role === 'driver' && u.active; });
    var bal = drivers.map(function (u) { return [u.full_name || u.username, cashBalance_(u.id)]; }).filter(function (x) { return x[1] !== 0; });
    html += table('Company cash with drivers', ['Driver', 'Balance'], bal.map(function (x) { return [x[0], sar_(x[1])]; }));
    bal.forEach(function (x) { rows.push(['Cash with ' + x[0], sar_(x[1])]); });
  }
  if (has('salary')) {
    var month = day.slice(0, 7);
    var paidMonth = {};
    readTable_('payroll').forEach(function (x) { if (!x.archived && x.type === 'salary' && x.month === month) paidMonth[x.driver_id] = true; });
    var notAdded = users.filter(function (u) { return u.role === 'driver' && u.active && Number(u.monthly_salary) > 0 && !paidMonth[u.id]; });
    if (Number(day.slice(8)) >= 25 && notAdded.length) lines.push(notAdded.length + ' salaries not added for ' + month);
    html += table('Salary not added for ' + month, ['Driver', 'Monthly salary'], notAdded.map(function (u) { return [u.full_name || u.username, sar_(u.monthly_salary)]; }));
  }
  html += '<p style="color:#888;margin-top:18px">Sent automatically by MAC CAR</p></body></html>';
  return { day: day, title: company + ' daily report ' + day, summary: lines.join('\n') || 'Daily report', html: html, rows: rows };
}

/** Picture of the report (a table image). Falls back to PDF when the picture cannot be made. */
function reportImage_(rep) {
  var dt = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, rep.title).addColumn(Charts.ColumnType.STRING, '');
  (rep.rows.length ? rep.rows : [['No data', '']]).forEach(function (r) { dt.addRow([String(r[0]), String(r[1])]); });
  var chart = Charts.newTableChart().setDataTable(dt.build()).setDimensions(800, Math.min(2400, 60 + 32 * Math.max(1, rep.rows.length))).build();
  return chart.getAs('image/png').setName('report-' + rep.day + '.png');
}

function waApi_(st, path, options) {
  var url = 'https://graph.facebook.com/' + st.version + '/' + path;
  options.muteHttpExceptions = true;
  options.headers = { Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('WA_TOKEN') };
  var res = UrlFetchApp.fetch(url, options);
  var body = {};
  try { body = JSON.parse(res.getContentText() || '{}'); } catch (e) { body = { raw: res.getContentText() }; }
  if (res.getResponseCode() >= 300 || body.error) throw new Error('WhatsApp: ' + ((body.error && body.error.message) || res.getResponseCode()));
  return body;
}

/** Builds the report and sends it to every number. `manual` = "Send now" from the app (works even when switched off). */
function sendDailyReport_(day, manual) {
  var st = waSettings_();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WA_TOKEN') || !st.phoneId) throw new Error('WhatsApp is not set up yet (token and phone-number ID)');
  var to = st.to.split(',').filter(String);
  if (!to.length) throw new Error('No WhatsApp number to send to');
  var today = today_();
  day = day || (st.day === 'yesterday' ? shiftDay_(today, -1) : today);
  var rep = buildDailyReport_(day, st.sections);

  var blob;
  var format = st.format;
  var note = '';
  if (format === 'image') {
    try {
      blob = reportImage_(rep);
    } catch (e) {
      format = 'pdf';
      note = ' (picture failed, sent PDF: ' + e.message + ')';
    }
  }
  if (format === 'pdf') blob = Utilities.newBlob(rep.html, 'text/html', 'report.html').getAs('application/pdf').setName('MAC-CAR-report-' + day + '.pdf');

  var media = waApi_(st, st.phoneId + '/media', {
    method: 'post',
    payload: { messaging_product: 'whatsapp', type: blob.getContentType(), file: blob },
  });
  var results = to.map(function (n) {
    try {
      var msg;
      var mediaPart = format === 'image' ? { id: media.id } : { id: media.id, filename: blob.getName() };
      if (st.template) {
        msg = {
          messaging_product: 'whatsapp', to: n, type: 'template',
          template: {
            name: st.template, language: { code: st.lang },
            components: [
              { type: 'header', parameters: [format === 'image' ? { type: 'image', image: mediaPart } : { type: 'document', document: mediaPart }] },
              { type: 'body', parameters: [{ type: 'text', text: rep.summary.replace(/\n/g, ' · ').slice(0, 1000) }] },
            ],
          },
        };
      } else {
        var caption = rep.title + '\n' + rep.summary;
        msg = format === 'image'
          ? { messaging_product: 'whatsapp', to: n, type: 'image', image: { id: media.id, caption: caption } }
          : { messaging_product: 'whatsapp', to: n, type: 'document', document: { id: media.id, filename: blob.getName(), caption: caption } };
      }
      waApi_(st, st.phoneId + '/messages', { method: 'post', contentType: 'application/json', payload: JSON.stringify(msg) });
      return { to: n, ok: true };
    } catch (e) {
      return { to: n, ok: false, error: e.message };
    }
  });
  var last = { at: new Date().toISOString(), day: day, manual: !!manual, format: format, note: note, results: results };
  props.setProperty('WA_LAST', JSON.stringify(last));
  return last;
}
