// PostgreSQL. Параметры берутся из .env (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
const { Pool } = require('pg');
const pool = new Pool();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','company')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT, age INTEGER, education TEXT, university TEXT,
  specialty TEXT, work_history TEXT, desired_experience TEXT
);
CREATE TABLE IF NOT EXISTS companies (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, industry TEXT, city TEXT, website TEXT, description TEXT
);
CREATE TABLE IF NOT EXISTS vacancies (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  company_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vacancy_id INTEGER REFERENCES vacancies(id) ON DELETE CASCADE,
  direction TEXT CHECK (direction IN ('student_to_company','company_to_student')),
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, link TEXT, is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  admin_2fa_verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS admin_2fa_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE sessions SET expires_at = created_at + interval '7 days' WHERE expires_at IS NULL;
ALTER TABLE sessions ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');
ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL;
CREATE TABLE IF NOT EXISTS email_codes (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vacancy_id INTEGER REFERENCES vacancies(id) ON DELETE CASCADE, PRIMARY KEY (user_id, vacancy_id)
);
CREATE TABLE IF NOT EXISTS support_threads (
  id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open', updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY, thread_id INTEGER REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE, is_staff BOOLEAN DEFAULT false,
  text TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS workplace_photo_mime TEXT;
ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS workplace_photo BYTEA;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio TEXT;
CREATE TABLE IF NOT EXISTS student_avatars (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, content BYTEA NOT NULL
);
ALTER TABLE student_avatars ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS student_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, content BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_student_documents_user ON student_documents(user_id);
CREATE TABLE IF NOT EXISTS enrollment_verifications (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL,
  name TEXT NOT NULL,
  content BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_letter TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_letter_in_chat BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS hidden_chat_messages (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, message_id)
);
WITH legacy AS (
  SELECT m.id, NULLIF(btrim(a.cover_letter), '') AS letter
  FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
  JOIN LATERAL (SELECT * FROM messages WHERE application_id = a.id ORDER BY id LIMIT 1) m ON true
  WHERE a.direction = 'student_to_company' AND m.sender_id = a.user_id
    AND NOT a.cover_letter_in_chat
    AND m.created_at BETWEEN a.created_at AND a.created_at + interval '1 minute'
    AND left(m.text, length('Здравствуйте! Меня заинтересовала вакансия «')) = 'Здравствуйте! Меня заинтересовала вакансия «'
    AND right(m.text, length('». Буду рад(а) обсудить детали и познакомиться с командой.')) = '». Буду рад(а) обсудить детали и познакомиться с командой.'
), removed AS (
  DELETE FROM messages m USING legacy l WHERE m.id = l.id AND l.letter IS NULL
)
UPDATE messages m SET text = l.letter FROM legacy l WHERE m.id = l.id AND l.letter IS NOT NULL AND m.text <> l.letter;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','company','admin'));
CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY, application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL, format TEXT DEFAULT 'online', place TEXT, note TEXT,
  status TEXT DEFAULT 'proposed', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iv_app ON interviews(application_id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to INTEGER;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS reply_to INTEGER;
CREATE TABLE IF NOT EXISTS chat_state (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, ref_id INTEGER NOT NULL,
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, kind, ref_id)
);
WITH existing_letters AS (
  UPDATE applications a SET cover_letter_in_chat = true
  WHERE a.direction = 'student_to_company' AND NOT a.cover_letter_in_chat
  RETURNING a.id, a.user_id, a.vacancy_id, a.cover_letter, a.created_at
)
INSERT INTO messages (application_id, sender_id, text, created_at)
SELECT a.id, a.user_id, a.cover_letter, a.created_at
FROM existing_letters a JOIN vacancies v ON v.id = a.vacancy_id
WHERE v.company_id IS NOT NULL AND NULLIF(btrim(a.cover_letter), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM chat_state cs WHERE cs.kind = 'app' AND cs.ref_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.application_id = a.id AND m.sender_id = a.user_id AND m.text = a.cover_letter);
CREATE INDEX IF NOT EXISTS idx_support_msgs ON support_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_apps_vacancy ON applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_msgs_app ON messages(application_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL CHECK (hits > 0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS user_activity_daily (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_date ON user_activity_daily(activity_date);
`;

const query = (text, params) => pool.query(text, params).then(r => r.rows);
const one = (text, params) => query(text, params).then(r => r[0]);

async function init() {
    await pool.query(SCHEMA);
    // email_verified: у уже существующих пользователей считаем почту подтверждённой
    if (!(await one(`SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified'`))) {
        await pool.query('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT true; ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;');
    }
    // approved: ранее созданные компании считаем одобренными, новые — на проверке
    if (!(await one(`SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'approved'`))) {
        await pool.query('ALTER TABLE companies ADD COLUMN approved BOOLEAN DEFAULT true; ALTER TABLE companies ALTER COLUMN approved SET DEFAULT false;');
    }
    if (!(await one('SELECT 1 FROM vacancies LIMIT 1'))) {
        await pool.query(`INSERT INTO vacancies (company, title, description) VALUES
      ('Демо-партнёр','Стажёр-маркетолог','Помощь в ведении соцсетей и подготовке контента. Обучение на месте.'),
      ('Демо-партнёр','Junior-аналитик данных','Сбор и визуализация данных, отчёты для команды. Гибкий график.')`);
    }
}
module.exports = { pool, query, one, init };
