const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { query, one, init } = require('./database');
const { mailConfigured, sendMail } = require('./mailer');
const { codeEmail } = require('./mail-template');
const { prepare, score } = require('./match');
const { directionOptions, categoriesFor, directionLinks } = require('./directions');

const app = express();
const PUBLIC = path.join(__dirname, '..', 'public');
const layout = Object.fromEntries(['header', 'footer', 'styles', 'scripts'].map(part => [
    part, fs.readFileSync(path.join(__dirname, 'layout', part + '.html'), 'utf8').trimEnd()
]));
app.use(express.json({ limit: '7mb' }));

const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ================= SEO, заголовки, кэш =================
const SITE = (process.env.SITE_URL || 'https://project.wn-7.ru').replace(/\/+$/, '');
const PUBLIC_PAGES = new Set(['index.html', 'about.html', 'directions.html', 'faq.html', 'partners.html', 'vacancies.html', 'help.html', 'vacancy.html', 'company-profile.html']); // всё остальное закрыто от индексации
app.disable('x-powered-by');
let compression = null;
try { compression = require('compression'); } catch { console.warn('Пакет compression не установлен — выполните npm install'); }
if (compression) app.use(compression());
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use('/api', (req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex'); next(); });

let statsCache = { at: 0, v: null };
const stats = async () => {
    if (!statsCache.v || Date.now() - statsCache.at > 60000) statsCache = {
        at: Date.now(), v: await one(`SELECT
    (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students, (SELECT COUNT(*)::int FROM companies c JOIN users u ON u.id = c.user_id WHERE c.approved AND NOT COALESCE(u.is_blocked, false) AND u.role = 'company') AS companies,
    (SELECT COUNT(*)::int FROM vacancies WHERE is_active) AS vacancies, (SELECT COUNT(*)::int FROM applications) AS applications`)
    };
    return statsCache.v;
};
// страница с подстановкой адреса сайта; на главной — реальные цифры прямо в HTML (их видят и роботы)
const render = async name => {
    const home = name === 'index.html';
    const parts = {
        ...layout,
        resource_nav: '<nav class="wrap home-resources" aria-label="Разделы платформы">' +
            [['index.html', 'На главную'], ['about.html', 'Как это работает'], ['directions.html', 'Направления стажировок'], ['faq.html', 'Частые вопросы']]
                .filter(([file]) => file !== name)
                .map(([file, label]) => `<a class="btn" href="${file === 'index.html' ? '/' : '/pages/' + file}">${label}</a>`).join('') + '</nav>',
        header: layout.header.replace('{{LOGO_URL}}', home ? '#top' : '/')
            .replace('{{PRIMARY_LOGIN}}', home ? '' : ' primary')
            .replace('{{REGISTER}}', home ? '<a id="reg-btn" href="/pages/register.html" class="btn primary sm">Регистрация</a>' : '')
    };
    let html = fs.readFileSync(path.join(PUBLIC, 'pages', name), 'utf8')
        .replace(/\{\{(header|footer|styles|scripts|resource_nav)\}\}/g, (_, part) => parts[part])
        .replace('{{FILTER_DIRECTIONS}}', () => directionOptions(true))
        .replace('{{DIRECTION_LINKS}}', directionLinks)
        .replace('{{VACANCY_DIRECTIONS}}', () => directionOptions(false))
        .replace(/\{\{SITE_URL\}\}/g, () => SITE);
    if (name === 'index.html') {
        let st = null; try { st = await stats(); } catch { }
        if (st) for (const [k, v] of Object.entries(st)) html = html.replace(new RegExp(`(id="n-${k}" data-count=")0(">)0(<)`), `$1${v}$2${v}$3`);
    }
    return html;
};
app.get('/pages/index.html', (req, res) => res.redirect(301, '/'));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
    const urls = [['/', 'index.html'], ...['partners', 'vacancies', 'help', 'about', 'directions', 'faq'].map(name => ['/pages/' + name + '.html', name + '.html'])];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(([u, f]) => `  <url><loc>${SITE}${u}</loc><lastmod>${fs.statSync(path.join(PUBLIC, 'pages', f)).mtime.toISOString().slice(0, 10)}</lastmod></url>`).join('\n') + '\n</urlset>\n');
});
app.get(['/', '/pages/:name'], h(async (req, res, next) => {
    const name = req.params.name ? path.basename(req.params.name) : 'index.html';
    if (!name.endsWith('.html') || !fs.existsSync(path.join(PUBLIC, 'pages', name))) return next();
    if (!PUBLIC_PAGES.has(name)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(await render(name));
}));
app.use(express.static(PUBLIC, {
    setHeaders: (res, p) => {
        if (/\.(css|js)$/.test(p)) res.setHeader('Cache-Control', 'public, max-age=300');
        else if (/\.(png|jpe?g|svg|ico|webp|woff2?)$/.test(p)) res.setHeader('Cache-Control', 'public, max-age=86400');
    }
}));
const num = v => Number(v) || 0;
const clean = (v, max = 500) => { const t = String(v ?? '').trim().slice(0, max); return t === '' ? null : t; };
const notify = (uid, text, link) => query('INSERT INTO notifications (user_id, text, link) VALUES ($1,$2,$3)', [uid, text, link || null]);
const nameOf = async uid => (await one('SELECT full_name FROM profiles WHERE user_id = $1', [uid]))?.full_name || 'Студент';
const makeSession = async uid => {
    const token = crypto.randomBytes(32).toString('hex');
    await query('INSERT INTO sessions (token, user_id) VALUES ($1,$2)', [token, uid]);
    return token;
};

// ----- простое ограничение частоты запросов (в памяти) -----
const hits = new Map();
const limit = (key, max, ms) => {
    const now = Date.now(), r = (hits.get(key) || []).filter(t => now - t < ms);
    if (r.length >= max) return false;
    r.push(now); hits.set(key, r); return true;
};
const tooMany = res => res.status(429).json({ error: 'Слишком много попыток. Подождите немного' });

// ----- коды подтверждения (хранится только хэш, срок 10 минут, 5 попыток) -----
const hashCode = (uid, code) => crypto.createHash('sha256').update(`${uid}:${code}:${process.env.CODE_SALT || 'salt'}`).digest('hex');
async function issueCode(uid, purpose, email) {
    if (!mailConfigured) return false;
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const { id } = await one(`INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
        VALUES ($1,$2,$3, now() + interval '10 minutes') RETURNING id`, [uid, purpose, hashCode(uid, code)]);
    const mail = codeEmail({ code, purpose: purpose === 'verify' ? 'verify' : 'reset', minutes: 10 });
    const sent = await sendMail(email, purpose === 'verify' ? 'Код подтверждения — Первый шаг' : 'Сброс пароля — Первый шаг', mail.text, mail.html);
    if (sent) await query('DELETE FROM email_codes WHERE user_id = $1 AND purpose = $2 AND id < $3', [uid, purpose, id]);
    else await query('DELETE FROM email_codes WHERE id = $1', [id]);
    return sent;
}
const mailUnavailable = res => res.status(503).json({ error: mailConfigured
    ? 'Не удалось отправить письмо. Попробуйте позже'
    : 'Почтовая отправка не настроена. Обратитесь к администратору' });
async function checkCode(uid, purpose, code) {
    const r = await one('SELECT * FROM email_codes WHERE user_id = $1 AND purpose = $2 ORDER BY id DESC LIMIT 1', [uid, purpose]);
    if (!r || new Date(r.expires_at) < new Date()) return 'Код истёк. Запросите новый';
    if (r.attempts >= 5) return 'Слишком много попыток. Запросите новый код';
    if (r.code_hash !== hashCode(uid, String(code || '').trim())) { await query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1', [r.id]); return 'Неверный код'; }
    const used = await one('DELETE FROM email_codes WHERE id = $1 AND attempts < 5 AND expires_at > now() RETURNING id', [r.id]);
    return used ? null : 'Код больше недействителен. Запросите новый';
}

// ----- авторизация -----
const auth = h(async (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const s = await one('SELECT s.user_id, u.role, u.email_verified, u.is_blocked, c.approved FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN companies c ON c.user_id = u.id WHERE s.token = $1', [token]);
    if (!s) return res.status(401).json({ error: 'Требуется вход' });
    if (s.is_blocked) return res.status(401).json({ error: 'Аккаунт заблокирован администратором' });
    Object.assign(req, { uid: s.user_id, role: s.role, token, verified: s.email_verified || s.role === 'admin', approved: s.role !== 'company' || !!s.approved });
    next();
});
const need = role => (req, res, next) => req.role === role ? next() : res.status(403).json({ error: 'Недоступно для вашего типа аккаунта' });
const verified = (req, res, next) => req.verified ? next() : res.status(403).json({ error: 'Подтвердите email, чтобы продолжить', code: 'unverified' });
const approved = (req, res, next) => req.approved ? next() : res.status(403).json({ error: 'Аккаунт компании проверяется администратором. Оставьте заявку в чате поддержки', code: 'unapproved' });
const student = [auth, need('student')], company = [auth, need('company')], admin = [auth, need('admin')];
const profileMedia = [auth, (req, res, next) => {
    if (req.role === 'student' || req.role === 'company') return next();
    res.status(403).json({ error: 'Недоступно для вашего типа аккаунта' });
}];

// ---------- публичное ----------
app.get('/api/public/stats', h(async (req, res) => res.json(await stats())));

// Публичный каталог: только опубликованные вакансии, без персональных данных.
app.get('/api/public/vacancies', h(async (req, res) => {
    const w = ['v.is_active'], p = [];
    const { q: text, format, category, paid } = req.query;
    if (text) {
        p.push('%' + String(text).toLowerCase().slice(0, 60) + '%');
        w.push(`(lower(v.title) LIKE $${p.length} OR lower(v.company) LIKE $${p.length} OR lower(COALESCE(v.description,'')) LIKE $${p.length} OR lower(COALESCE(v.city,'')) LIKE $${p.length})`);
    }
    if (format) { p.push(String(format)); w.push(`v.format = $${p.length}`); }
    if (category) { p.push(categoriesFor(String(category))); w.push(`v.category = ANY($${p.length}::text[])`); }
    if (paid === '1') w.push('v.paid');
  const rows = await query(`SELECT v.id, v.company_id, v.company, v.title, v.description, v.city,
    v.format, v.category, v.paid, v.created_at, (v.workplace_photo_mime IS NOT NULL) AS has_workplace_photo FROM vacancies v
    WHERE ${w.join(' AND ')} ORDER BY v.id DESC LIMIT 100`, p);
    res.json(rows);
}));

// Отдельная публичная вакансия: только активная, без данных откликнувшихся.
app.get('/api/public/vacancies/:id', h(async (req, res) => {
    const id = num(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Некорректный номер вакансии' });
  const v = await one(`SELECT id, company_id, company, title, description, city, format, category, paid, is_active, created_at,
    (workplace_photo_mime IS NOT NULL) AS has_workplace_photo
    FROM vacancies WHERE id = $1 AND is_active`, [id]);
    v ? res.json(v) : res.status(404).json({ error: 'Вакансия не найдена или закрыта' });
}));

// Партнёры на главной: только публичные компании и агрегаты, без данных студентов.
app.get('/api/public/companies', h(async (req, res) => {
    const offset = req.query.offset == null ? 0 : Number(req.query.offset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return res.status(400).json({ error: 'Некорректная страница списка' });
    const rows = await query(`WITH vacancy_totals AS (
      SELECT company_id, COUNT(*) FILTER (WHERE is_active)::int AS active_vacancies
      FROM vacancies WHERE company_id IS NOT NULL GROUP BY company_id
    ), response_totals AS (
      SELECT v.company_id, COUNT(*)::int AS responses
      FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
      WHERE a.direction = 'student_to_company' GROUP BY v.company_id
    )
    SELECT c.user_id, c.name, c.industry, c.city,
      COALESCE(r.responses, 0)::int AS responses, COALESCE(v.active_vacancies, 0)::int AS active_vacancies
    FROM companies c JOIN users u ON u.id = c.user_id
    LEFT JOIN response_totals r ON r.company_id = c.user_id LEFT JOIN vacancy_totals v ON v.company_id = c.user_id
    WHERE c.approved AND NOT COALESCE(u.is_blocked, false) AND u.role = 'company'
    ORDER BY lower(c.name), c.user_id LIMIT 7 OFFSET $1`, [offset]);
    res.json({ items: rows.slice(0, 6), nextOffset: rows.length > 6 ? offset + 6 : null });
}));

// Профиль компании публичный только после проверки; контакты аккаунта не выдаются.
app.get('/api/public/companies/:id', h(async (req, res) => {
    const id = num(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Некорректный номер компании' });
    const c = await one(`SELECT c.user_id, c.name, c.industry, c.city, c.website, c.description
    FROM companies c JOIN users u ON u.id = c.user_id
    WHERE c.user_id = $1 AND c.approved AND NOT u.is_blocked`, [id]);
    if (!c) return res.status(404).json({ error: 'Профиль компании не найден или ещё не опубликован' });
    const vacancies = await query(`SELECT id, company_id, company, title, description, city, format, category, paid, is_active, created_at,
    (workplace_photo_mime IS NOT NULL) AS has_workplace_photo
    FROM vacancies WHERE company_id = $1 AND is_active ORDER BY id DESC LIMIT 100`, [id]);
    res.json({ company: { ...c, avatar: await avatarUrl(c.user_id) }, vacancies });
}));

// ---------- аккаунты ----------
app.post('/api/register', h(async (req, res) => {
    const { email, password, name } = req.body || {};
    const role = req.body?.role === 'company' ? 'company' : 'student';
    if (typeof email !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || typeof password !== 'string' || password.length < 8)
        return res.status(400).json({ error: 'Проверьте email и пароль (от 8 символов)' });
    if (role === 'company' && (name || '').trim().length < 2) return res.status(400).json({ error: 'Укажите название компании' });
    if (!mailConfigured) return mailUnavailable(res);
    if (!limit('reg:' + req.ip, 10, 3600000)) return tooMany(res);
    try {
        const u = await one('INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id', [email.toLowerCase(), bcrypt.hashSync(password, 10), role]);
        if (role === 'company') {
            await query('INSERT INTO companies (user_id, name) VALUES ($1,$2)', [u.id, name.trim()]);
            for (const a of await query(`SELECT id FROM users WHERE role = 'admin'`)) await notify(a.id, `Компания «${name.trim()}» ожидает одобрения`, '/pages/admin.html#users');
        }
        const codeSent = await issueCode(u.id, 'verify', email.toLowerCase());
        if (codeSent) limit('vs:' + u.id, 1, 60000);
        res.json({ token: await makeSession(u.id), role, verified: false, codeSent });
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'Такой email уже зарегистрирован' });
        throw e;
    }
}));
app.post('/api/login', h(async (req, res) => {
    const { email, password } = req.body || {};
    if (!limit(`login:${req.ip}:${email}`, 10, 900000)) return tooMany(res);
    const u = await one('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
    if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.status(401).json({ error: 'Неверный email или пароль' });
    if (u.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован администратором' });
    res.json({ token: await makeSession(u.id), role: u.role, verified: u.email_verified || u.role === 'admin' });
}));
app.post('/api/logout', auth, h(async (req, res) => { await query('DELETE FROM sessions WHERE token = $1', [req.token]); res.json({ ok: true }); }));
async function avatarUrl(userId) {
    const avatar = await one('SELECT updated_at FROM student_avatars WHERE user_id = $1', [userId]);
    return avatar ? `/api/profile/avatar/${userId}?v=${avatar.updated_at.getTime()}` : null;
}
app.get('/api/me', auth, h(async (req, res) => res.json({ id: req.uid, role: req.role, verified: req.verified, approved: req.approved, email: (await one('SELECT email FROM users WHERE id = $1', [req.uid])).email, avatar: await avatarUrl(req.uid) })));

app.post('/api/verify/send', auth, h(async (req, res) => {
    if (req.verified) return res.json({ ok: true, verified: true });
    if (!mailConfigured) return mailUnavailable(res);
    if (!limit('vs:' + req.uid, 1, 60000)) return res.status(429).json({ error: 'Повторно отправить код можно через минуту' });
    const sent = await issueCode(req.uid, 'verify', (await one('SELECT email FROM users WHERE id = $1', [req.uid])).email);
    if (!sent) return mailUnavailable(res);
    res.json({ ok: true });
}));
app.post('/api/verify/confirm', auth, h(async (req, res) => {
    if (!limit('vc:' + req.uid, 10, 600000)) return tooMany(res);
    const err = await checkCode(req.uid, 'verify', req.body?.code);
    if (err) return res.status(400).json({ error: err });
    await query('UPDATE users SET email_verified = true WHERE id = $1', [req.uid]);
    await notify(req.uid, 'Email подтверждён — теперь доступны отклики, приглашения и чаты', '/pages/dashboard.html');
    res.json({ ok: true });
}));
app.post('/api/password/forgot', h(async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase();
    if (!mailConfigured) return mailUnavailable(res);
    if (!limit(`fg:${req.ip}:${email}`, 3, 600000)) return tooMany(res);
    const u = await one('SELECT id FROM users WHERE email = $1 AND NOT is_blocked', [email]);
    if (u) await issueCode(u.id, 'reset', email);
    res.json({ ok: true }); // ответ одинаковый для известных и неизвестных адресов
}));
app.post('/api/password/reset', h(async (req, res) => {
    const { email, code, password } = req.body || {};
    if ((password || '').length < 8) return res.status(400).json({ error: 'Пароль — от 8 символов' });
    if (!limit(`rs:${req.ip}`, 10, 600000)) return tooMany(res);
    const u = await one('SELECT id FROM users WHERE email = $1', [String(email || '').toLowerCase()]);
    const err = u ? await checkCode(u.id, 'reset', code) : 'Неверный код';
    if (err) return res.status(400).json({ error: err });
    await query('UPDATE users SET password_hash = $1, email_verified = true WHERE id = $2', [bcrypt.hashSync(password, 10), u.id]);
    await query('DELETE FROM sessions WHERE user_id = $1', [u.id]);
    res.json({ ok: true });
}));
app.post('/api/password/change', auth, h(async (req, res) => {
    const { current, next } = req.body || {};
    const u = await one('SELECT password_hash FROM users WHERE id = $1', [req.uid]);
    if (!bcrypt.compareSync(current || '', u.password_hash)) return res.status(400).json({ error: 'Текущий пароль указан неверно' });
    if ((next || '').length < 8) return res.status(400).json({ error: 'Новый пароль — от 8 символов' });
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(next, 10), req.uid]);
    await query('DELETE FROM sessions WHERE user_id = $1 AND token <> $2', [req.uid, req.token]);
    res.json({ ok: true });
}));

// ---------- уведомления ----------
app.get('/api/notifications', auth, h(async (req, res) => res.json({
    items: await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [req.uid]),
    unread: (await one('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false', [req.uid])).n
})));
app.post('/api/notifications/read', auth, h(async (req, res) => { await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.uid]); res.json({ ok: true }); }));

// ---------- студент ----------
const SF = ['full_name', 'age', 'education', 'university', 'specialty', 'work_history', 'desired_experience', 'city', 'skills', 'about', 'portfolio'];
const dataFile = (value, mime, maxBytes) => {
    const raw = String(value || '');
    const match = raw.match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i);
    if (!match || (mime && match[1] !== mime)) return null;
    const content = Buffer.from(match[2], 'base64');
    return content.length && content.length <= maxBytes ? { mime: match[1].toLowerCase(), content } : null;
};
function pdfFile(body) {
    const file = dataFile(body?.data, 'application/pdf', 5 * 1024 * 1024);
    if (!file || file.content.subarray(0, 5).toString() !== '%PDF-') return null;
    const name = String(body?.name || 'document.pdf').replace(/[^a-z0-9а-яё_. -]/gi, '_').trim().slice(0, 115);
    return { ...file, name: /\.pdf$/i.test(name) ? name : (name || 'document') + '.pdf' };
}
const pdfError = res => res.status(400).json({ error: 'Загрузите корректный PDF-файл до 5 МБ' });
const sendPdf = (res, document) => res.type('application/pdf').set('Cache-Control', 'private, no-store')
    .attachment(document.name).send(document.content);
const profileDocuments = uid => query('SELECT id, name, octet_length(content)::int AS bytes FROM student_documents WHERE user_id = $1 ORDER BY id DESC', [uid]);
app.get('/api/profile', ...student, h(async (req, res) => res.json({
    ...(await one('SELECT * FROM profiles WHERE user_id = $1', [req.uid]) || {}),
    avatar: await avatarUrl(req.uid),
    documents: await profileDocuments(req.uid),
    email: (await one('SELECT email FROM users WHERE id = $1', [req.uid])).email
})));
app.put('/api/profile', ...student, h(async (req, res) => {
    const b = req.body || {};
    const p = SF.map(k => clean(b[k], 1000));
    if (p[1] !== null && !(Number(p[1]) >= 14 && Number(p[1]) <= 100)) return res.status(400).json({ error: 'Укажите корректный возраст' });
    await query(`INSERT INTO profiles (user_id, ${SF.join(',')}) VALUES ($1, ${SF.map((_, i) => '$' + (i + 2)).join(',')})
    ON CONFLICT (user_id) DO UPDATE SET ${SF.map(f => `${f} = EXCLUDED.${f}`).join(',')}`, [req.uid, ...p]);
    res.json({ ok: true });
}));
app.post('/api/profile/avatar', ...profileMedia, h(async (req, res) => {
    const file = dataFile(req.body?.data, req.body?.mime, 600 * 1024);
    if (!file || !/^image\/(png|jpe?g|webp|gif)$/.test(file.mime)) return res.status(400).json({ error: 'Загрузите изображение PNG, JPG, WEBP или GIF до 600 КБ' });
    await query(`INSERT INTO student_avatars (user_id, mime, content) VALUES ($1,$2,$3)
    ON CONFLICT (user_id) DO UPDATE SET mime = EXCLUDED.mime, content = EXCLUDED.content, updated_at = clock_timestamp()`, [req.uid, file.mime, file.content]);
    res.json({ ok: true, avatar: await avatarUrl(req.uid) });
}));
app.delete('/api/profile/avatar', ...profileMedia, h(async (req, res) => { await query('DELETE FROM student_avatars WHERE user_id = $1', [req.uid]); res.json({ ok: true }); }));
app.get('/api/profile/documents', ...profileMedia, h(async (req, res) => res.json(await profileDocuments(req.uid))));
app.post('/api/profile/documents', ...profileMedia, h(async (req, res) => {
    const file = pdfFile(req.body);
    if (!file) return pdfError(res);
    const document = await one('INSERT INTO student_documents (user_id, name, content) VALUES ($1,$2,$3) RETURNING id, name', [req.uid, file.name, file.content]);
    res.json({ ok: true, document });
}));
app.delete('/api/profile/documents/:id', ...profileMedia, h(async (req, res) => { await query('DELETE FROM student_documents WHERE id = $1 AND user_id = $2', [num(req.params.id), req.uid]); res.json({ ok: true }); }));
app.get('/api/profile/avatar/:id', h(async (req, res) => {
    const a = await one('SELECT mime, content FROM student_avatars WHERE user_id = $1', [num(req.params.id)]);
    if (!a) return res.sendStatus(404);
    res.type(a.mime).set('Cache-Control', 'no-store').send(a.content);
}));
app.get('/api/profile/documents/:id', auth, h(async (req, res) => {
    const d = await one(`SELECT d.name, d.content FROM student_documents d
    WHERE d.id = $1 AND (d.user_id = $2 OR EXISTS (
      SELECT 1 FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
      WHERE a.user_id = d.user_id AND v.company_id = $2 AND ((a.direction = 'student_to_company' AND a.status <> 'declined') OR (a.direction = 'company_to_student' AND a.status = 'accepted'))
    ))`, [num(req.params.id), req.uid]);
    if (!d) return res.sendStatus(404);
    sendPdf(res, d);
}));
const enrollmentFields = 'submission_id, name, status, submitted_at, reviewed_at';
app.get('/api/profile/enrollment', ...student, h(async (req, res) => {
    const record = await one(`SELECT ${enrollmentFields} FROM enrollment_verifications WHERE user_id = $1`, [req.uid]);
    res.json(record || null);
}));
app.post('/api/profile/enrollment', ...student, h(async (req, res) => {
    const file = pdfFile(req.body);
    if (!file) return pdfError(res);
    const record = await one(`INSERT INTO enrollment_verifications (user_id, submission_id, name, content)
    VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET submission_id = EXCLUDED.submission_id,
    name = EXCLUDED.name, content = EXCLUDED.content, status = 'pending', submitted_at = now(),
    reviewed_at = NULL, reviewed_by = NULL
    WHERE enrollment_verifications.status = 'rejected' RETURNING ${enrollmentFields}`,
        [req.uid, crypto.randomUUID(), file.name, file.content]);
    if (!record) return res.status(409).json({ error: 'Справка уже отправлена или одобрена' });
    res.status(201).json(record);
}));
app.get('/api/admin/enrollment', ...admin, h(async (req, res) => {
    res.json(await query(`SELECT e.user_id, e.submission_id, e.name, e.submitted_at, u.email, p.full_name, p.university
    FROM enrollment_verifications e JOIN users u ON u.id = e.user_id LEFT JOIN profiles p ON p.user_id = e.user_id
    WHERE e.status = 'pending' ORDER BY e.submitted_at`));
}));
app.get('/api/admin/enrollment/:id/document', ...admin, h(async (req, res) => {
    const file = await one('SELECT name, content FROM enrollment_verifications WHERE submission_id::text = $1', [req.params.id]);
    if (!file) return res.status(404).json({ error: 'Справка не найдена' });
    sendPdf(res, file);
}));
app.post('/api/admin/enrollment/:id/review', ...admin, h(async (req, res) => {
    const status = req.body?.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Выберите решение по справке' });
    const result = await one(`WITH reviewed AS (
    UPDATE enrollment_verifications SET status = $2, reviewed_at = now(), reviewed_by = $3
    WHERE submission_id::text = $1 AND status = 'pending' RETURNING user_id
  )
  INSERT INTO notifications (user_id, text, link)
  SELECT user_id, $4, '/pages/account.html#profile' FROM reviewed RETURNING id`, [req.params.id, status, req.uid,
    status === 'approved' ? 'Обучение подтверждено' : 'Справка об обучении отклонена. Можно отправить новую.']);
    if (!result) return res.status(409).json({ error: 'Справка уже проверена или заменена' });
    res.json({ ok: true });
}));
app.get('/api/vacancies', ...student, h(async (req, res) => {
    const w = ['v.is_active'], p = [req.uid], { q: text, format, category, paid, fav } = req.query;
    if (text) { p.push('%' + String(text).toLowerCase().slice(0, 60) + '%'); w.push(`(lower(v.title) LIKE $${p.length} OR lower(v.company) LIKE $${p.length} OR lower(COALESCE(v.description,'')) LIKE $${p.length} OR lower(COALESCE(v.city,'')) LIKE $${p.length})`); }
    if (format) { p.push(format); w.push(`v.format = $${p.length}`); }
    if (category) { p.push(categoriesFor(String(category))); w.push(`v.category = ANY($${p.length}::text[])`); }
    if (paid === '1') w.push('v.paid');
    if (fav === '1') w.push('EXISTS(SELECT 1 FROM favorites f WHERE f.vacancy_id = v.id AND f.user_id = $1)');
    const rows = await query(`SELECT v.id, v.company_id, v.company, v.title, v.description, v.city, v.format, v.category,
    v.paid, v.is_active, v.created_at, (v.workplace_photo_mime IS NOT NULL) AS has_workplace_photo,
    EXISTS(SELECT 1 FROM applications a WHERE a.vacancy_id = v.id AND a.user_id = $1 AND a.direction = 'student_to_company') AS applied,
    EXISTS(SELECT 1 FROM favorites f WHERE f.vacancy_id = v.id AND f.user_id = $1) AS fav
    FROM vacancies v WHERE ${w.join(' AND ')} ORDER BY v.id DESC LIMIT 100`, p);
    const prep = prepare(await one('SELECT * FROM profiles WHERE user_id = $1', [req.uid]));
    for (const v of rows) Object.assign(v, score(prep, v));
    if (req.query.sort === 'match') rows.sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || b.id - a.id);
    res.json(rows);
}));
// Владелец, администратор и откликнувшийся студент могут открыть архивную вакансию.
app.get('/api/vacancies/:id', auth, h(async (req, res) => {
    const id = num(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Некорректный номер вакансии' });
    const v = await one('SELECT * FROM vacancies WHERE id = $1', [id]);
    if (!v) return res.status(404).json({ error: 'Вакансия не найдена' });
    const application = req.role === 'student' ? await one(`SELECT id, status, direction FROM applications
    WHERE vacancy_id = $1 AND user_id = $2 ORDER BY (direction = 'student_to_company') DESC, id DESC LIMIT 1`, [id, req.uid]) : null;
    if (!v.is_active && req.role !== 'admin' && v.company_id !== req.uid && !application)
        return res.status(404).json({ error: 'Вакансия не найдена или закрыта' });
    const fav = req.role === 'student' && !!(await one('SELECT 1 FROM favorites WHERE user_id = $1 AND vacancy_id = $2', [req.uid, id]));
    if (req.role === 'student') Object.assign(v, score(prepare(await one('SELECT * FROM profiles WHERE user_id = $1', [req.uid])), v));
    const { workplace_photo, ...publicVacancy } = v;
    res.json({ ...publicVacancy, has_workplace_photo: Boolean(v.workplace_photo_mime), fav, applied: application?.direction === 'student_to_company', application });
}));
app.get('/api/public/vacancies/:id/workplace-photo', h(async (req, res) => {
  const v = await one('SELECT workplace_photo_mime, workplace_photo FROM vacancies WHERE id = $1 AND is_active', [num(req.params.id)]);
  if (!v?.workplace_photo) return res.sendStatus(404);
  res.type(v.workplace_photo_mime).set('Cache-Control', 'no-cache').send(v.workplace_photo);
}));

app.post('/api/favorites/:id', ...student, h(async (req, res) => {
    const vid = num(req.params.id);
    const del = await query('DELETE FROM favorites WHERE user_id = $1 AND vacancy_id = $2 RETURNING 1', [req.uid, vid]);
    if (del.length) return res.json({ fav: false });
    if (!(await one('SELECT 1 FROM vacancies WHERE id = $1', [vid]))) return res.status(404).json({ error: 'Вакансия не найдена' });
    await query('INSERT INTO favorites (user_id, vacancy_id) VALUES ($1,$2)', [req.uid, vid]);
    res.json({ fav: true });
}));
app.post('/api/apply/:id', ...student, verified, h(async (req, res) => {
    const v = await one('SELECT * FROM vacancies WHERE id = $1 AND is_active', [num(req.params.id)]);
    if (!v) return res.status(404).json({ error: 'Вакансия не найдена или закрыта' });
    if (!(await one('SELECT 1 FROM profiles WHERE user_id = $1 AND full_name IS NOT NULL', [req.uid]))) return res.status(400).json({ error: 'Сначала заполните профиль' });
    if (await one(`SELECT 1 FROM applications WHERE user_id = $1 AND vacancy_id = $2 AND direction = 'student_to_company'`, [req.uid, v.id])) return res.status(409).json({ error: 'Вы уже откликнулись' });
    const coverLetter = clean(req.body?.cover_letter, 1500);
  const created = await one(`WITH application AS (
    INSERT INTO applications (user_id, vacancy_id, direction, cover_letter, cover_letter_in_chat)
    VALUES ($1,$2,'student_to_company',$3,true) RETURNING id, user_id, cover_letter
  ), first_message AS (
    INSERT INTO messages (application_id, sender_id, text)
    SELECT id, user_id, cover_letter FROM application WHERE cover_letter IS NOT NULL AND $4::boolean
  ) SELECT id FROM application`, [req.uid, v.id, coverLetter, Boolean(v.company_id)]);
    if (v.company_id) await notify(v.company_id, `${await nameOf(req.uid)} откликнулся(ась) на «${v.title}»`, '/pages/company.html#responses');
  res.json({ ok: true, chat: Boolean(v.company_id), application_id: created.id });
}));
app.get('/api/applications', ...student, h(async (req, res) => res.json(await query(`SELECT a.id, a.direction, a.status, a.created_at, a.cover_letter, v.company, v.company_id, v.id AS vacancy_id, v.title,
  (SELECT row_to_json(i) FROM (SELECT id, scheduled_at, format, place, note, status FROM interviews WHERE application_id = a.id ORDER BY id DESC LIMIT 1) i) AS interview,
  (v.company_id IS NOT NULL AND a.status <> 'declined' AND (a.direction = 'student_to_company' OR a.status = 'accepted')) AS chat
  FROM applications a JOIN vacancies v ON v.id = a.vacancy_id WHERE a.user_id = $1 ORDER BY a.id DESC`, [req.uid]))));
app.delete('/api/applications/:id', ...student, h(async (req, res) => {
    const r = await query(`DELETE FROM applications WHERE id = $1 AND user_id = $2 AND direction = 'student_to_company' AND status = 'new' RETURNING id`, [num(req.params.id), req.uid]);
    r.length ? res.json({ ok: true }) : res.status(404).json({ error: 'Отклик нельзя отозвать' });
}));
app.post('/api/applications/:id/respond', ...student, verified, h(async (req, res) => {
    const st = req.body?.status;
    if (!['accepted', 'declined'].includes(st)) return res.status(400).json({ error: 'Неверный статус' });
    const a = await one(`SELECT a.id, v.title, v.company_id FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
    WHERE a.id = $1 AND a.user_id = $2 AND a.direction = 'company_to_student' AND a.status = 'new'`, [num(req.params.id), req.uid]);
    if (!a) return res.status(404).json({ error: 'Приглашение не найдено' });
    await query('UPDATE applications SET status = $1 WHERE id = $2', [st, a.id]);
    if (a.company_id) await notify(a.company_id, `${await nameOf(req.uid)} ${st === 'accepted' ? 'принял(а)' : 'отклонил(а)'} приглашение на «${a.title}»`, '/pages/company.html#responses');
    res.json({ ok: true });
}));

// ---------- компания ----------
const FORMATS = ['Офис', 'Удалённо', 'Гибрид'];
app.get('/api/company', ...company, h(async (req, res) => {
    const c = await one('SELECT * FROM companies WHERE user_id = $1', [req.uid]);
    res.json(c ? { ...c, avatar: await avatarUrl(req.uid) } : c);
}));
app.put('/api/company', ...company, approved, h(async (req, res) => {
    const b = req.body || {}, v = k => clean(b[k], 1000);
    if (!v('name') || v('name').length < 2) return res.status(400).json({ error: 'Укажите название компании' });
    await query('UPDATE companies SET name=$2, industry=$3, city=$4, website=$5, description=$6 WHERE user_id = $1', [req.uid, v('name'), v('industry'), v('city'), v('website'), v('description')]);
    await query('UPDATE vacancies SET company = $1 WHERE company_id = $2', [v('name'), req.uid]);
    res.json({ ok: true });
}));
app.get('/api/company/vacancies', ...company, h(async (req, res) => res.json(await query(`SELECT v.id, v.company_id, v.company, v.title, v.description, v.city, v.format, v.category, v.paid, v.is_active, v.created_at, (v.workplace_photo_mime IS NOT NULL) AS has_workplace_photo,
  (SELECT COUNT(*)::int FROM applications a WHERE a.vacancy_id = v.id AND a.direction = 'student_to_company') AS responses
  FROM vacancies v WHERE v.company_id = $1 ORDER BY v.id DESC`, [req.uid]))));
app.post('/api/company/vacancies', ...company, approved, verified, h(async (req, res) => {
    const b = req.body || {};
    if ((b.title || '').trim().length < 3) return res.status(400).json({ error: 'Укажите название вакансии' });
    const c = await one('SELECT name FROM companies WHERE user_id = $1', [req.uid]);
    const photo = b.photo ? workplacePhoto(b.photo) : null;
    if (b.photo && !photo) return invalidWorkplacePhoto(res);
    await query('INSERT INTO vacancies (company, title, description, company_id, city, format, category, paid, workplace_photo_mime, workplace_photo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [c.name, b.title.trim().slice(0, 120), clean(b.description, 2000) || '', req.uid, clean(b.city, 80), FORMATS.includes(b.format) ? b.format : null, clean(b.category, 40), !!b.paid, photo?.mime ?? null, photo?.content ?? null]);
    res.json({ ok: true });
}));
function workplacePhoto(data) {
    const file = dataFile(data, null, 5 * 1024 * 1024);
    if (!file) return null;
    const bytes = file.content;
    if (file.mime === 'image/png' && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return file;
    if (file.mime === 'image/jpeg' && bytes.subarray(0, 3).toString('hex') === 'ffd8ff') return file;
    if (file.mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return file;
    return null;
}
const invalidWorkplacePhoto = res => res.status(400).json({ error: 'Загрузите PNG, JPG или WEBP до 5 МБ' });
app.post('/api/company/vacancies/:id/workplace-photo', ...company, approved, verified, h(async (req, res) => {
  const file = workplacePhoto(req.body?.data);
  if (!file) return invalidWorkplacePhoto(res);
  const result = await one('UPDATE vacancies SET workplace_photo_mime = $1, workplace_photo = $2 WHERE id = $3 AND company_id = $4 RETURNING id', [file.mime, file.content, num(req.params.id), req.uid]);
  result ? res.json({ ok: true }) : res.status(404).json({ error: 'Вакансия не найдена' });
}));
app.post('/api/company/vacancies/:id/toggle', ...company, approved, h(async (req, res) => {
    const r = await query('UPDATE vacancies SET is_active = NOT is_active WHERE id = $1 AND company_id = $2 RETURNING is_active', [num(req.params.id), req.uid]);
    r.length ? res.json(r[0]) : res.status(404).json({ error: 'Вакансия не найдена' });
}));
app.delete('/api/company/vacancies/:id', ...company, approved, h(async (req, res) => {
    const r = await query('DELETE FROM vacancies WHERE id = $1 AND company_id = $2 RETURNING id', [num(req.params.id), req.uid]);
    r.length ? res.json({ ok: true }) : res.status(404).json({ error: 'Вакансия не найдена' });
}));
app.get('/api/company/responses', ...company, h(async (req, res) => res.json(await query(`SELECT a.id, a.user_id, a.cover_letter, a.direction, a.status, a.created_at, v.id AS vacancy_id, v.title,
  (SELECT row_to_json(i) FROM (SELECT id, scheduled_at, format, place, note, status FROM interviews WHERE application_id = a.id ORDER BY id DESC LIMIT 1) i) AS interview,
  p.full_name, p.age, p.education, p.university, p.specialty, p.work_history, p.desired_experience, p.skills, u.email
  FROM applications a JOIN vacancies v ON v.id = a.vacancy_id JOIN users u ON u.id = a.user_id LEFT JOIN profiles p ON p.user_id = a.user_id
  WHERE v.company_id = $1 ORDER BY a.id DESC`, [req.uid]))));
const STAGES = ['new', 'interview', 'offer', 'accepted', 'declined'];
const stageText = { offer: 'отправила вам оффер на', accepted: 'приняла ваш отклик на', declined: 'отклонила ваш отклик на' };
const ownApp = (id, uid) => one(`SELECT a.id, a.user_id, a.status, v.title, v.company FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
  WHERE a.id = $1 AND v.company_id = $2 AND a.direction = 'student_to_company'`, [num(id), uid]);
// этап воронки: new → interview → offer → accepted / declined
app.post('/api/company/applications/:id/status', ...company, approved, verified, h(async (req, res) => {
    const st = req.body?.status;
    if (!STAGES.includes(st) || st === 'interview') return res.status(400).json({ error: 'Для собеседования укажите дату и время' });
    const a = await ownApp(req.params.id, req.uid);
    if (!a) return res.status(404).json({ error: 'Отклик не найден' });
    if (a.status === st) return res.json({ ok: true });
    await query('UPDATE applications SET status = $1 WHERE id = $2', [st, a.id]);
    if (stageText[st]) await notify(a.user_id, `Компания «${a.company}» ${stageText[st]} «${a.title}»`, '/pages/vacancies.html#mine');
    res.json({ ok: true });
}));
// назначить или перенести собеседование (этап ставится автоматически)
app.post('/api/company/applications/:id/interview', ...company, approved, verified, h(async (req, res) => {
    const b = req.body || {}, at = new Date(b.when);
    if (isNaN(at) || at.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'Укажите дату и время в будущем' });
    const a = await ownApp(req.params.id, req.uid);
    if (!a) return res.status(404).json({ error: 'Отклик не найден' });
    if (a.status === 'declined') return res.status(400).json({ error: 'Отклик отклонён — сначала верните его в работу' });
    await query('DELETE FROM interviews WHERE application_id = $1', [a.id]);
    await query('INSERT INTO interviews (application_id, scheduled_at, format, place, note) VALUES ($1,$2,$3,$4,$5)',
        [a.id, at.toISOString(), b.format === 'office' ? 'office' : 'online', clean(b.place, 300), clean(b.note, 500)]);
    await query(`UPDATE applications SET status = 'interview' WHERE id = $1`, [a.id]);
    await notify(a.user_id, `Компания «${a.company}» назначила собеседование по вакансии «${a.title}» — подтвердите время`, '/pages/vacancies.html#mine');
    res.json({ ok: true });
}));
// студент подтверждает собеседование или просит перенос
app.post('/api/interviews/:id/respond', ...student, h(async (req, res) => {
    const st = req.body?.status;
    if (!['confirmed', 'reschedule'].includes(st)) return res.status(400).json({ error: 'Неверный ответ' });
    const i = await one(`SELECT i.id, v.title, v.company_id FROM interviews i JOIN applications a ON a.id = i.application_id JOIN vacancies v ON v.id = a.vacancy_id
    WHERE i.id = $1 AND a.user_id = $2`, [num(req.params.id), req.uid]);
    if (!i) return res.status(404).json({ error: 'Собеседование не найдено' });
    await query('UPDATE interviews SET status = $1 WHERE id = $2', [st, i.id]);
    await notify(i.company_id, `${await nameOf(req.uid)} ${st === 'confirmed' ? 'подтвердил(а)' : 'просит перенести'} собеседование по «${i.title}»`, '/pages/company.html#responses');
    res.json({ ok: true });
}));
app.get('/api/students', ...company, h(async (req, res) => res.json(await query(`SELECT user_id, full_name, age, education, university, specialty, desired_experience, city, skills
  FROM profiles WHERE full_name IS NOT NULL ORDER BY user_id DESC LIMIT 60`))));
app.post('/api/invite', ...company, approved, verified, h(async (req, res) => {
    const uid = num(req.body?.user_id), vid = num(req.body?.vacancy_id);
    const v = await one('SELECT * FROM vacancies WHERE id = $1 AND company_id = $2', [vid, req.uid]);
    if (!v) return res.status(400).json({ error: 'Сначала опубликуйте вакансию и выберите её' });
    if (!(await one(`SELECT 1 FROM users WHERE id = $1 AND role = 'student'`, [uid]))) return res.status(404).json({ error: 'Студент не найден' });
    if (await one(`SELECT 1 FROM applications WHERE user_id = $1 AND vacancy_id = $2 AND direction = 'company_to_student'`, [uid, vid])) return res.status(409).json({ error: 'Вы уже приглашали этого студента' });
    await query(`INSERT INTO applications (user_id, vacancy_id, direction) VALUES ($1,$2,'company_to_student')`, [uid, vid]);
    await notify(uid, `Компания «${v.company}» приглашает вас: «${v.title}»`, '/pages/vacancies.html#offers');
    res.json({ ok: true });
}));

// Анкеты студентов не публичны. Компания должна быть одобрена; email здесь не раскрывается.
app.get('/api/students/:id', auth, h(async (req, res) => {
    const id = req.params.id === 'me' ? req.uid : num(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Некорректный номер студента' });
    if (req.role === 'student' && id !== req.uid) return res.status(403).json({ error: 'Другие анкеты доступны только проверенным компаниям' });
    if (req.role === 'company' && !req.approved) return res.status(403).json({ error: 'Просмотр анкет доступен после проверки компании', code: 'unapproved' });
  const p = await one(`SELECT p.user_id, p.full_name, p.age, p.education, p.university, p.specialty,
    EXISTS (SELECT 1 FROM enrollment_verifications e WHERE e.user_id = p.user_id AND e.status = 'approved') AS enrollment_verified,
    p.work_history, p.desired_experience, p.city, p.skills, p.about, p.portfolio
    FROM profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = $1 AND u.role = 'student' AND NOT u.is_blocked AND p.full_name IS NOT NULL`, [id]);
    if (!p) return res.status(404).json({ error: 'Профиль студента не найден или ещё не заполнен' });
    const canResume = req.role === 'admin' || (req.role === 'student' && id === req.uid) || !!(await one(`SELECT 1 FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
    WHERE a.user_id = $1 AND v.company_id = $2 AND ((a.direction = 'student_to_company' AND a.status <> 'declined') OR (a.direction = 'company_to_student' AND a.status = 'accepted')) LIMIT 1`, [id, req.uid]));
    res.json({ ...p, avatar: await avatarUrl(id), can_resume: canResume });
}));

// ---------- резюме ----------
// студент видит своё; компания — только резюме тех, кто откликнулся (или принял приглашение); админ — любое
app.get('/api/resume/:id', auth, h(async (req, res) => {
    const uid = req.params.id === 'me' ? req.uid : num(req.params.id);
    if (req.role === 'student' && uid !== req.uid) return res.status(403).json({ error: 'Нет доступа к этому резюме' });
    if (req.role === 'company' && !(await one(`SELECT 1 FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
    WHERE a.user_id = $1 AND v.company_id = $2 AND ((a.direction = 'student_to_company' AND a.status <> 'declined') OR (a.direction = 'company_to_student' AND a.status = 'accepted')) LIMIT 1`, [uid, req.uid])))
        return res.status(403).json({ error: 'Резюме доступно после отклика студента или принятого приглашения' });
    const p = await one(`SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 AND u.role = 'student'`, [uid]);
    if (!p) return res.status(404).json({ error: 'Профиль ещё не заполнен' });
    res.json({ ...p, avatar: await avatarUrl(uid) });
}));

// ---------- дашборды ----------
const series = (inner, days, params = []) => query(`SELECT to_char(d, 'DD.MM') AS label, COALESCE(c.n, 0)::int AS n
  FROM generate_series((current_date - ${days - 1})::timestamp, current_date::timestamp, interval '1 day') d
  LEFT JOIN (${inner}) c ON c.day = d::date ORDER BY d`, params);
app.get('/api/dashboard', auth, h(async (req, res) => {
    const uid = req.uid;
    if (req.role === 'student') {
        const p = await one('SELECT * FROM profiles WHERE user_id = $1', [uid]);
        const filled = SF.filter(k => p && p[k] != null && String(p[k]).trim() !== '').length;
        const apps = await query(`SELECT a.direction, a.status, a.created_at, v.id AS vacancy_id, v.title, v.company, v.company_id FROM applications a JOIN vacancies v ON v.id = a.vacancy_id WHERE a.user_id = $1 ORDER BY a.id DESC`, [uid]);
        const prep = prepare(p);
        const open = await query(`SELECT v.id, v.title, v.company, v.city, v.format, v.category, v.description FROM vacancies v
      WHERE v.is_active AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.vacancy_id = v.id AND a.user_id = $1) ORDER BY v.id DESC LIMIT 100`, [uid]);
        const picks = open.map(v => ({ id: v.id, title: v.title, company: v.company, ...score(prep, v) }))
            .filter(v => v.match != null && v.match >= 30).sort((a, b) => b.match - a.match).slice(0, 3);
        return res.json({
            kind: 'student', name: p?.full_name, completeness: Math.round(filled / SF.length * 100),
            stats: {
                responses: apps.filter(a => a.direction === 'student_to_company').length, offers: apps.filter(a => a.direction === 'company_to_student' && a.status === 'new').length,
                accepted: apps.filter(a => a.status === 'accepted').length, favs: (await one('SELECT COUNT(*)::int AS n FROM favorites WHERE user_id = $1', [uid])).n
            },
            series: await series(`SELECT created_at::date AS day, COUNT(*) AS n FROM applications WHERE user_id = $1 AND direction = 'student_to_company' GROUP BY 1`, 7, [uid]),
            recent: apps.slice(0, 5), picks
        });
    }
    if (req.role === 'company') {
        const vac = await query(`SELECT v.id, v.title, v.is_active, (SELECT COUNT(*)::int FROM applications a WHERE a.vacancy_id = v.id AND a.direction = 'student_to_company') AS responses FROM vacancies v WHERE v.company_id = $1`, [uid]);
        const apps = await query(`SELECT a.direction, a.status FROM applications a JOIN vacancies v ON v.id = a.vacancy_id WHERE v.company_id = $1`, [uid]);
        return res.json({
            kind: 'company', name: (await one('SELECT name FROM companies WHERE user_id = $1', [uid]))?.name,
            stats: {
                vacancies: vac.filter(v => v.is_active).length, responses: apps.filter(a => a.direction === 'student_to_company').length,
                invites: apps.filter(a => a.direction === 'company_to_student').length, accepted: apps.filter(a => a.status === 'accepted').length
            },
            series: await series(`SELECT a.created_at::date AS day, COUNT(*) AS n FROM applications a JOIN vacancies v ON v.id = a.vacancy_id WHERE v.company_id = $1 AND a.direction = 'student_to_company' GROUP BY 1`, 7, [uid]),
            top: vac.sort((a, b) => b.responses - a.responses).slice(0, 5)
        });
    }
    res.json({
        kind: 'admin', stats: await one(`SELECT (SELECT COUNT(*)::int FROM users) AS users, (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students,
    (SELECT COUNT(*)::int FROM users WHERE role = 'company') AS companies, (SELECT COUNT(*)::int FROM users WHERE NOT email_verified) AS unverified,
    (SELECT COUNT(*)::int FROM vacancies) AS vacancies, (SELECT COUNT(*)::int FROM applications) AS applications,
    (SELECT COUNT(*)::int FROM companies WHERE NOT approved) AS pending, (SELECT COUNT(*)::int FROM support_threads WHERE status = 'open') AS tickets`),
        series: await series(`SELECT created_at::date AS day, COUNT(*) AS n FROM users GROUP BY 1`, 14)
    });
}));

// ---------- чат по откликам ----------
const chatApp = async (req, res) => {
    const a = await one(`SELECT a.id, a.user_id, a.status, a.direction, v.title, v.company, v.company_id FROM applications a
    JOIN vacancies v ON v.id = a.vacancy_id WHERE a.id = $1`, [num(req.params.id)]);
    const ok = a && a.company_id && (a.user_id === req.uid || a.company_id === req.uid) && a.status !== 'declined' && (a.direction === 'student_to_company' || a.status === 'accepted');
    if (!ok) { res.status(404).json({ error: 'Чат недоступен' }); return null; }
    return a;
};
const CLR_APP = "COALESCE((SELECT cleared_at FROM chat_state WHERE user_id = $3 AND kind = 'app' AND ref_id = $1), '-infinity')";
const clearFor = (uid, kind, ref) => query(`INSERT INTO chat_state (user_id, kind, ref_id, cleared_at) VALUES ($1,$2,$3, now())
  ON CONFLICT (user_id, kind, ref_id) DO UPDATE SET cleared_at = now()`, [uid, kind, ref]);
app.get('/api/chats', auth, h(async (req, res) => res.json(await query(`SELECT * FROM (
  SELECT a.id, a.user_id, a.created_at, v.id AS vacancy_id, v.title, v.company, v.company_id, p.full_name,
    latest.text AS last_text, latest.created_at AS last_at
  FROM applications a JOIN vacancies v ON v.id = a.vacancy_id LEFT JOIN profiles p ON p.user_id = a.user_id
  LEFT JOIN chat_state cs ON cs.user_id = $1 AND cs.kind = 'app' AND cs.ref_id = a.id
  LEFT JOIN LATERAL (
    SELECT m.text, m.created_at FROM messages m WHERE m.application_id = a.id
      AND m.created_at > COALESCE(cs.cleared_at, '-infinity')
      AND NOT EXISTS (SELECT 1 FROM hidden_chat_messages h WHERE h.user_id = $1 AND h.message_id = m.id)
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1
  ) latest ON true
  WHERE (a.user_id = $1 OR v.company_id = $1) AND v.company_id IS NOT NULL AND a.status <> 'declined'
    AND (a.direction = 'student_to_company' OR a.status = 'accepted')
    AND (cs.cleared_at IS NULL OR latest.created_at IS NOT NULL)) t
  ORDER BY COALESCE(last_at, created_at) DESC`, [req.uid]))));
app.get('/api/chats/:id/messages', auth, h(async (req, res) => {
    const a = await chatApp(req, res); if (!a) return;
    const rows = await query(`SELECT m.id, m.sender_id, m.text, m.created_at, m.reply_to, r.text AS reply_text, r.sender_id AS reply_sender
    FROM messages m LEFT JOIN messages r ON r.id = m.reply_to AND r.application_id = m.application_id AND r.created_at > ${CLR_APP}
      AND NOT EXISTS (SELECT 1 FROM hidden_chat_messages h WHERE h.user_id = $3 AND h.message_id = r.id)
    WHERE m.application_id = $1 AND m.id > $2 AND m.created_at > ${CLR_APP}
      AND NOT EXISTS (SELECT 1 FROM hidden_chat_messages h WHERE h.user_id = $3 AND h.message_id = m.id)
    ORDER BY m.created_at, m.id`, [a.id, num(req.query.after), req.uid]);
    res.json({
        title: a.title, company: a.company, company_id: a.company_id, student_id: a.user_id, student: await nameOf(a.user_id),
        items: rows.map(m => ({
            id: m.id, text: m.text, created_at: m.created_at, mine: m.sender_id === req.uid,
            reply_id: m.reply_to || null, reply_text: m.reply_text ? m.reply_text.slice(0, 140) : null, reply_mine: m.reply_sender === req.uid
        }))
    });
}));

app.delete('/api/chats/:id/messages/:messageId', auth, h(async (req, res) => {
    const { scope } = req.query;
    const messageId = Number(req.params.messageId);
    if (!['me', 'all'].includes(scope) || !Number.isSafeInteger(messageId) || messageId < 1 || messageId > 2147483647)
        return res.status(400).json({ error: 'Некорректный запрос на удаление сообщения' });
    const a = await chatApp(req, res);
    if (!a) return;
    const params = [a.id, messageId, req.uid];
    if (scope === 'me') {
        await query(`INSERT INTO hidden_chat_messages (user_id, message_id)
            SELECT $3, id FROM messages WHERE application_id = $1 AND id = $2
            ON CONFLICT DO NOTHING`, params);
    } else {
        const message = await one('SELECT sender_id FROM messages WHERE application_id = $1 AND id = $2', params.slice(0, 2));
        if (message && message.sender_id !== req.uid)
            return res.status(403).json({ error: 'Удалить у всех может автор сообщения' });
        await query('DELETE FROM messages WHERE application_id = $1 AND id = $2 AND sender_id = $3', params);
    }
    res.json({ ok: true });
}));
app.post('/api/chats/:id/messages', auth, approved, verified, h(async (req, res) => {
    const a = await chatApp(req, res); if (!a) return;
    const text = clean(req.body?.text, 1000);
    if (!text) return res.status(400).json({ error: 'Пустое сообщение' });
    if (!limit('cm:' + req.uid, 30, 60000)) return tooMany(res);
    let replyTo = null;
    if (req.body?.reply_to) { const r = await one('SELECT id FROM messages WHERE id = $1 AND application_id = $2', [num(req.body.reply_to), a.id]); replyTo = r ? r.id : null; }
    await query('INSERT INTO messages (application_id, sender_id, text, reply_to) VALUES ($1,$2,$3,$4)', [a.id, req.uid, text, replyTo]);
    const isStudent = req.uid === a.user_id, to = isStudent ? a.company_id : a.user_id, link = `/pages/chat.html#${a.id}`;
    if (!(await one('SELECT 1 FROM notifications WHERE user_id = $1 AND link = $2 AND is_read = false', [to, link])))
        await notify(to, `Новое сообщение от ${isStudent ? await nameOf(req.uid) : a.company}: «${a.title}»`, link);
    res.json({ ok: true });
}));

// удалить чат: scope=me — скрыть у себя, scope=both — стереть переписку у обоих
app.delete('/api/chats/:id', auth, h(async (req, res) => {
    const a = await one(`SELECT a.id, a.user_id, v.company_id FROM applications a JOIN vacancies v ON v.id = a.vacancy_id WHERE a.id = $1`, [num(req.params.id)]);
    if (!a || (a.user_id !== req.uid && a.company_id !== req.uid)) return res.status(404).json({ error: 'Чат не найден' });
    if (req.query.scope === 'both') {
        await query('DELETE FROM messages WHERE application_id = $1', [a.id]);
        await clearFor(a.user_id, 'app', a.id); if (a.company_id) await clearFor(a.company_id, 'app', a.id);
    } else await clearFor(req.uid, 'app', a.id);
    res.json({ ok: true });
}));

// ---------- поддержка ----------
const CLR_SUP = "COALESCE((SELECT cleared_at FROM chat_state WHERE user_id = $3 AND kind = 'support' AND ref_id = $1), '-infinity')";
const SUPQ = `SELECT m.id, m.sender_id, m.is_staff, m.text, m.created_at, m.reply_to, r.text AS reply_text, r.is_staff AS reply_staff
  FROM support_messages m LEFT JOIN support_messages r ON r.id = m.reply_to AND r.thread_id = m.thread_id AND r.created_at > ${CLR_SUP}
  WHERE m.thread_id = $1 AND m.id > $2 AND m.created_at > ${CLR_SUP} ORDER BY m.id`;
const supItems = (rows, mineStaff) => rows.map(m => ({
    id: m.id, text: m.text, created_at: m.created_at, mine: m.is_staff === mineStaff,
    reply_id: m.reply_to || null, reply_text: m.reply_text ? m.reply_text.slice(0, 140) : null, reply_mine: m.reply_to ? m.reply_staff === mineStaff : false
}));
const supReply = async (body, threadId) => {
    if (!body?.reply_to) return null;
    const r = await one('SELECT id FROM support_messages WHERE id = $1 AND thread_id = $2', [num(body.reply_to), threadId]);
    return r ? r.id : null;
};
app.get('/api/support/messages', ...[auth], h(async (req, res) => {
    if (req.role === 'admin') return res.status(403).json({ error: 'Используйте админ-панель' });
    const t = await one('SELECT id FROM support_threads WHERE user_id = $1', [req.uid]);
    const rows = t ? await query(SUPQ, [t.id, num(req.query.after), req.uid]) : [];
    res.json({ items: supItems(rows, false) });
}));
app.post('/api/support/messages', auth, h(async (req, res) => {
    if (req.role === 'admin') return res.status(403).json({ error: 'Используйте админ-панель' });
    const text = clean(req.body?.text, 1000);
    if (!text) return res.status(400).json({ error: 'Пустое сообщение' });
    if (!limit('sm:' + req.uid, 20, 60000)) return tooMany(res);
    const t = await one(`INSERT INTO support_threads (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET status = 'open', updated_at = now() RETURNING id`, [req.uid]);
    await query('INSERT INTO support_messages (thread_id, sender_id, is_staff, text, reply_to) VALUES ($1,$2,false,$3,$4)', [t.id, req.uid, text, await supReply(req.body, t.id)]);
    const who = (await one(`SELECT COALESCE(p.full_name, c.name, u.email) AS n FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN companies c ON c.user_id = u.id WHERE u.id = $1`, [req.uid])).n;
    for (const a of await query(`SELECT id FROM users WHERE role = 'admin'`)) {
        if (!(await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND link = '/pages/admin.html#support' AND is_read = false`, [a.id])))
            await notify(a.id, `Новое обращение в поддержку от ${who}`, '/pages/admin.html#support');
    }
    res.json({ ok: true });
}));

// ---------- админ-панель ----------
app.get('/api/admin/users', ...admin, h(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 60), role = ['student', 'company', 'admin', 'pending', 'unverified'].includes(req.query.role) ? req.query.role : '';
    res.json(await query(`SELECT u.id, u.email, u.role, u.email_verified, u.is_blocked, u.created_at, COALESCE(p.full_name, c.name) AS name, c.approved
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN companies c ON c.user_id = u.id
    WHERE ($1 = '' OR lower(u.email) LIKE $2 OR lower(COALESCE(p.full_name, c.name, '')) LIKE $2) AND ($3 = '' OR u.role = $3 OR ($3 = 'pending' AND u.role = 'company' AND c.approved = false) OR ($3 = 'unverified' AND NOT u.email_verified))
    ORDER BY u.id DESC LIMIT 100`, [q, '%' + q.toLowerCase() + '%', role]));
}));
const target = async (req, res) => {
    const u = await one('SELECT id, role FROM users WHERE id = $1', [num(req.params.id)]);
    if (!u || u.role === 'admin') { res.status(400).json({ error: 'Действие недоступно для этого пользователя' }); return null; }
    return u;
};
app.post('/api/admin/users/:id/block', ...admin, h(async (req, res) => {
    const u = await target(req, res); if (!u) return;
    const b = !!req.body?.blocked;
    await query('UPDATE users SET is_blocked = $1 WHERE id = $2', [b, u.id]);
    if (b) await query('DELETE FROM sessions WHERE user_id = $1', [u.id]);
    res.json({ ok: true });
}));
app.post('/api/admin/users/:id/verify', ...admin, h(async (req, res) => { const u = await target(req, res); if (!u) return; await query('UPDATE users SET email_verified = true WHERE id = $1', [u.id]); res.json({ ok: true }); }));
app.post('/api/admin/users/:id/approve', ...admin, h(async (req, res) => {
    const a = !!req.body?.approved;
    const r = await query('UPDATE companies SET approved = $1 WHERE user_id = $2 RETURNING user_id', [a, num(req.params.id)]);
    if (!r.length) return res.status(404).json({ error: 'Компания не найдена' });
    await notify(r[0].user_id, a ? 'Ваша компания одобрена — теперь доступны вакансии, приглашения и чаты' : 'Доступ компании приостановлен администратором. Напишите в поддержку', a ? '/pages/company.html' : '/pages/support.html');
    if (a) {
        const t = await one('SELECT id FROM support_threads WHERE user_id = $1', [r[0].user_id]);
        if (t) {
            await query('INSERT INTO support_messages (thread_id, sender_id, is_staff, text) VALUES ($1,$2,true,$3)', [t.id, req.uid, 'Ваша компания одобрена. Теперь доступны публикация вакансий, приглашения студентов и чаты.']);
            await query('UPDATE support_threads SET updated_at = now() WHERE id = $1', [t.id]);
        }
    }
    res.json({ ok: true });
}));
app.delete('/api/admin/users/:id', ...admin, h(async (req, res) => { const u = await target(req, res); if (!u) return; await query('DELETE FROM users WHERE id = $1', [u.id]); res.json({ ok: true }); }));
app.get('/api/admin/vacancies', ...admin, h(async (req, res) => res.json(await query(`SELECT v.id, v.title, v.company, v.is_active, v.created_at,
  (SELECT COUNT(*)::int FROM applications a WHERE a.vacancy_id = v.id) AS responses FROM vacancies v ORDER BY v.id DESC LIMIT 200`))));
app.delete('/api/admin/vacancies/:id', ...admin, h(async (req, res) => { await query('DELETE FROM vacancies WHERE id = $1', [num(req.params.id)]); res.json({ ok: true }); }));
app.get('/api/admin/support', ...admin, h(async (req, res) => res.json(await query(`SELECT t.id, t.status, t.updated_at, u.email, u.role, c.approved, COALESCE(p.full_name, c.name, u.email) AS name,
  (SELECT text FROM support_messages m WHERE m.thread_id = t.id AND m.created_at > COALESCE(cs.cleared_at, '-infinity') ORDER BY m.id DESC LIMIT 1) AS last_text,
  (SELECT is_staff FROM support_messages m WHERE m.thread_id = t.id AND m.created_at > COALESCE(cs.cleared_at, '-infinity') ORDER BY m.id DESC LIMIT 1) AS last_staff
  FROM support_threads t JOIN users u ON u.id = t.user_id LEFT JOIN profiles p ON p.user_id = u.id LEFT JOIN companies c ON c.user_id = u.id
  LEFT JOIN chat_state cs ON cs.user_id = $1 AND cs.kind = 'support' AND cs.ref_id = t.id
  WHERE cs.cleared_at IS NULL OR EXISTS (SELECT 1 FROM support_messages m2 WHERE m2.thread_id = t.id AND m2.created_at > cs.cleared_at)
  ORDER BY t.updated_at DESC LIMIT 100`, [req.uid]))));
app.get('/api/admin/support/:id/messages', ...admin, h(async (req, res) => {
    const t = await one(`SELECT t.id, u.id AS user_id, u.email, u.role, c.name AS cname, c.industry, c.city, c.website, c.approved FROM support_threads t JOIN users u ON u.id = t.user_id LEFT JOIN companies c ON c.user_id = u.id WHERE t.id = $1`, [num(req.params.id)]);
    if (!t) return res.status(404).json({ error: 'Обращение не найдено' });
    res.json({ email: t.email, role: t.role, user_id: t.user_id, company: t.role === 'company' ? { name: t.cname, industry: t.industry, city: t.city, website: t.website, approved: t.approved } : null, items: supItems(await query(SUPQ, [t.id, num(req.query.after), req.uid]), true) });
}));
app.post('/api/admin/support/:id/messages', ...admin, h(async (req, res) => {
    const t = await one('SELECT id, user_id FROM support_threads WHERE id = $1', [num(req.params.id)]);
    const text = clean(req.body?.text, 1000);
    if (!t || !text) return res.status(400).json({ error: 'Пустое сообщение' });
    await query('INSERT INTO support_messages (thread_id, sender_id, is_staff, text, reply_to) VALUES ($1,$2,true,$3,$4)', [t.id, req.uid, text, await supReply(req.body, t.id)]);
    await query(`UPDATE support_threads SET updated_at = now(), status = 'open' WHERE id = $1`, [t.id]);
    if (!(await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND link = '/pages/support.html' AND is_read = false`, [t.user_id])))
        await notify(t.user_id, 'Поддержка ответила на ваше обращение', '/pages/support.html');
    res.json({ ok: true });
}));
app.delete('/api/admin/support/:id', ...admin, h(async (req, res) => {
    const id = num(req.params.id);
    if (!(await one('SELECT 1 FROM support_threads WHERE id = $1', [id]))) return res.status(404).json({ error: 'Обращение не найдено' });
    if (req.query.scope === 'both') { await query('DELETE FROM support_threads WHERE id = $1', [id]); await query(`DELETE FROM chat_state WHERE kind = 'support' AND ref_id = $1`, [id]); }
    else await clearFor(req.uid, 'support', id);
    res.json({ ok: true });
}));
app.post('/api/admin/support/:id/status', ...admin, h(async (req, res) => {
    await query('UPDATE support_threads SET status = $1 WHERE id = $2', [req.body?.status === 'closed' ? 'closed' : 'open', num(req.params.id)]);
    res.json({ ok: true });
}));

app.use(h(async (req, res) => { // страница не найдена
    if (req.path.startsWith('/api/')) return res.status(404).json({});
    res.status(404); res.setHeader('X-Robots-Tag', 'noindex');
    res.type('html').send(await render('404.html'));
}));
app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).json({ error: err.status === 503 ? err.message : 'Ошибка сервера' }); });

async function ensureAdmin() {
    const e = (process.env.ADMIN_EMAIL || '').toLowerCase(), p = process.env.ADMIN_PASSWORD;
    if (!e || !p) return;
    const u = await one('SELECT id FROM users WHERE email = $1', [e]);
    if (!u) await query(`INSERT INTO users (email, password_hash, role, email_verified) VALUES ($1,$2,'admin',true)`, [e, bcrypt.hashSync(p, 10)]);
    else await query(`UPDATE users SET role = 'admin', email_verified = true WHERE id = $1`, [u.id]);
    console.log('Администратор:', e);
}

const PORT = process.env.PORT || 3000;
module.exports = app;
if (require.main === module) init().then(ensureAdmin).then(() => {
    const server = app.listen(PORT);
    server.on('listening', () => console.log(`Сервер запущен: http://localhost:${PORT} (PostgreSQL: ${process.env.PGDATABASE})`));
    server.on('error', e => {
        console.error(`Не удалось запустить сервер на порту ${PORT}: ${e.code} — ${e.message}`);
        if (e.code === 'EADDRINUSE' || e.code === 'EACCES') console.error('Смените PORT в файле .env');
        process.exit(1);
    });
}).catch(e => {
    console.error('Не удалось запустить сервер:', e.code || '', e.message);
    console.error('Проверьте PGPASSWORD, PGPORT и PGDATABASE в server/.env и что служба PostgreSQL запущена.');
    process.exit(1);
});
