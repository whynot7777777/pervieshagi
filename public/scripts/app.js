(() => {
    const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const token = () => localStorage.getItem('token'), role = () => localStorage.getItem('role');
    const page = document.body.dataset.page;
    const cabinet = () => role() === 'admin' ? '/pages/admin.html' : '/pages/dashboard.html';
    const when = s => new Date(s).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const ago = s => { const d = (Date.now() - new Date(s)) / 1000; return d < 60 ? 'только что' : d < 3600 ? Math.floor(d / 60) + ' мин назад' : d < 86400 ? Math.floor(d / 3600) + ' ч назад' : when(s); };
    const card = i => `<div class="card vac">${i}</div>`;
    const ST = { new: 'На рассмотрении', interview: 'Собеседование', offer: 'Оффер', accepted: 'Принято', declined: 'Отклонено' };
    const GUARD = {
        'student-profile': ['student', 'company', 'admin'], dashboard: ['student', 'company'], profile: ['student'], company: ['company'], chat: ['student', 'company'],
        support: ['student', 'company'], admin: ['admin'], account: ['student', 'company', 'admin'], verify: ['student', 'company', 'admin'], resume: ['student', 'company', 'admin']
    };
    const IC = {
        reply: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6', invite: 'M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z',
        chat: 'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.2A8 8 0 1121 12z', ok: 'M20 6L9 17l-5-5', no: 'M18 6L6 18M6 6l12 12', bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
        home: 'M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z', out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
        sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', pending: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
        cal: 'M3 5h18v16H3zM8 3v4M16 3v4M3 10h18',
        grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', case: 'M3 7h18v13H3zM8 7V4h8v3', user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
        help: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01', shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4'
    };
    IC.meet = IC.cal;
    const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${IC[k]}"/></svg>`;
    const NAV = {
        student: [['dashboard', 'Обзор', '/pages/dashboard.html', 'grid'], ['vacancies', 'Вакансии', '/pages/vacancies.html', 'case'], ['chat', 'Чаты', '/pages/chat.html', 'chat']],
        company: [['dashboard', 'Обзор', '/pages/dashboard.html', 'grid'], ['company', 'Кабинет', '/pages/company.html', 'case'], ['chat', 'Чаты', '/pages/chat.html', 'chat']],
        admin: [['admin', 'Админ-панель', '/pages/admin.html', 'shield']]
    };

    async function api(url, o = {}) {
        const r = await fetch(url, {
            method: o.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) },
            body: o.body ? JSON.stringify(o.body) : undefined
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 401 && token()) { localStorage.removeItem('token'); localStorage.removeItem('role'); if (d.error && d.error !== 'Требуется вход') sessionStorage.setItem('flash', d.error); if (!['home', 'vacancies', 'partners', 'help', 'vacancy', 'company-profile'].includes(page)) location.href = '/pages/login.html'; }
        if (!r.ok) { const e = new Error(d.error || (r.status === 404 || r.status === 405 ? 'Сервер не знает этого запроса — замените файлы в server/ и перезапустите сервер' : 'Что-то пошло не так')); e.code = d.code; throw e; }
        return d;
    }
  async function downloadPdf(url, name) {
    const response = await fetch(url, { headers: token() ? { Authorization: 'Bearer ' + token() } : {} });
    if (!response.ok) throw new Error('Не удалось открыть документ');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name || 'document.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  const readWorkplacePhoto = file => new Promise((resolve, reject) => {
    if (!file || file.size > 5 * 1024 * 1024) return reject(new Error('Фото должно быть меньше 5 МБ'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
    let tt;
    function toast(msg) {
        let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
        t.classList.remove('profile-hint'); t.textContent = msg; requestAnimationFrame(() => t.classList.add('show'));
        clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200);
    }
    const fail = e => { toast(e.message); if (e.code === 'unverified' || e.code === 'unapproved') setTimeout(() => location.href = e.code === 'unverified' ? '/pages/verify.html' : '/pages/support.html', 1500); };
    const hashIn = list => list.includes(location.hash.slice(1)) ? location.hash.slice(1) : list[0];
    const tagsOf = v => [v.city, v.format, v.category, v.paid ? 'Оплачиваемо' : null].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const vacancyUrl = id => '/pages/vacancy.html?id=' + encodeURIComponent(id);
    const companyUrl = id => '/pages/company-profile.html?id=' + encodeURIComponent(id);
    const studentUrl = id => '/pages/student-profile.html?id=' + encodeURIComponent(id);
    const avatarImage = (url, className, alt = '') => `<img src="${esc(url)}" alt="${esc(alt)}"${className ? ` class="${className}"` : ''}>`;
    const companyLink = v => v.company_id ? `<a class="entity-link" href="${companyUrl(v.company_id)}">${esc(v.company)}</a>` : `<span>${esc(v.company)}</span>`;
    const bookmark = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>';
  const vacancyCard = (v, showFav = false, manage = false) => `<article id="vacancy-${v.id}" class="vacancy-card card">
    <div class="vacancy-card-top"><span class="vacancy-company">${companyLink(v)}</span>${showFav ? `<button class="fav ${v.fav ? 'on' : ''}" data-do="fav" data-id="${v.id}" aria-label="${v.fav ? 'Удалить из избранного' : 'Добавить в избранное'}" aria-pressed="${!!v.fav}">${bookmark}</button>` : ''}</div>
    ${v.is_active !== false && v.has_workplace_photo ? `<img class="vacancy-photo" src="/api/public/vacancies/${v.id}/workplace-photo" alt="Фото места работы" loading="lazy">` : ''}<h3><a class="vacancy-card-link" href="${vacancyUrl(v.id)}"><span>${esc(v.title)}</span></a></h3>
    <div class="tags">${tagsOf(v)}</div><p class="vacancy-excerpt">${esc(v.description || 'Подробнее о задачах и условиях — на странице вакансии.')}</p>
    <div class="vacancy-card-bottom"><span>${v.is_active === false ? 'Закрыта' : v.applied ? 'Отклик отправлен' : v.match != null ? esc(v.match) + '% совпадение' : v.created_at ? 'Опубликовано ' + new Date(v.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' }) : ''}</span><span class="vacancy-more" aria-hidden="true">Подробнее <span> </span></span></div>
    ${manage ? `<div class="vacancy-management"><span class="muted">Откликов: ${v.responses || 0}</span><div class="qa"><label class="btn sm file-btn">${v.has_workplace_photo ? 'Заменить фото' : 'Добавить фото'}<input type="file" accept="image/png,image/jpeg,image/webp" data-vphoto="${v.id}" aria-label="Фото места работы"></label><button class="btn sm" data-vdo="toggle" data-id="${v.id}">${v.is_active ? 'Закрыть' : 'Открыть'}</button><button class="btn sm" data-vdo="del" data-id="${v.id}">Удалить</button></div></div>` : ''}
  </article>`;
    const safeWebsite = value => {
        try { const u = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
    };
    const matchRow = v => v.match == null ? '' : `<div class="mrow"><span class="mpill ${v.match >= 70 ? 'hi' : ''}" style="--v:${v.match}"><b>${v.match}%</b> совпадение</span>${(v.why || []).map(w => `<span class="tag why">${esc(w)}</span>`).join('')}</div>`;
    const bub = (m, canDelete = false) => `<div class="msg ${m.mine ? 'me' : ''}" data-id="${m.id}">${m.reply_id ? `<div class="mq" data-goto="${m.reply_id}"><b>${m.reply_mine ? 'Вы' : 'Собеседник'}</b><span>${esc(m.reply_text || 'Сообщение недоступно')}</span></div>` : ''}<p>${esc(m.text)}</p><small>${when(m.created_at)}</small><button class="mreply" type="button" data-reply="${m.id}" aria-label="Ответить на сообщение" title="Ответить">↩</button>${canDelete ? `<button class="mdelete" type="button" data-delete-message="${m.id}" aria-label="Удалить сообщение" title="Удалить">×</button>` : ''}</div>`;
    function openDeleteMessage(ownMessage, trigger, onChoose) {
        const dialog = document.createElement('dialog');
        dialog.className = 'modal message-delete-dialog';
        dialog.setAttribute('aria-labelledby', 'message-delete-title');
        dialog.innerHTML = `<h3 id="message-delete-title">Удалить сообщение?</h3>
            <div class="del-opts">
                <button class="del-opt" data-message-scope="me" type="button"><b>Только у себя</b></button>
                ${ownMessage ? '<button class="del-opt danger" data-message-scope="all" type="button"><b>У всех</b></button>' : ''}
            </div>
            <div class="mact"><button class="btn" type="button" data-message-cancel autofocus>Отмена</button></div>`;
        document.body.appendChild(dialog);
        dialog.addEventListener('close', () => {
            dialog.remove();
            (trigger.isConnected ? trigger : $('#msg-form input'))?.focus({ preventScroll: true });
        });
        dialog.querySelector('[data-message-cancel]').onclick = () => dialog.close();
        dialog.addEventListener('click', async e => {
            const button = e.target.closest('[data-message-scope]');
            if (!button) return;
            const controls = [...dialog.querySelectorAll('button')];
            controls.forEach(control => control.disabled = true);
            try {
                await onChoose(button.dataset.messageScope);
                dialog.close();
            } catch (err) {
                controls.forEach(control => control.disabled = false);
                fail(err);
            }
        });
        dialog.showModal();
    }
    // ответ на конкретное сообщение: плашка над полем ввода, цитата в сообщении, переход к оригиналу по клику
    function useReply(msgsEl, form) {
        const bar = document.createElement('div'); bar.className = 'rbar'; bar.hidden = true; form.parentNode.insertBefore(bar, form);
        let cur = null;
        const set = m => {
            cur = m; bar.hidden = !m;
            if (m) { bar.innerHTML = `<div><b>${esc(m.who)}</b><span>${esc(m.text)}</span></div><button type="button" aria-label="Отменить ответ">✕</button>`; form.elements.text?.focus(); }
        };
        bar.addEventListener('click', e => { if (e.target.closest('button')) set(null); });
        msgsEl.addEventListener('click', e => {
            const r = e.target.closest('[data-reply]');
            if (r) { const el = r.closest('.msg'); set({ id: Number(el.dataset.id), who: el.classList.contains('me') ? 'Вы' : 'Собеседник', text: el.querySelector('p').textContent.slice(0, 120) }); return; }
            const q = e.target.closest('[data-goto]');
            if (q) { const t = msgsEl.querySelector(`.msg[data-id="${q.dataset.goto}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } }
        });
        return { get: () => cur ? cur.id : null, clear: () => set(null) };
    }
    // окно удаления чата: «только у меня» или «у обоих»
    function openDeleteChat({ title, onChoose }) {
        const bk = document.createElement('div'); bk.className = 'mbk';
        bk.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>Удалить чат?</h3><p class="lead">${esc(title)}</p>
      <div class="del-opts">
        <button class="del-opt" data-scope="me" type="button"><b>Удалить только у меня</b><span>Переписка пропадёт из вашего списка. У собеседника останется. Если придёт новое сообщение, чат появится снова.</span></button>
        <button class="del-opt danger" data-scope="both" type="button"><b>Удалить у обоих</b><span>Все сообщения будут стёрты безвозвратно — и у вас, и у собеседника.</span></button>
      </div><div class="mact"><button class="btn" id="del-cancel" type="button">Отмена</button></div></div>`;
        document.body.appendChild(bk);
        const close = () => { bk.remove(); removeEventListener('keydown', onKey); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        addEventListener('keydown', onKey);
        bk.addEventListener('click', async e => {
            if (e.target === bk) return close();
            const b = e.target.closest('[data-scope]'); if (!b) return;
            bk.querySelectorAll('button').forEach(x => x.disabled = true);
            try { await onChoose(b.dataset.scope); close(); } catch (err) { bk.querySelectorAll('button').forEach(x => x.disabled = false); fail(err); }
        });
        bk.querySelector('#del-cancel').onclick = close;
    }
    const mkPane = (el, url, empty, isCurrent) => {
        let last = 0, request = 0, previousHtml;
        return async reset => {
            const sequence = ++request;
            const d = await api(`${url}${url.includes('?') ? '&' : '?'}after=${reset || isCurrent ? 0 : last}`);
            if (isCurrent) {
                if (!isCurrent() || sequence !== request) return;
                const html = d.items.length ? d.items.map(m => bub(m, true)).join('') : empty;
                if (html !== previousHtml) {
                    const nearBottom = reset || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                    const scroll = el.scrollTop;
                    el.innerHTML = html;
                    previousHtml = html;
                    el.scrollTop = nearBottom ? el.scrollHeight : scroll;
                }
                return d;
            }
            if (reset) { el.innerHTML = ''; last = 0; }
            if (d.items.length) {
                const near = reset || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                el.querySelector('.empty')?.remove(); el.insertAdjacentHTML('beforeend', d.items.map(m => bub(m)).join(''));
                last = d.items[d.items.length - 1].id; if (near) el.scrollTop = el.scrollHeight;
            } else if (reset) el.innerHTML = empty;
            return d;
        };
    };
    const initTabs = onShow => {
        const panes = {}; $$('[data-pane]').forEach(p => panes[p.dataset.pane] = p);
        const names = Object.keys(panes), tabs = $$('.tab');
        const show = () => { const n = hashIn(names); tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === n)); names.forEach(k => panes[k].hidden = k !== n); onShow?.(n); };
        tabs.forEach(t => t.onclick = () => location.hash = t.dataset.tab);
        addEventListener('hashchange', show); show();
    };
    // графики и карточки дашбордов
    const bars = s => { const m = Math.max(1, ...s.map(x => x.n)); return `<div class="bars">${s.map(x => `<div class="bar"><b>${x.n}</b><i style="--h:${Math.round(x.n / m * 100)}%"></i><small>${x.label}</small></div>`).join('')}</div>`; };
    // карточка-счётчик; если задан href — карточка кликабельна (role: фильтр списка пользователей в админке)
    const statc = (n, l, d = 0, href = '', role = null) => href
        ? `<a class="card stat stat-link rise" style="--d:${d}s" href="${href}"${role !== null ? ` data-role="${role}"` : ''}><b data-count="${n}">0</b><small>${l}</small><i class="stat-go" aria-hidden="true">→</i></a>`
        : `<div class="card stat rise" style="--d:${d}s"><b data-count="${n}">0</b><small>${l}</small></div>`;
    const ring = v => `<div class="ring" style="--v:${v}"><b data-count="${v}" data-suffix="%">0</b></div>`;

    // ---- уведомления ----
    const LBL = { meet: 'Собеседование', pending: 'Заявка партнёра', reply: 'Новый отклик', invite: 'Приглашение', chat: 'Новое сообщение', ok: 'Хорошие новости', no: 'Ответ получен', help: 'Поддержка' };
    const kind = t => /ожидает одобрения/.test(t) ? 'pending' : /собеседован/.test(t) ? 'meet' : /сообщение/.test(t) ? 'chat' : /поддержк|обращени/.test(t) ? 'help' : /приглашает/.test(t) ? 'invite' : /принял|приняла|подтверждён|одобрена|оффер/.test(t) ? 'ok' : /отклонил/.test(t) ? 'no' : 'reply';
    function ntoast(n) {
        let box = $('.ntoasts'); if (!box) { box = document.createElement('div'); box.className = 'ntoasts'; document.body.appendChild(box); }
        const k = kind(n.text), el = document.createElement('a');
        el.className = 'ntoast'; el.href = n.link || '#';
        el.innerHTML = `<span class="nic">${icon(k === 'ok' || k === 'no' || k === 'help' ? k === 'help' ? 'help' : k : k)}</span><span class="nbody"><em>${LBL[k]}</em><span>${esc(n.text)}</span></span><button class="nx" aria-label="Закрыть">×</button>`;
        let t; const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 400); };
        const arm = ms => { clearTimeout(t); t = setTimeout(close, ms); };
        el.addEventListener('mouseenter', () => clearTimeout(t)); el.addEventListener('mouseleave', () => arm(2500));
        el.querySelector('.nx').onclick = e => { e.preventDefault(); e.stopPropagation(); close(); };
        box.appendChild(el); while (box.children.length > 3) box.firstChild.remove(); arm(6500);
    }
    function initBell() {
        const w = document.createElement('div'); w.className = 'bell-wrap';
        w.innerHTML = `<button class="theme" aria-label="Уведомления">${icon('bell')}<i class="badge" hidden></i></button>
      <div class="npanel"><div class="nhead"><b>Уведомления</b><span class="nchip" hidden></span></div><div class="nlist"></div><a class="nfoot" href="/pages/chat.html"><span>Открыть чаты</span><span>→</span></a></div>`;
        $('.right').insertBefore(w, $('#theme'));
        const btn = w.querySelector('button'), panel = w.querySelector('.npanel'), list = w.querySelector('.nlist'), badge = w.querySelector('.badge'), chip = w.querySelector('.nchip');
        let items = [], maxId = null; const fresh = new Set();
        const isNew = n => !n.is_read || fresh.has(n.id);
        const row = n => { const k = kind(n.text); return `<a class="nitem ${isNew(n) ? 'unread' : ''}" href="${esc(n.link || '#')}"><span class="nic">${icon(k)}</span><span class="nbody"><em>${LBL[k]}</em><span>${esc(n.text)}</span><small>${ago(n.created_at)}</small></span></a>`; };
        const render = () => {
            const nw = items.filter(isNew), old = items.filter(n => !isNew(n));
            chip.hidden = !nw.length; chip.textContent = nw.length + ' нов.';
            list.innerHTML = items.length ? (nw.length ? `<div class="nsec">Новые</div>${nw.map(row).join('')}` : '') + (old.length ? `<div class="nsec">Ранее</div>${old.map(row).join('')}` : '')
                : `<div class="nempty"><span class="nic">${icon('bell')}</span><b>Пока тихо</b><small>Здесь появятся отклики, приглашения и сообщения</small></div>`;
        };
        async function poll() {
            try {
                const d = await api('/api/notifications'); items = d.items; badge.hidden = !d.unread;
                if (maxId !== null) items.filter(n => n.id > maxId && !n.is_read).reverse().forEach(ntoast);
                maxId = Math.max(maxId ?? 0, items.length ? items[0].id : 0); render();
            } catch { }
        }
        const closePanel = () => { panel.classList.remove('open'); fresh.clear(); render(); };
        btn.onclick = async e => {
            e.stopPropagation();
            if (panel.classList.contains('open')) return closePanel();
            items.forEach(n => { if (!n.is_read) fresh.add(n.id); });
            panel.classList.add('open'); render();
            if (fresh.size) { badge.hidden = true; await api('/api/notifications/read', { method: 'POST' }).catch(() => { }); }
        };
        document.addEventListener('click', e => { if (!w.contains(e.target) && panel.classList.contains('open')) closePanel(); });
        poll(); setInterval(poll, 10000); setInterval(render, 60000);
    }

    // ---- воронка: общие вставки ----
    const placeHtml = p => !p ? '' : /^https?:\/\/\S+$/i.test(p) ? `<a href="${esc(p)}" target="_blank" rel="noopener">${esc(p)}</a>` : esc(p);
    const STEPS = ['Отправлен', 'Собеседование', 'Оффер', 'Принят'];
    const stepper = a => a.status === 'declined' ? '<div class="steps bad"><span>Отказ</span></div>'
        : `<div class="steps">${STEPS.map((t, k) => `<span class="${k <= { new: 0, interview: 1, offer: 2, accepted: 3 }[a.status] ? 'on' : ''}">${t}</span>`).join('')}</div>`;
    const ivBlock = a => !a.interview ? '' : `<div class="kiv"><b>Собеседование: ${when(a.interview.scheduled_at)}</b> · ${a.interview.format === 'office' ? 'в офисе' : 'онлайн'}${a.interview.place ? '<br>' + placeHtml(a.interview.place) : ''}${a.interview.note ? '<br><small>' + esc(a.interview.note) + '</small>' : ''}
    <div class="acts" style="margin-top:10px">${a.interview.status === 'proposed' ? `<button class="btn primary sm" data-ivdo="confirmed" data-id="${a.interview.id}">Подтвердить</button><button class="btn sm" data-ivdo="reschedule" data-id="${a.interview.id}">Попросить перенос</button>` : `<span class="tag">${{ confirmed: 'Подтверждено', reschedule: 'Просили перенос' }[a.interview.status] || ''}</span>`}</div></div>`;

    // ---- сопроводительное письмо ----
    let pcache = null;
    const coverTpl = (p, title) => `Здравствуйте!\n\nМеня зовут ${p.full_name || '…'}${p.age ? ', мне ' + p.age : ''}. ${p.university ? 'Учусь в ' + p.university : 'Учусь'}${p.specialty ? ' по направлению «' + p.specialty + '»' : ''}. Меня заинтересовала вакансия «${title}».\n\n${p.skills ? 'Мои навыки: ' + p.skills + '.\n\n' : ''}${p.desired_experience ? 'Хочу получить опыт: ' + p.desired_experience + '.\n\n' : ''}Буду рад(а) возможности поработать в вашей команде и быстро научиться. Спасибо за внимание!`;
    function openApply(id, title, onDone) {
        const active = document.activeElement, oldOverflow = document.body.style.overflow;
        const bk = document.createElement('div'); bk.className = 'mbk';
        bk.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="apply-title"><h3 id="apply-title">Отклик на «${esc(title)}»</h3>
      <p class="lead">Сопроводительное письмо помогает выделиться — расскажите, почему вам интересна вакансия. Это необязательно.</p>
      <textarea aria-label="Сопроводительное письмо" maxlength="1500" placeholder="Здравствуйте! Меня зовут…"></textarea>
      <div class="mcount"><button type="button" class="linkbtn" id="mtpl">Вставить шаблон из профиля</button><span><b id="mn">0</b> / 1500</span></div>
      <div class="mact"><button class="btn" id="mcancel" type="button">Отмена</button><button class="btn primary" id="msend" type="button">Отправить отклик</button></div></div>`;
        document.body.appendChild(bk);
        document.body.style.overflow = 'hidden';
        const ta = bk.querySelector('textarea'), close = () => { bk.remove(); document.body.style.overflow = oldOverflow; removeEventListener('keydown', onKey); active?.focus({ preventScroll: true }); };
        const onKey = e => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                const els = [...bk.querySelectorAll('button:not(:disabled),textarea')], first = els[0], last = els[els.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        addEventListener('keydown', onKey); ta.focus();
        ta.oninput = () => { bk.querySelector('#mn').textContent = ta.value.length; };
        bk.addEventListener('click', e => { if (e.target === bk) close(); });
        bk.querySelector('#mcancel').onclick = close;
        bk.querySelector('#mtpl').onclick = async () => { try { pcache = pcache || await api('/api/profile'); ta.value = coverTpl(pcache, title); ta.oninput(); } catch (e) { fail(e); } };
        bk.querySelector('#msend').onclick = async e => {
            const btn = e.currentTarget, r = btn.getBoundingClientRect(); btn.disabled = true;
            try { const result = await api('/api/apply/' + id, { method: 'POST', body: { cover_letter: ta.value } }); close(); onDone(result); }
            catch (err) { btn.disabled = false; fail(err); if (err.message.includes('профиль')) setTimeout(() => location.href = '/pages/account.html#profile', 1400); }
        };
    }
    // ссылки портфолио: только http(s)
    const linkify = s => String(s).split(/[\s,;]+/).filter(Boolean).map(t => {
        try { const u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); if (!/^https?:$/.test(u.protocol)) throw 0; return `<a href="${esc(u.href)}" target="_blank" rel="noopener">${esc(t)}</a>`; }
        catch { return esc(t); }
    }).join(' · ');

    async function main() {
        let me = null;
        if (token()) { try { me = await api('/api/me'); localStorage.setItem('role', me.role); } catch { if (!['home', 'vacancies', 'partners', 'help', 'vacancy', 'company-profile'].includes(page)) return; } }
        const rule = GUARD[page];
        if (rule) { if (!me) { sessionStorage.setItem('authReturn', location.pathname + location.search + location.hash); return location.href = '/pages/login.html'; } if (!rule.includes(me.role)) return location.href = cabinet(); }
        const allowedReturn = value => {
            if (typeof value !== 'string') return null;
            if (/^\/pages\/(vacancies|support)\.html(?:#[a-z0-9_-]+)?$/i.test(value)) return value;
            if (/^\/pages\/account\.html(?:\?hint=profile(?:&field=(?:age|education|university|specialty|work_history|desired_experience))?)?#(?:profile|security)$/i.test(value)) return value;
            return /^\/pages\/(vacancy|company-profile|student-profile)\.html\?id=(?:[1-9]\d*|me)$/i.test(value) ? value : null;
        };
        const queryReturn = allowedReturn(new URLSearchParams(location.search).get('next'));
        if (queryReturn) sessionStorage.setItem('authReturn', queryReturn);
        const afterAuth = () => {
            const target = allowedReturn(sessionStorage.getItem('authReturn'));
            sessionStorage.removeItem('authReturn');
            return target || cabinet();
        };
        if (['login', 'register', 'forgot'].includes(page) && me) return location.href = afterAuth();
        if (page === 'profile') return location.href = '/pages/account.html#profile';
        $$('[data-profile-link]').forEach(a => { a.href = me ? (me.role === 'admin' ? cabinet() : '/pages/account.html#profile') : '/pages/register.html'; });
        $$('[data-signup-link]').forEach(a => { if (me) a.href = cabinet(); });
        const flash = sessionStorage.getItem('flash'); if (flash) { sessionStorage.removeItem('flash'); toast(flash); }
        const profileHint = page === 'account' && new URLSearchParams(location.search).get('hint') === 'profile';
        const profileHintField = new URLSearchParams(location.search).get('field');
        if (profileHint) {
            history.replaceState(null, '', location.pathname + (location.hash || '#profile'));
            toast('Добавьте данные в профиле.');
            $('.toast')?.classList.add('profile-hint');
        }

        // ---- шапка, нижняя панель, баннер ----
        const ab = $('#auth-btn'), reg = $('#reg-btn'), links = $('.links');
        if (me) {
            const home = page === 'home' || ['partners', 'about', 'directions', 'faq'].includes(page);
            const accLink = me.role === 'admin' ? '/pages/account.html#security' : '/pages/account.html#profile';
            const tabs = [...NAV[me.role], ['account', 'Аккаунт', accLink, 'user']];
            if (home) { ab.textContent = 'Кабинет'; ab.href = cabinet(); if (reg) reg.remove(); }
            else {
                ab.remove();
                links.innerHTML = '<a class="mh" href="/">Главная</a>' + NAV[me.role].map(([k, l, h]) => `<a href="${h}" class="${k === page ? 'on' : ''}">${l}</a>`).join('');
                const um = document.createElement('div'); um.className = 'umenu';
                const lab = { student: 'Студент', company: 'Компания', admin: 'Администратор' }[me.role];
                const mi = (h, i, t) => `<a href="${h}">${icon(i)}<span>${t}</span></a>`;
                const avatarButton = me.avatar ? avatarImage(me.avatar, 'uavatar-img') : esc(me.email[0].toUpperCase());
                um.innerHTML = `<button class="uavatar" aria-label="Меню профиля">${avatarButton}</button>
          <div class="udrop"><div class="uhead"><b>${lab}</b><small>${esc(me.email)}</small></div>
          ${mi('/', 'home', 'На главную')}${me.role === 'admin' ? '' : mi(accLink, 'user', me.role === 'company' ? 'Редактировать профиль' : 'Редактирование профиля')}${me.id && me.role !== 'admin' ? mi(me.role === 'company' ? companyUrl(me.id) : studentUrl(me.id), 'user', 'Посмотреть профиль') : ''}${mi('/pages/account.html#security', 'lock', 'Безопасность')}${me.role === 'admin' ? '' : mi('/pages/support.html', 'help', 'Поддержка')}<hr>
          <button class="ul" id="logout">${icon('out')}<span>Выйти</span></button></div>`;
                const br = $('.burger'); br ? $('.right').insertBefore(um, br) : $('.right').appendChild(um);
                const dd = um.querySelector('.udrop');
                um.querySelector('.uavatar').onclick = e => { e.stopPropagation(); dd.classList.toggle('open'); };
                document.addEventListener('click', e => { if (!um.contains(e.target)) dd.classList.remove('open'); });
                um.querySelector('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }).catch(() => { }); localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = '/'; };
            }
            const tb = document.createElement('nav'); tb.className = 'tabbar';
            tb.innerHTML = tabs.map(([k, l, h, i]) => `<a href="${h}" class="${k === page ? 'on' : ''}">${icon(i)}<span>${l}</span></a>`).join('');
            document.body.appendChild(tb); document.body.classList.add('hastab');
            const pend = me.role === 'company' && !me.approved;
            if ((pend && page !== 'support') || (!pend && !me.verified && page !== 'verify')) {
                const b = document.createElement('div'); b.className = 'vbanner';
                b.innerHTML = pend ? 'Аккаунт компании проверяется: пока доступен только просмотр и чат с поддержкой. <a href="/pages/support.html">Оставить заявку</a>'
                    : 'Подтвердите email, чтобы откликаться и писать сообщения <a href="/pages/verify.html">Подтвердить</a>';
                document.body.appendChild(b);
            }
            initBell();
        }

        // ---- главная: живые цифры ----
        if (page === 'home') {
            fetch('/api/public/stats').then(r => { if (!r.ok) throw new Error('Статистика недоступна'); return r.json(); }).then(s => {
                for (const [k, v] of Object.entries(s)) { const el = $('#n-' + k); if (el) el.dataset.count = v; }
                watchCounts($('#numbers'));
            }).catch(() => { });
            const partners = $('#home-partners-list'), more = $('#partners-more'), retry = $('#partners-retry'), status = $('#partners-status');
            let offset = 0, loading = false;
            const countText = (n, words) => { const x = Math.abs(n) % 100, y = x % 10; return words[x > 10 && x < 20 ? 2 : y === 1 ? 0 : y > 1 && y < 5 ? 1 : 2]; };
            const partnerCard = c => {
                const responses = Math.max(0, Number(c.responses) || 0), vacancies = Math.max(0, Number(c.active_vacancies) || 0);
                return `<a class="partner-card card" href="${companyUrl(c.user_id)}"><div class="partner-card-top"><span class="partner-arrow" aria-hidden="true"> </span></div><h4>${esc(c.name)}</h4><p class="partner-meta">${[c.industry, c.city].filter(Boolean).map(esc).join(' · ') || 'Компания-партнёр платформы'}</p><div class="partner-count"><b>${responses.toLocaleString('ru-RU')}</b><span>${countText(responses, ['полученный отклик', 'полученных отклика', 'полученных откликов'])}</span></div><div class="partner-card-bottom"><span>${vacancies.toLocaleString('ru-RU')} ${countText(vacancies, ['открытая вакансия', 'открытые вакансии', 'открытых вакансий'])}</span><span>Профиль компании →</span></div></a>`;
            };
            async function loadPartners() {
                if (loading || offset === null) return;
                loading = true; partners.setAttribute('aria-busy', 'true'); more.disabled = true; retry.hidden = true; status.textContent = '';
                try {
                    const r = await fetch('/api/public/companies?offset=' + offset);
                    if (!r.ok) throw new Error('Не удалось загрузить компании');
                    const d = await r.json(); if (!Array.isArray(d.items)) throw new Error('Некорректный ответ сервера');
                    if (offset === 0) partners.innerHTML = '';
                    partners.insertAdjacentHTML('beforeend', d.items.map(partnerCard).join(''));
                    if (!partners.children.length) partners.innerHTML = '<p class="partners-status">Проверенные компании скоро появятся здесь.</p>';
                    offset = Number.isSafeInteger(d.nextOffset) && d.nextOffset >= 0 ? d.nextOffset : null;
                    more.hidden = offset === null; status.textContent = `Показано компаний: ${partners.querySelectorAll('.partner-card').length}`;
                } catch (err) {
                    if (!partners.querySelector('.partner-card')) partners.innerHTML = '<p class="partners-status">Список компаний временно недоступен.</p>';
                    status.textContent = 'Попробуйте загрузить список ещё раз.'; retry.hidden = false; more.hidden = true;
                } finally { loading = false; more.disabled = false; partners.setAttribute('aria-busy', 'false'); }
            }
            more.onclick = retry.onclick = loadPartners; loadPartners();
        }

        // ---- вход / регистрация ----
        const af = $('#auth-form');
        if (af) {
            const rt = $('#role-tabs');
            if (rt) {
                const set = r => { $$('#role-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.role === r)); af.elements.role.value = r; $('#company-name').hidden = r !== 'company'; af.elements.name.required = r === 'company'; };
                rt.onclick = e => { const b = e.target.closest('.tab'); if (b) set(b.dataset.role); };
                set(new URLSearchParams(location.search).get('role') === 'company' ? 'company' : 'student');
            }
            af.addEventListener('submit', async e => {
                e.preventDefault();
                const btn = af.querySelector('button.btn'); btn.disabled = true;
                try {
                    const d = await api(af.dataset.url, { method: 'POST', body: Object.fromEntries(new FormData(af)) });
                    localStorage.setItem('token', d.token); localStorage.setItem('role', d.role);
                    if (typeof d.codeSent === 'boolean') sessionStorage.setItem('verificationDelivery', d.codeSent ? 'sent' : 'failed');
                    location.href = d.verified ? afterAuth() : '/pages/verify.html';
                } catch (err) { fail(err); btn.disabled = false; }
            });
        }

        // ---- подтверждение email ----
        const vf = $('#verify-form');
        if (vf) {
            if (me.verified) return location.href = afterAuth();
            $('#vemail').textContent = me.email;
            const delivery = sessionStorage.getItem('verificationDelivery');
            sessionStorage.removeItem('verificationDelivery');
            const status = $('#verification-status');
            const sent = () => { status.textContent = 'Код отправлен. Проверьте входящие и папку «Спам».'; };
            if (delivery === 'sent') sent();
            if (delivery === 'failed') status.textContent = 'Аккаунт создан. Письмо пока не удалось отправить. Нажмите «Запросить код», чтобы повторить попытку.';
            const rb = $('#resend');
            let cd = delivery === 'sent' ? 60 : 0;
            const tick = () => {
                rb.disabled = cd > 0;
                rb.textContent = cd > 0 ? `Запросить код (${cd} с)` : 'Запросить код';
                if (cd > 0) { cd--; setTimeout(tick, 1000); }
            };
            tick();
            rb.onclick = async () => {
                rb.disabled = true;
                try {
                    const d = await api('/api/verify/send', { method: 'POST' });
                    if (d.verified) return location.href = afterAuth();
                    sent();
                    cd = 60;
                    tick();
                } catch (err) {
                    status.textContent = err.message;
                    rb.disabled = false;
                }
            };
            vf.addEventListener('submit', async e => {
                e.preventDefault();
                try { await api('/api/verify/confirm', { method: 'POST', body: { code: vf.elements.code.value } }); toast('Email подтверждён ✓'); setTimeout(() => location.href = afterAuth(), 1100); }
                catch (err) { fail(err); }
            });
        }

        // ---- восстановление пароля ----
        const f1 = $('#f1');
        if (f1) {
            const f2 = $('#f2'); let email = '';
            f1.addEventListener('submit', async e => {
                e.preventDefault(); email = f1.elements.email.value;
                try {
                    await api('/api/password/forgot', { method: 'POST', body: { email } });
                    f1.hidden = true; f2.hidden = false; toast('Если такой email есть, мы отправили код');
                } catch (err) { fail(err); }
            });
            f2.addEventListener('submit', async e => {
                e.preventDefault();
                try { await api('/api/password/reset', { method: 'POST', body: { email, code: f2.elements.code.value, password: f2.elements.password.value } }); toast('Пароль изменён — войдите заново'); setTimeout(() => location.href = '/pages/login.html', 1300); }
                catch (err) { fail(err); }
            });
        }

        // ---- аккаунт ----
        const pw = $('#pw-form');
        if (pw) {
            if (me.role !== 'student') $('#student-box').remove();
            if (me.role !== 'company') $('#company-box').remove();
            if (me.role === 'admin') { $('[data-tab=profile]').remove(); $('[data-pane=profile]').remove(); }
            initTabs();
            const acf = $('#company-form');
            if (acf) {
                if (!me.approved) { acf.querySelectorAll('input,textarea,button').forEach(x => x.disabled = true); acf.insertAdjacentHTML('afterbegin', '<div class="devhint">Редактирование откроется после одобрения аккаунта администратором.</div>'); }
                api('/api/company').then(c => { for (const [k, v] of Object.entries(c)) if (acf.elements[k] && v != null) acf.elements[k].value = v; }).catch(fail);
                acf.addEventListener('submit', async e => { e.preventDefault(); try { await api('/api/company', { method: 'PUT', body: Object.fromEntries(new FormData(acf)) }); toast('Профиль компании сохранён ✓'); } catch (err) { fail(err); } });
            }
            $('#acc-info').textContent = `${me.email} · ${{ student: 'студент', company: 'компания', admin: 'администратор' }[me.role]}`;
            $('#vstat').innerHTML = me.verified ? '<span class="ok">✓ Email подтверждён</span>' : 'Email не подтверждён. <a class="linkbtn" href="/pages/verify.html">Подтвердить сейчас</a>';
            pw.addEventListener('submit', async e => {
                e.preventDefault();
                const f = pw.elements;
                if (f.next.value !== f.again.value) return toast('Новые пароли не совпадают');
                try { await api('/api/password/change', { method: 'POST', body: { current: f.current.value, next: f.next.value } }); pw.reset(); toast('Пароль изменён ✓'); } catch (err) { fail(err); }
            });
        }

        // ---- дашборд ----
        const dash = $('#dash');
        if (dash) {
            try {
                const d = await api('/api/dashboard');
                const hello = (t, p) => `<div class="rise"><span class="eyebrow">Обзор</span><h2>${t}</h2><p class="lead">${p}</p></div>`;
                if (d.kind === 'student') {
                    const picksHtml = d.picks.length ? d.picks.map(v => `<a class="mini" href="${vacancyUrl(v.id)}"><span>${esc(v.title)}<br><small>${esc(v.company)}${v.why.length ? ' · ' + esc(v.why[0]) : ''}</small></span><span class="mpill ${v.match >= 70 ? 'hi' : ''}" style="--v:${v.match}"><b>${v.match}%</b></span></a>`).join('')
                        : '<p style="color:var(--muted);margin-bottom:14px">Добавьте навыки и желаемый опыт в профиле — подберём вакансии с процентом совпадения.</p><a class="btn sm" href="/pages/account.html#profile">Заполнить профиль</a>';
                    const rec = d.recent.length ? d.recent.map(a => `<div class="mini"><span>${esc(a.title)}<br><small>${esc(a.company)} · ${a.direction === 'company_to_student' ? 'приглашение' : 'отклик'}</small></span><span class="tag">${ST[a.status] || a.status}</span></div>`).join('') : '<p class="empty" style="padding:20px 0">Пока пусто — откликнитесь на первую вакансию</p>';
                    dash.innerHTML = hello(`Привет, ${esc(d.name || 'студент')}`, 'Вот что происходит с вашими откликами и профилем.') + `<div class="dash">
            <div class="dtop"><div class="card rise" style="text-align:center;--d:.05s"><h4>Заполненность профиля</h4>${ring(d.completeness)}
              <p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">${d.completeness < 100 ? 'Чем полнее анкета, тем чаще вас находят компании.' : 'Отлично, профиль полностью заполнен!'}</p>
              <a class="btn primary sm" href="/pages/account.html#profile">${d.completeness < 100 ? 'Дополнить' : 'Открыть профиль'}</a></div>
              <div class="stats4 s2">${statc(d.stats.responses, 'Мои отклики', .1, '/pages/vacancies.html#mine')}${statc(d.stats.offers, 'Новые предложения', .15, '/pages/vacancies.html#offers')}${statc(d.stats.accepted, 'Принято', .2, '/pages/vacancies.html#mine')}${statc(d.stats.favs, 'В избранном', .25, '/pages/vacancies.html')}</div></div>
            <div class="card rise" style="--d:.28s"><h4>Подобрано для вас</h4>${picksHtml}</div>
            <div class="dcols"><div class="card rise" style="--d:.3s"><h4>Отклики за 7 дней</h4>${bars(d.series)}</div><div class="card rise" style="--d:.35s"><h4>Последняя активность</h4>${rec}</div></div>
            <div class="qa rise" style="--d:.4s"><a class="btn primary" href="/pages/vacancies.html">Найти вакансии</a><a class="btn" href="/pages/resume.html#me">Резюме в PDF</a><a class="btn" href="/pages/chat.html">Открыть чаты</a><a class="btn" href="/pages/support.html">Поддержка</a></div></div>`;
                } else if (d.kind === 'company') {
                    const top = d.top.length ? d.top.map(v => `<a class="mini" href="${vacancyUrl(v.id)}"><span>${esc(v.title)}<br><small>${v.is_active ? 'активна' : 'закрыта'}</small></span><span class="tag">${v.responses} откл.</span></a>`).join('') : '<p class="empty" style="padding:20px 0">Опубликуйте первую вакансию</p>';
                    dash.innerHTML = hello(esc(d.name || 'Ваша компания'), 'Сводка по вакансиям, откликам и приглашениям.') + `<div class="dash">
            <div class="stats4">${statc(d.stats.vacancies, 'Активных вакансий', .05, '/pages/company.html#vacancies')}${statc(d.stats.responses, 'Откликов', .1, '/pages/company.html#responses')}${statc(d.stats.invites, 'Приглашений', .15, '/pages/company.html#responses')}${statc(d.stats.accepted, 'Принято', .2, '/pages/company.html#responses')}</div>
            <div class="dcols"><div class="card rise" style="--d:.25s"><h4>Отклики за 7 дней</h4>${bars(d.series)}</div><div class="card rise" style="--d:.3s"><h4>Лучшие вакансии</h4>${top}</div></div>
            ${me.approved ? '<div class="qa rise" style="--d:.35s"><a class="btn primary" href="/pages/company.html#vacancies">Новая вакансия</a><a class="btn" href="/pages/company.html#students">Найти студентов</a><a class="btn" href="/pages/company.html#responses">Отклики</a></div>'
                            : '<div class="card rise" style="--d:.35s"><h4>Статус заявки</h4><p style="margin-bottom:16px;color:var(--muted)">Мы проверяем вашу компанию. Опишите её в чате поддержки — после проверки откроются вакансии и приглашения студентов.</p><a class="btn primary" href="/pages/support.html">Оставить заявку</a></div>'}</div>`;
                }
                watchCounts(dash);
            } catch (e) { fail(e); }
        }

        // ---- резюме ----
        if (page === 'resume') {
            const paper = $('#paper');
            $('#rback').onclick = () => history.length > 1 ? history.back() : location.href = cabinet();
            $('#rprint').onclick = () => window.print();
            try {
                const p = await api('/api/resume/' + encodeURIComponent(location.hash.slice(1) || 'me'));
                const sec = (t, h) => h ? `<h3>${t}</h3>${h}` : '';
                const skills = String(p.skills || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
                const avatarHtml = p.avatar ? avatarImage(p.avatar, 'resume-avatar', 'Аватар ' + (p.full_name || 'студента')) : '';
                paper.innerHTML = `<header>${avatarHtml}<h1>${esc(p.full_name || 'Без имени')}</h1>
          <p class="rrole">${[p.specialty, p.education].filter(Boolean).map(esc).join(' · ') || 'Студент'}</p>
          <div class="rcontacts">${[esc(p.email), p.city && esc(p.city), p.age && p.age + ' лет'].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</div></header>
          ${sec('О себе', p.about && `<p>${esc(p.about)}</p>`)}
          ${sec('Образование', (p.university || p.education || p.specialty) && `<p>${[p.university, p.education, p.specialty].filter(Boolean).map(esc).join('\n')}</p>`)}
          ${sec('Навыки', skills.length && `<div class="skills">${skills.map(x => `<span>${esc(x)}</span>`).join('')}</div>`)}
          ${sec('Опыт работы', p.work_history && `<p>${esc(p.work_history)}</p>`)}
          ${sec('Хочу получить опыт', p.desired_experience && `<p>${esc(p.desired_experience)}</p>`)}
          ${sec('Портфолио', p.portfolio && `<p>${linkify(p.portfolio)}</p>`)}
          <div class="rfoot">Резюме создано на платформе «Первый шаг» · ${new Date().toLocaleDateString('ru')}</div>`;
                document.title = `Резюме — ${p.full_name || 'студент'}`;
            } catch (e) { paper.innerHTML = `<p class="empty">${esc(e.message)}</p>`; $('#rprint').disabled = true; }
        }

        const readData = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });

        const mediaPrefix = me?.role === 'company' ? 'company-' : '';
        const avatarInput = $('#' + mediaPrefix + 'avatar-file');
        if (avatarInput) {
            const preview = $('#' + mediaPrefix + 'avatar-preview');
            const updateAvatar = url => {
                if (!url) return;
                preview.innerHTML = avatarImage(url, '', me.role === 'company' ? 'Аватар компании' : 'Аватар профиля');
                const menu = $('.uavatar');
                if (menu) menu.innerHTML = avatarImage(url, 'uavatar-img');
            };
            updateAvatar(me.avatar);
            avatarInput.addEventListener('change', async () => {
                const file = avatarInput.files[0];
                if (!file) return;
                avatarInput.disabled = true;
                try {
                    let data;
                    if (file.size <= 600 * 1024) {
                        data = await readData(file);
                    } else {
                        const image = await createImageBitmap(file);
                        try {
                            const scale = Math.min(1, 512 / Math.max(image.width, image.height));
                            const canvas = document.createElement('canvas');
                            canvas.width = Math.max(1, Math.round(image.width * scale));
                            canvas.height = Math.max(1, Math.round(image.height * scale));
                            const context = canvas.getContext('2d');
                            context.fillStyle = '#fff';
                            context.fillRect(0, 0, canvas.width, canvas.height);
                            context.drawImage(image, 0, 0, canvas.width, canvas.height);
                            data = canvas.toDataURL('image/jpeg', .86);
                        } finally {
                            image.close();
                        }
                    }
                    const result = await api('/api/profile/avatar', { method: 'POST', body: { data } });
                    updateAvatar(result.avatar);
                    toast('Аватар обновлён ✓');
                } catch (err) {
                    fail(err);
                } finally {
                    avatarInput.value = '';
                    avatarInput.disabled = false;
                }
            });

            const docs = $('#' + mediaPrefix + 'document-list');
            const docInput = $('#' + mediaPrefix + 'document-file');
            const loadDocs = async () => {
                const rows = await api('/api/profile/documents');
                docs.innerHTML = rows.length ? rows.map(d => `<div class="document-item"><button type="button" class="linkbtn" data-download="${d.id}">${esc(d.name)}</button><button type="button" class="doc-remove" data-remove="${d.id}" aria-label="Удалить ${esc(d.name)}">×</button></div>`).join('') : '<span class="muted">Документы ещё не загружены</span>';
            };
            loadDocs().catch(fail);
            docInput.addEventListener('change', async () => {
                const file = docInput.files[0];
                if (!file) return;
                docInput.disabled = true;
                try {
                    await api('/api/profile/documents', { method: 'POST', body: { data: await readData(file), name: file.name } });
                    await loadDocs();
                    toast('PDF добавлен');
                } catch (err) { fail(err); }
                finally { docInput.value = ''; docInput.disabled = false; }
            });
            docs.addEventListener('click', async e => {
                const button = e.target.closest('button');
                if (!button) return;
                button.disabled = true;
                try {
                    if (button.dataset.download) {
                        await downloadPdf('/api/profile/documents/' + button.dataset.download, button.textContent);
                    } else {
                        await api('/api/profile/documents/' + button.dataset.remove, { method: 'DELETE' });
                        await loadDocs();
                        toast('Документ удалён');
                    }
                } catch (err) { fail(err); }
                finally { button.disabled = false; }
            });
        }

        // ---- профиль студента ----
        const pf = $('#profile-form');
        if (pf && me.role === 'student') {
            api('/api/profile').then(p => {
                if ($('#email')) $('#email').textContent = p.email;
                for (const [k, v] of Object.entries(p)) if (pf.elements[k] && v != null) pf.elements[k].value = v;
                if (profileHint && ['age', 'education', 'university', 'specialty', 'work_history', 'desired_experience'].includes(profileHintField)) {
                    pf.elements[profileHintField]?.focus({ preventScroll: false });
                }
            }).catch(fail);
            pf.addEventListener('submit', async e => {
                e.preventDefault();
                try { await api('/api/profile', { method: 'PUT', body: Object.fromEntries(new FormData(pf)) }); toast('Профиль сохранён ✓'); } catch (err) { fail(err); }
            });
            const enrollmentFile = $('#enrollment-file'), enrollmentStatus = $('#enrollment-status');
      const showEnrollment = record => { if (!enrollmentStatus) return; const canReplace = !record || record.status === 'rejected'; enrollmentFile.disabled = !canReplace; enrollmentStatus.textContent = !record ? 'Справка из колледжа или вуза, PDF до 5 МБ. Файл доступен администратору.' : record.status === 'approved' ? '✓ Обучение подтверждено администратором' : record.status === 'rejected' ? 'Справка отклонена. Можно отправить новую.' : 'Справка отправлена и ожидает проверки администратора.'; };
            api('/api/profile/enrollment').then(showEnrollment).catch(() => { });
            enrollmentFile?.addEventListener('change', async () => { const file = enrollmentFile.files[0]; if (!file) return; try { const record = await api('/api/profile/enrollment', { method: 'POST', body: { data: await readData(file), name: file.name } }); showEnrollment(record); toast('Справка отправлена на проверку ✓'); } catch (err) { fail(err); } finally { enrollmentFile.value = ''; } });
        }

        // ---- общий вход для действий в публичном каталоге ----
        function authGate(vacancyId, intent = 'apply') {
            if (document.querySelector('.auth-gate')) return;
            const returnTo = vacancyId ? vacancyUrl(vacancyId) : '/pages/vacancies.html';
            sessionStorage.setItem('authReturn', returnTo);
            if (vacancyId) sessionStorage.setItem('vacancyIntent', JSON.stringify({ id: String(vacancyId), action: intent }));
            const active = document.activeElement;
            const dialog = document.createElement('dialog'); dialog.className = 'auth-gate';
            dialog.setAttribute('aria-labelledby', 'auth-gate-title');
            dialog.innerHTML = `<button class="theme gate-close" aria-label="Закрыть"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><span class="eyebrow">Всего один шаг</span><h2 id="auth-gate-title">Сохраните свой шанс</h2><p>Вакансии можно смотреть без регистрации. Чтобы откликаться, сохранять понравившиеся варианты и получать предложения, нужен аккаунт студента.</p><div class="gate-actions"><a class="btn primary" href="/pages/register.html?next=${encodeURIComponent(returnTo)}">Создать аккаунт</a><a class="btn" href="/pages/login.html?next=${encodeURIComponent(returnTo)}">Уже есть аккаунт? Войти</a></div><button class="linkbtn gate-cancel">Пока продолжить просмотр</button>`;
            document.body.appendChild(dialog);
            const close = () => dialog.close();
            dialog.querySelector('.gate-close').onclick = close;
            dialog.querySelector('.gate-cancel').onclick = close;
            dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } });
            dialog.addEventListener('close', () => { sessionStorage.removeItem('vacancyIntent'); sessionStorage.removeItem('authReturn'); dialog.remove(); active?.focus(); });
            dialog.showModal();
        }

        // ---- отдельные страницы вакансии, компании и студента ----
        const detailRoot = $('#vacancy-detail'), profileRoot = $('#entity-profile');
        const entityId = new URLSearchParams(location.search).get('id');
        const validEntityId = /^[1-9]\d*$/.test(entityId || '') || (page === 'student-profile' && entityId === 'me');
        const renderEntityError = (root, err, retry) => {
            root.setAttribute('aria-busy', 'false');
            root.innerHTML = `<div class="entity-error card"><span class="eyebrow">Не удалось открыть страницу</span><h1>${esc(err.message || 'Ошибка загрузки')}</h1><p>Проверьте ссылку или попробуйте ещё раз.</p><div class="qa"><a class="btn" href="/pages/vacancies.html">К вакансиям</a>${retry ? '<button class="btn primary" data-retry>Повторить</button>' : ''}</div></div>`;
            root.querySelector('[data-retry]')?.addEventListener('click', retry);
        };
        const facts = rows => `<dl class="entity-facts">${rows.filter(([, v]) => v != null && String(v).trim()).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
        async function loadVacancy() {
            detailRoot.setAttribute('aria-busy', 'true');
            try {
                const v = await api((me ? '/api/vacancies/' : '/api/public/vacancies/') + entityId);
                document.title = `${v.title} — Первый шаг`;
                const isStudent = me?.role === 'student', active = v.is_active !== false;
                const action = !me ? '<button class="btn primary" id="vacancy-apply">Откликнуться</button>' : isStudent ? `<button class="btn ${v.applied || !active ? '' : 'primary'}" id="vacancy-apply" ${v.applied || !active ? 'disabled' : ''}>${v.applied ? 'Отклик отправлен' : !active ? 'Вакансия закрыта' : 'Откликнуться'}</button>` : '<p class="muted">Откликнуться можно с аккаунта студента.</p>';
                detailRoot.innerHTML = `<a class="back-link" href="/pages/vacancies.html">← Все вакансии</a>
          <div class="entity-heading"><span class="eyebrow">${active ? 'Вакансия' : 'Архивная вакансия'}</span><h1>${esc(v.title)}</h1><div class="entity-subtitle">${companyLink(v)}</div><div class="tags">${tagsOf(v)}</div>${active && v.has_workplace_photo ? `<img class="vacancy-detail-photo" src="/api/public/vacancies/${v.id}/workplace-photo" alt="Фото места работы" loading="lazy">` : ''}</div>
          <div class="detail-layout"><aside class="detail-actions card" aria-label="Действия с вакансией"><h2>Следующий шаг</h2>${action}
          ${!me || isStudent ? `<button class="btn ${v.fav ? 'saved' : ''}" id="vacancy-fav" aria-pressed="${!!v.fav}">${bookmark}<span>${v.fav ? 'В избранном' : 'В избранное'}</span></button>` : ''}
          ${v.applied ? `<a class="text-link" href="/pages/chat.html#${v.application?.id || ''}">Открыть чат с компанией →</a><a class="text-link" href="/pages/vacancies.html#mine">Посмотреть мои отклики →</a>` : '<p class="muted">Расскажите о себе в сопроводительном письме — это поможет компании познакомиться с вами.</p>'}
          ${v.company_id ? `<a class="text-link" href="${companyUrl(v.company_id)}">Профиль компании →</a>` : '<p class="muted">Компания пока не подключила профиль на платформе.</p>'}
          </aside><div class="detail-copy card"><h2>О вакансии</h2><div class="prose">${esc(v.description || 'Компания пока не добавила описание.')}</div>
          ${facts([['Город', v.city], ['Формат', v.format], ['Направление', v.category], ['Оплата', v.paid ? 'Оплачиваемая стажировка' : 'Уточняется у компании']])}
          ${v.created_at ? `<p class="muted">Опубликовано ${new Date(v.created_at).toLocaleDateString('ru')}</p>` : ''}</div></div>`;
                detailRoot.setAttribute('aria-busy', 'false');
                const apply = $('#vacancy-apply'), favorite = $('#vacancy-fav');
                if (apply && !apply.disabled) apply.onclick = () => {
                    if (!me) return authGate(v.id, 'apply');
                    if (!me.verified) { sessionStorage.setItem('authReturn', vacancyUrl(v.id)); return location.href = '/pages/verify.html'; }
                    openApply(v.id, v.title, d => { toast('Отклик отправлен ✓ Чат уже доступен'); loadVacancy(); });
                };
                if (favorite) favorite.onclick = async () => {
                    if (!me) return authGate(v.id, 'fav');
                    favorite.disabled = true;
                    try { const d = await api('/api/favorites/' + v.id, { method: 'POST' }); toast(d.fav ? 'Вакансия добавлена в избранное' : 'Вакансия удалена из избранного'); await loadVacancy(); }
                    catch (err) { favorite.disabled = false; fail(err); }
                };
                let pending = null;
                try { pending = JSON.parse(sessionStorage.getItem('vacancyIntent') || 'null'); } catch { sessionStorage.removeItem('vacancyIntent'); }
                if (isStudent && pending?.id === String(v.id) && (pending.action === 'fav' || me.verified)) {
                    sessionStorage.removeItem('vacancyIntent');
                    if (pending.action === 'apply' && active && !v.applied) apply?.click();
                    if (pending.action === 'fav' && !v.fav) favorite?.click();
                }
            } catch (err) { renderEntityError(detailRoot, err, loadVacancy); }
        }
        async function loadCompanyProfile() {
            profileRoot.setAttribute('aria-busy', 'true');
            try {
                const d = await api('/api/public/companies/' + entityId), c = d.company;
                document.title = `${c.name} — Первый шаг`;
                const website = c.website && safeWebsite(c.website);
                profileRoot.innerHTML = `<a class="back-link" href="/pages/vacancies.html">← Все вакансии</a><div class="entity-heading"><span class="eyebrow">Компания на платформе</span><h1>${esc(c.name)}</h1><p class="entity-subtitle">${[c.industry, c.city].filter(Boolean).map(esc).join(' · ')}</p></div>
          <div class="company-summary card"><h2>О компании</h2><div class="prose">${esc(c.description || 'Компания пока не добавила описание.')}</div>${website ? `<a class="text-link external-link" href="${esc(website)}" target="_blank" rel="noopener noreferrer">Сайт компании  </a>` : ''}</div>
          <div class="section-heading"><h2>Открытые вакансии</h2><span class="muted">${d.vacancies.length}</span></div><div class="vacancy-grid" id="company-vacancies">${d.vacancies.length ? d.vacancies.map(v => vacancyCard(v)).join('') : '<p class="empty">Сейчас открытых вакансий нет.</p>'}</div>`;
                profileRoot.setAttribute('aria-busy', 'false');
            } catch (err) { renderEntityError(profileRoot, err, loadCompanyProfile); }
        }
        async function loadStudentProfile() {
            profileRoot.setAttribute('aria-busy', 'true');
            try {
                const p = await api('/api/students/' + entityId);
                document.title = `${p.full_name} — Первый шаг`;
                const profileAvatar = p.avatar ? avatarImage(p.avatar, 'entity-avatar', 'Аватар ' + p.full_name) : '';
                profileRoot.innerHTML = `<a class="back-link" href="${me.role === 'company' ? '/pages/company.html#students' : '/pages/account.html#profile'}">← ${me.role === 'company' ? 'К студентам' : 'В личный кабинет'}</a><div class="entity-heading">${profileAvatar}<span class="eyebrow">Профиль студента</span><h1>${esc(p.full_name)}</h1><p class="entity-subtitle">${[p.city, p.age && p.age + ' лет', p.university].filter(Boolean).map(esc).join(' · ')}</p><div class="qa">${p.can_resume ? `<a class="btn" href="/pages/resume.html#${p.user_id}">Открыть резюме</a>` : ''}${me.role === 'company' ? '<a class="btn primary" href="/pages/company.html#students">Открыть подбор студентов</a>' : ''}</div></div>
          <div class="profile-sections"><section class="card"><h2>О себе</h2><div class="prose">${esc(p.about || 'Студент пока не добавил рассказ о себе.')}</div>${facts([['Образование', p.education], ['Учебное заведение', p.university], ['Специальность', p.specialty]])}</section>
          <section class="card"><h2>Навыки и интересы</h2>${facts([['Навыки', p.skills], ['Хочу получить опыт', p.desired_experience]])}${!p.skills && !p.desired_experience ? '<p class="muted">Информация пока не заполнена.</p>' : ''}</section>
          ${p.work_history ? `<section class="card"><h2>Опыт</h2><div class="prose">${esc(p.work_history)}</div></section>` : ''}${p.portfolio ? `<section class="card"><h2>Портфолио</h2><div class="portfolio-links">${linkify(p.portfolio)}</div></section>` : ''}</div>`;
                profileRoot.setAttribute('aria-busy', 'false');
            } catch (err) { renderEntityError(profileRoot, err, loadStudentProfile); }
        }
        if (detailRoot || profileRoot) {
            const root = detailRoot || profileRoot;
            if (!validEntityId) renderEntityError(root, new Error('Некорректная ссылка'), null);
            else if (detailRoot) loadVacancy();
            else if (page === 'company-profile') loadCompanyProfile();
            else loadStudentProfile();
        }

        // ---- публичный каталог и личные вакансии студента ----
        const list = $('#list');
        if (list) {
            const modes = ['vacancies', 'offers', 'mine'], tabs = $$('.tab');
            const isStudent = me?.role === 'student';
            let mode = isStudent ? hashIn(modes) : 'vacancies', dt, requestId = 0;
            const categorySelect = $('#f-cat');
            const requestedCategory = new URLSearchParams(location.search).get('category');
            if (requestedCategory && [...categorySelect.options].some(option => option.value === requestedCategory)) {
                categorySelect.value = requestedCategory;
            }
            const note = $('#catalog-note');
            if (isStudent) note.hidden = true;
            else {
                $('#f-sort').value = 'new';
                $('#f-sort option[value=match]').disabled = true;
                if (me) { note.textContent = 'Просмотр каталога. Откликаться могут пользователи с аккаунтом студента.'; $$('.tab[data-mode=offers],.tab[data-mode=mine]').forEach(el => el.hidden = true); $('#f-fav').hidden = true; }
            }
            const filterToggle = $('#filter-toggle'), filterFields = $('#filters-extra');
            if (requestedCategory && categorySelect.value) $('#filters').classList.add('expanded');
            const filterMedia = matchMedia('(max-width: 700px)');
            const morePanel = $('#catalog-more'), more = $('#vacancies-more'), count = $('#catalog-count');
            let vacancies = [], visible = 0, lastQuery, hint = '';
            const batchSize = () => 8;
            function updateCatalogCount() {
                morePanel.hidden = !vacancies.length;
                more.hidden = visible >= vacancies.length;
                count.textContent = `Показано ${visible} из ${vacancies.length}`;
            }
            more.onclick = () => {
                const batch = vacancies.slice(visible, visible + batchSize());
                list.insertAdjacentHTML('beforeend', batch.map(v => vacancyCard(v, !me || isStudent)).join(''));
                visible += batch.length;
                updateCatalogCount();
                list.querySelector('#vacancy-' + batch[0].id + ' .vacancy-card-link')?.focus({ preventScroll: true });
            };
            const syncFilters = () => {
                const open = $('#filters').classList.contains('expanded');
                filterToggle.setAttribute('aria-expanded', String(open));
                filterFields.hidden = filterMedia.matches && !open;
            };
            filterToggle.onclick = () => { $('#filters').classList.toggle('expanded'); syncFilters(); };
            filterMedia.addEventListener('change', () => { syncFilters(); lastQuery = undefined; render().catch(showError); }); syncFilters();
            const qs = () => new URLSearchParams({ q: $('#f-q').value.trim(), format: $('#f-format').value, category: $('#f-cat').value, paid: $('#f-paid').classList.contains('on') ? '1' : '', fav: $('#f-fav').classList.contains('on') ? '1' : '', sort: $('#f-sort').value }).toString();
            async function render() {
                const currentRequest = ++requestId;
                list.setAttribute('aria-busy', 'true');
                tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode)); $('#filters').hidden = mode !== 'vacancies'; list.classList.toggle('vacancy-grid', mode === 'vacancies');
                more.disabled = true;
                if (mode === 'vacancies') {
                    const search = qs();
                    const vs = await api((isStudent ? '/api/vacancies?' : '/api/public/vacancies?') + search);
                    if (currentRequest !== requestId) return;
                    list.setAttribute('aria-busy', 'false');
                    hint = isStudent && vs.length && vs.every(v => v.match == null) ? '<div class="devhint">Добавьте навыки и желаемый опыт в <a class="linkbtn" href="/pages/account.html#profile">профиле</a> — мы покажем процент совпадения и подберём лучшие вакансии.</div>' : '';
                    visible = Math.min(vs.length, lastQuery === search ? Math.max(visible, batchSize()) : batchSize());
                    lastQuery = search;
                    vacancies = vs;
                    list.innerHTML = hint + (vs.length ? vs.slice(0, visible).map(v => vacancyCard(v, !me || isStudent)).join('')
                        : '<p class="empty">Ничего не найдено. Попробуйте изменить фильтры</p>');
                    updateCatalogCount();
                    more.disabled = false;
                    return;
                }
                morePanel.hidden = true;
                const offers = mode === 'offers';
                const rows = (await api('/api/applications')).filter(a => a.direction === (offers ? 'company_to_student' : 'student_to_company'));
                if (currentRequest !== requestId) return;
                list.setAttribute('aria-busy', 'false');
                list.innerHTML = rows.length ? rows.map(a => card(`<div><small>${companyLink(a)} · ${when(a.created_at)}</small><h3><a class="entity-link" href="${vacancyUrl(a.vacancy_id)}">${esc(a.title)}</a></h3>${offers ? '' : stepper(a) + ivBlock(a)}${a.cover_letter ? '<details class="cl"><summary>Ваше письмо</summary><p>' + esc(a.cover_letter) + '</p></details>' : ''}</div>` +
                    (offers && a.status === 'new' ? `<div class="acts"><button class="btn primary sm" data-do="accepted" data-id="${a.id}">Принять</button><button class="btn sm" data-do="declined" data-id="${a.id}">Отклонить</button></div>`
                        : `<div class="acts"><span class="tag">${ST[a.status] || a.status}</span>${a.chat ? `<a class="btn primary sm" href="/pages/chat.html#${a.id}">Чат</a>` : ''}${!offers && a.status === 'new' ? `<button class="btn sm" data-do="withdraw" data-id="${a.id}">Отозвать</button>` : ''}</div>`))).join('')
                    : `<p class="empty">${offers ? 'Пока нет предложений от партнёров. Заполните профиль — компании увидят его.' : 'Вы ещё никуда не откликались'}</p>`;
            }
            function showError(err) {
                morePanel.hidden = true;
                list.setAttribute('aria-busy', 'false');
                list.innerHTML = `<div class="empty"><p>${esc(err.message || 'Не удалось загрузить вакансии')}</p><button class="btn sm" id="retry-catalog">Повторить загрузку</button></div>`;
                $('#retry-catalog').onclick = () => render().catch(showError);
            }
            tabs.forEach(t => t.onclick = () => { if (!isStudent && t.dataset.mode !== 'vacancies') return authGate(); location.hash = t.dataset.mode; });
            addEventListener('hashchange', () => { mode = isStudent ? hashIn(modes) : 'vacancies'; render().catch(showError); });
            $$('.chip').forEach(c => c.onclick = () => { if (c.id === 'f-fav' && !isStudent) return authGate(); c.classList.toggle('on'); render().catch(showError); });
            $('#filters').addEventListener('input', () => { clearTimeout(dt); dt = setTimeout(() => render().catch(showError), 280); });
            list.addEventListener('click', async e => {
                const iv = e.target.closest('button[data-ivdo]');
                if (iv) { try { await api(`/api/interviews/${iv.dataset.id}/respond`, { method: 'POST', body: { status: iv.dataset.ivdo } }); toast('Ответ отправлен ✓'); render(); } catch (err) { fail(err); } return; }
                const b = e.target.closest('button[data-do]'); if (!b) return;
                if (!me) return authGate(b.dataset.id, b.dataset.do);
                if (!isStudent) return toast('Откликаться могут только студенты');
                const act = b.dataset.do;
                try {
                    if (act === 'fav') { b.disabled = true; await api('/api/favorites/' + b.dataset.id, { method: 'POST' }); }
                    else if (act === 'apply') { openApply(b.dataset.id, b.dataset.title, d => { toast(d?.chat ? 'Отклик отправлен ✓ Чат уже доступен' : 'Отклик отправлен ✓'); render(); }); return; }
                    else if (act === 'withdraw') { await api('/api/applications/' + b.dataset.id, { method: 'DELETE' }); toast('Отклик отозван'); }
                    else { await api(`/api/applications/${b.dataset.id}/respond`, { method: 'POST', body: { status: act } }); toast('Готово ✓'); }
                    render();
                } catch (err) { b.disabled = false; fail(err); if (err.message.includes('профиль')) setTimeout(() => location.href = '/pages/account.html#profile', 1400); }
            });
            addEventListener('pageshow', e => { if (e.persisted) render().catch(showError); });
            render().catch(showError);
        }

        // ---- чат по откликам ----
        if (page === 'chat') {
            const box = $('#chat'), cl = $('#clist'), msgs = $('#msgs'), form = $('#msg-form');
            let cur = null, pane = null;
            const reply = useReply(msgs, form);
            $('#cdel').onclick = () => openDeleteChat({
                title: `${$('#cname2').textContent} · ${$('#ctitle').textContent}`,
                onChoose: async scope => { await api(`/api/chats/${cur}?scope=${scope}`, { method: 'DELETE' }); toast(scope === 'both' ? 'Чат удалён у обоих' : 'Чат удалён у вас'); cl.dataset.h = ''; location.hash = ''; }
            });
            const nameFor = c => role() === 'company' ? (c.full_name || 'Студент') : c.company;
            async function loadList() {
                const cs = await api('/api/chats');
                const html = cs.length ? cs.map(c => `<a class="citem ${c.id === cur ? 'active' : ''}" href="#${c.id}"><b>${esc(nameFor(c))}</b><small>${esc(c.title)}</small><span>${esc(c.last_text || 'Начните диалог')}</span></a>`).join('')
                    : '<p class="empty" style="padding:28px 16px">Чаты появятся после отклика студента или принятого приглашения</p>';
                if (cl.dataset.h !== html) { cl.innerHTML = html; cl.dataset.h = html; }
            }
            async function select() {
                cur = Number(location.hash.slice(1)) || null; box.classList.toggle('open', !!cur); form.hidden = !cur; reply.clear(); $('#cdel').hidden = !cur;
                if (!cur) { pane = null; msgs.innerHTML = '<p class="empty">Выберите диалог слева</p>'; $('#cname2').textContent = 'Выберите чат'; $('#ctitle').textContent = ''; return loadList(); }
                const chat = cur;
                msgs.innerHTML = '';
                const activePane = pane = mkPane(msgs, `/api/chats/${cur}/messages`, '<p class="empty">Сообщений пока нет</p>', () => pane === activePane);
                try { const d = await activePane(true); if (!d || pane !== activePane) return; $('#cname2').innerHTML = role() === 'company' ? `<a class="entity-link" href="${studentUrl(d.student_id)}">${esc(d.student)}</a>` : d.company_id ? `<a class="entity-link" href="${companyUrl(d.company_id)}">${esc(d.company)}</a>` : esc(d.company); $('#ctitle').textContent = d.title; }
                catch (e) { if (cur === chat && pane === activePane) { fail(e); location.hash = ''; } return; }
                loadList();
            }
            addEventListener('hashchange', () => select().catch(() => { }));
            msgs.addEventListener('click', e => {
                const button = e.target.closest('[data-delete-message]');
                if (!button || !cur) return;
                const chat = cur;
                const messageId = Number(button.dataset.deleteMessage);
                openDeleteMessage(button.closest('.msg').classList.contains('me'), button, async scope => {
                    await api('/api/chats/' + chat + '/messages/' + messageId + '?scope=' + scope, { method: 'DELETE' });
                    if (cur === chat) {
                        if (reply.get() === messageId) reply.clear();
                        await pane(false);
                    }
                    await loadList();
                });
            });
            form.addEventListener('submit', async e => {
                e.preventDefault();
                const t = form.elements.text.value.trim(); if (!t) return; form.elements.text.value = '';
                try { await api(`/api/chats/${cur}/messages`, { method: 'POST', body: { text: t, reply_to: reply.get() } }); reply.clear(); await pane(false); loadList(); }
                catch (err) { fail(err); form.elements.text.value = t; }
            });
            setInterval(() => { pane?.(false).catch(() => { }); loadList().catch(() => { }); }, 3500);
            select();
        }

        // ---- чат с поддержкой (пользователь) ----
        const sf = $('#sform');
        if (sf) {
            if (me.role === 'company' && !me.approved) {
                const tpl = 'Заявка на подключение компании\nНазвание: \nСфера: \nСайт: \nКонтактное лицо и телефон: \nЧто хотите предложить студентам: ';
                $('#apphint').hidden = false;
                $('#fill-tpl').onclick = () => { sf.elements.text.value = tpl; sf.elements.text.rows = 6; sf.elements.text.focus(); };
            }
            sf.elements.text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sf.requestSubmit(); } });
            const reply = useReply($('#smsgs'), sf);
            const pane = mkPane($('#smsgs'), '/api/support/messages', '<p class="empty">Здравствуйте! Опишите вопрос — мы ответим здесь.</p>');
            pane(true).catch(fail);
            sf.addEventListener('submit', async e => {
                e.preventDefault();
                const t = sf.elements.text.value.trim(); if (!t) return; sf.elements.text.value = ''; sf.elements.text.rows = 2;
                try { await api('/api/support/messages', { method: 'POST', body: { text: t, reply_to: reply.get() } }); reply.clear(); await pane(false); } catch (err) { fail(err); sf.elements.text.value = t; }
            });
            setInterval(() => pane(false).catch(() => { }), 4000);
        }

        // ---- кабинет компании ----
        if (page === 'company') {
            const vf2 = $('#vac-form');
            initTabs();
            if (!me.approved) {
                document.body.classList.add('locked');
                $('.stats').insertAdjacentHTML('afterend', '<div class="devhint" style="margin-top:16px">Аккаунт на проверке: доступен просмотр. Чтобы публиковать вакансии и приглашать студентов, оставьте заявку в <a class="linkbtn" href="/pages/support.html">чате поддержки</a>.</div>');
                vf2.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
            }
            // ---- воронка откликов ----
            const STAGES = [['new', 'Новые'], ['interview', 'Собеседование'], ['offer', 'Оффер'], ['accepted', 'Принят'], ['declined', 'Отказ']];
            const IVS = { proposed: 'ждёт подтверждения', confirmed: 'подтверждено', reschedule: 'просит перенести' };
            let funnel = [], lastSig = '';
            const kcard = a => `<div class="kcard" data-id="${a.id}" ${me.approved ? 'draggable="true"' : ''}>
        <b><a class="entity-link" href="${studentUrl(a.user_id)}">${esc(a.full_name || 'Студент')}</a></b><small>«${esc(a.title)}» · ${ago(a.created_at)}</small>
        <p class="kmeta">${[a.age && a.age + ' лет', a.university, a.specialty].filter(Boolean).map(esc).join(' · ')}${a.skills ? '<br>' + esc(a.skills) : ''}</p>
        ${a.interview ? `<div class="kiv"><b>${when(a.interview.scheduled_at)}</b> · ${a.interview.format === 'office' ? 'в офисе' : 'онлайн'}<br><small>${IVS[a.interview.status] || ''}${a.interview.place ? ' · ' : ''}${placeHtml(a.interview.place)}</small></div>` : ''}
        ${a.cover_letter ? `<details class="cl"><summary>Письмо</summary><p>${esc(a.cover_letter)}</p></details>` : ''}
        <div class="kact"><a class="btn sm" href="/pages/resume.html#${a.user_id}" target="_blank">Резюме</a>${a.status !== 'declined' ? `<a class="btn sm" href="/pages/chat.html#${a.id}">Чат</a>` : ''}
          <button class="btn sm" data-iv="${a.id}">${a.interview ? 'Перенести' : 'Назначить'}</button>
          <select data-stage="${a.id}" aria-label="Этап">${STAGES.map(([k, l]) => `<option value="${k}" ${k === a.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
            function renderFunnel(rs) {
                const sig = JSON.stringify(rs.map(a => [a.id, a.status, a.interview?.id, a.interview?.status]));
                if (sig === lastSig) return; lastSig = sig;
                funnel = rs.filter(a => a.direction === 'student_to_company');
                $('#kanban').innerHTML = STAGES.map(([k, l]) => {
                    const items = funnel.filter(a => a.status === k);
                    return `<div class="kcol" data-col="${k}"><div class="khead"><b>${l}</b><span>${items.length}</span></div>${items.map(kcard).join('') || '<p class="kempty">Пусто</p>'}</div>`;
                }).join('');
                const inv = rs.filter(a => a.direction === 'company_to_student');
                $('#resp').innerHTML = inv.length ? inv.map(a => card(`<div><small>Ваше приглашение · «${esc(a.title)}» · ${when(a.created_at)}</small><h3><a class="entity-link" href="${studentUrl(a.user_id)}">${esc(a.full_name || 'Студент')}</a></h3></div>
          <div class="acts"><span class="tag">${a.status === 'new' ? 'Ждём ответа' : ST[a.status] || a.status}</span>${a.status === 'accepted' ? `<a class="btn sm" href="/pages/resume.html#${a.user_id}" target="_blank">Резюме</a><a class="btn sm" href="/pages/chat.html#${a.id}">Написать</a>` : ''}</div>`)).join('')
                    : '<p class="empty">Приглашений пока нет — найдите студентов во вкладке «Студенты».</p>';
            }
            const setStage = async (id, stage) => {
                try { await api(`/api/company/applications/${id}/status`, { method: 'POST', body: { status: stage } }); toast('Этап обновлён, студент получил уведомление'); }
                catch (err) { fail(err); }
                lastSig = ''; load().catch(() => { });
            };
            function openInterview(id) {
                const a = funnel.find(x => x.id == id), iv = a?.interview;
                const toLocal = d => new Date(new Date(d) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                const bk = document.createElement('div'); bk.className = 'mbk';
                bk.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${iv ? 'Перенести собеседование' : 'Назначить собеседование'}</h3>
          <p class="lead">${esc(a?.full_name || 'Студент')} получит уведомление и сможет подтвердить время или попросить перенос.</p>
          <label class="field"><span>Дата и время</span><input type="datetime-local" id="iv-when" min="${toLocal(Date.now())}" value="${iv ? toLocal(iv.scheduled_at) : ''}"></label>
          <div class="two"><label class="field"><span>Формат</span><select id="iv-fmt"><option value="online">Онлайн</option><option value="office" ${iv?.format === 'office' ? 'selected' : ''}>В офисе</option></select></label>
          <label class="field"><span>Ссылка или адрес</span><input id="iv-place" maxlength="300" placeholder="https://meet… или адрес офиса" value="${esc(iv?.place || '')}"></label></div>
          <label class="field"><span>Комментарий (необязательно)</span><textarea id="iv-note" maxlength="500" style="min-height:80px">${esc(iv?.note || '')}</textarea></label>
          <div class="mact"><button class="btn" id="iv-cancel" type="button">Отмена</button><button class="btn primary" id="iv-send" type="button">Отправить приглашение</button></div></div>`;
                document.body.appendChild(bk);
                const close = () => { bk.remove(); removeEventListener('keydown', onKey); lastSig = ''; load().catch(() => { }); };
                const onKey = e => { if (e.key === 'Escape') close(); };
                addEventListener('keydown', onKey);
                bk.addEventListener('click', e => { if (e.target === bk) close(); });
                bk.querySelector('#iv-cancel').onclick = close;
                bk.querySelector('#iv-send').onclick = async e => {
                    const w = bk.querySelector('#iv-when').value; if (!w) return toast('Укажите дату и время');
                    const btn = e.currentTarget; btn.disabled = true;
                    try {
                        await api(`/api/company/applications/${id}/interview`, { method: 'POST', body: { when: new Date(w).toISOString(), format: bk.querySelector('#iv-fmt').value, place: bk.querySelector('#iv-place').value, note: bk.querySelector('#iv-note').value } });
                        toast('Приглашение на собеседование отправлено ✓'); close();
                    } catch (err) { btn.disabled = false; fail(err); }
                };
            }
            const askStage = (id, stage) => stage === 'interview' ? openInterview(id) : setStage(id, stage);
            async function load() {
                const [c, vs, rs, st] = await Promise.all([api('/api/company'), api('/api/company/vacancies'), api('/api/company/responses'), api('/api/students')]);
                $('#cname').textContent = c.name;
                $('#s-v').textContent = vs.filter(v => v.is_active).length;
                $('#s-r').textContent = rs.filter(a => a.direction === 'student_to_company').length;
                $('#s-i').textContent = rs.filter(a => a.direction === 'company_to_student').length;
                $('#vlist').classList.add('vacancy-grid');
                $('#vlist').innerHTML = vs.length ? vs.map(v => vacancyCard(v, false, true)).join('') : '<p class="empty">Вы ещё не публиковали вакансии</p>';
                renderFunnel(rs);
                const sel = $('#inv-vac'), cur = sel.value, act = vs.filter(v => v.is_active);
                sel.innerHTML = act.length ? act.map(v => `<option value="${v.id}">${esc(v.title)}</option>`).join('') : '<option value="">Сначала опубликуйте вакансию</option>';
                if (cur) sel.value = cur;
                $('#studs').innerHTML = st.length ? st.map(s => card(`<div><h3><a class="entity-link" href="${studentUrl(s.user_id)}">${esc(s.full_name)}</a></h3><p>${[s.age && s.age + ' лет', s.city, s.education, s.university, s.specialty].filter(Boolean).map(esc).join(' · ')}${s.skills ? '<br>Навыки: ' + esc(s.skills) : ''}${s.desired_experience ? '<br>Хочет опыт: ' + esc(s.desired_experience) : ''}</p></div>
          <div class="acts"><a class="btn sm" href="${studentUrl(s.user_id)}">Профиль</a><button class="btn primary sm" data-uid="${s.user_id}">Пригласить</button></div>`)).join('') : '<p class="empty">Студенты с заполненными профилями пока не появились</p>';
            }
            vf2.addEventListener('submit', async e => {
                e.preventDefault();
                const button = vf2.querySelector('button[type=submit], button:not([type])');
                const { photo, ...fields } = Object.fromEntries(new FormData(vf2));
                button.disabled = true;
                try {
                    const data = photo?.size ? await readWorkplacePhoto(photo) : null;
                    await api('/api/company/vacancies', { method: 'POST', body: { ...fields, paid: !!fields.paid, photo: data } });
                    vf2.reset();
                    toast('Вакансия опубликована ✓');
                    await load();
                } catch (err) { fail(err); }
                finally { button.disabled = false; }
            });
            $('#studs').addEventListener('click', async e => {
                const b = e.target.closest('button[data-uid]'); if (!b) return;
                try { await api('/api/invite', { method: 'POST', body: { user_id: b.dataset.uid, vacancy_id: $('#inv-vac').value } }); toast('Приглашение отправлено ✓'); load(); } catch (err) { fail(err); }
            });
            $('#vlist').addEventListener('click', async e => {
          const b = e.target.closest('button[data-vdo]'); if (!b) return;
                try {
                    if (b.dataset.vdo === 'del') { if (!confirm('Удалить вакансию вместе с откликами?')) return; await api('/api/company/vacancies/' + b.dataset.id, { method: 'DELETE' }); }
                    else await api(`/api/company/vacancies/${b.dataset.id}/toggle`, { method: 'POST' });
                    load();
                } catch (err) { fail(err); }
            });
            $('#vlist').addEventListener('change', async e => {
                const input = e.target.closest('input[data-vphoto]'); if (!input?.files[0]) return;
                input.disabled = true;
                try {
                    const data = await readWorkplacePhoto(input.files[0]);
                    await api('/api/company/vacancies/' + input.dataset.vphoto + '/workplace-photo', { method: 'POST', body: { data } });
                    toast('Фото места работы сохранено');
                    await load();
                } catch (err) { fail(err); }
                finally { input.value = ''; input.disabled = false; }
            });
            const kb = $('#kanban');
            kb.addEventListener('change', e => { const sel = e.target.closest('select[data-stage]'); if (sel) askStage(sel.dataset.stage, sel.value); });
            kb.addEventListener('click', e => { const b = e.target.closest('button[data-iv]'); if (b) openInterview(b.dataset.iv); });
            kb.addEventListener('dragstart', e => { const c = e.target.closest('.kcard'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); } });
            kb.addEventListener('dragend', () => { $$('.kcard.drag').forEach(c => c.classList.remove('drag')); $$('.kcol.over').forEach(c => c.classList.remove('over')); });
            kb.addEventListener('dragover', e => { const col = e.target.closest('.kcol'); if (col) { e.preventDefault(); $$('.kcol.over').forEach(c => c !== col && c.classList.remove('over')); col.classList.add('over'); } });
            kb.addEventListener('drop', e => {
                e.preventDefault(); const col = e.target.closest('.kcol'); $$('.kcol.over').forEach(c => c.classList.remove('over'));
                const id = e.dataTransfer.getData('text/plain'), a = funnel.find(x => x.id == id);
                if (col && a && a.status !== col.dataset.col) askStage(id, col.dataset.col);
            });
            load().catch(fail); setInterval(() => load().catch(() => { }), 15000);
        }

        // ---- админ-панель ----
        if (page === 'admin') {
            const loaded = {};
            async function overview() {
                const d = await api('/api/dashboard'), s = d.stats;
                $('#aov').innerHTML = `<div class="dash" style="margin-top:0"><div class="stats4">${statc(s.users, 'Пользователей', .05, '#users', '')}${statc(s.students, 'Студентов', .1, '#users', 'student')}${statc(s.companies, 'Компаний', .15, '#users', 'company')}${statc(s.unverified, 'Не подтвердили email', .2, '#users', 'unverified')}
          ${statc(s.vacancies, 'Вакансий', .25, '#vacancies')}${statc(s.applications, 'Откликов и приглашений', .3, '#vacancies')}${statc(s.pending, 'Компаний на одобрении', .35, '#users', 'pending')}${statc(s.tickets, 'Открытых обращений', .4, '#support')}</div>
          <div class="card rise" style="--d:.45s"><h4>Регистрации за 14 дней</h4>${bars(d.series)}</div></div>`;
                watchCounts($('#aov'));
            }
            async function users() {
                const us = await api(`/api/admin/users?q=${encodeURIComponent($('#uq').value)}&role=${$('#urole').value}`);
                $('#ulist').innerHTML = us.length ? us.map(u => card(`<div><small>${{ student: 'студент', company: 'компания', admin: 'админ' }[u.role]} · ${when(u.created_at)}</small><h3>${esc(u.name || u.email)}</h3>
          <p>${esc(u.email)}${u.role === 'company' && !u.approved ? ' · ожидает одобрения' : ''}${u.email_verified ? '' : ' · email не подтверждён'}${u.is_blocked ? ' · заблокирован' : ''}</p></div>
          ${u.role === 'admin' ? '' : `<div class="acts">${u.role === 'company' ? `<button class="btn ${u.approved ? '' : 'primary'} sm" data-ado="${u.approved ? 'revoke' : 'approve'}" data-id="${u.id}">${u.approved ? 'Отозвать доступ' : 'Одобрить'}</button>` : ''}${u.email_verified ? '' : `<button class="btn sm" data-ado="verify" data-id="${u.id}">Подтвердить</button>`}<button class="btn sm" data-ado="${u.is_blocked ? 'unblock' : 'block'}" data-id="${u.id}">${u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button><button class="btn sm" data-ado="del" data-id="${u.id}">Удалить</button></div>`}`)).join('') : '<p class="empty">Никого не найдено</p>';
            }
            async function vacs() {
                const vs = await api('/api/admin/vacancies');
                $('#avlist').innerHTML = vs.length ? vs.map(v => card(`<div><small>${esc(v.company)} · ${v.is_active ? 'активна' : 'закрыта'} · ${when(v.created_at)}</small><h3>${esc(v.title)}</h3></div>
          <div class="acts"><span class="tag">Откликов: ${v.responses}</span><button class="btn sm" data-ado="delvac" data-id="${v.id}">Удалить</button></div>`)).join('') : '<p class="empty">Вакансий нет</p>';
            }
            async function enrollment() {
                const rows = await api('/api/admin/enrollment');
                $('#enrollment-list').innerHTML = rows.length ? rows.map(r => card(`<div><small>${esc(r.email)} · ${when(r.submitted_at)}</small><h3>${esc(r.full_name || 'Студент')}</h3><p>${esc(r.university || 'Место учёбы не указано')} · <button class="text-link" type="button" data-enrollment-doc="${esc(r.submission_id)}" data-name="${esc(r.name)}">Открыть ${esc(r.name)}</button></p></div><div class="acts"><button class="btn primary sm" data-enroll="approved" data-id="${esc(r.submission_id)}">Одобрить</button><button class="btn sm" data-enroll="rejected" data-id="${esc(r.submission_id)}">Отклонить</button></div>`)).join('') : '<p class="empty">Новых справок на проверку нет</p>';
            }
            let curT = null, pane = null, dq;
            const abox = $('#achat'), aform = $('#aform'), amsgs = $('#amsgs');
            const reply = useReply(amsgs, aform);
            $('#adel').onclick = () => openDeleteChat({
                title: `${$('#aname').textContent} · обращение в поддержку`,
                onChoose: async scope => { await api(`/api/admin/support/${curT}?scope=${scope}`, { method: 'DELETE' }); toast(scope === 'both' ? 'Обращение удалено у обоих' : 'Обращение удалено у вас'); $('#alist').dataset.h = ''; await openThread(null); }
            });
            async function threads() {
                const ts = await api('/api/admin/support');
                const html = ts.length ? ts.map(t => `<a class="citem ${t.id === curT ? 'active' : ''}" href="#support" data-t="${t.id}"><b>${t.last_staff === false && t.status === 'open' ? '● ' : ''}${esc(t.name)}</b><small>${t.status === 'closed' ? 'закрыто' : 'открыто'} · ${ago(t.updated_at)}${t.role === 'company' && !t.approved ? ' · на одобрении' : ''}</small><span>${esc(t.last_text || '')}</span></a>`).join('') : '<p class="empty" style="padding:28px 16px">Обращений пока нет</p>';
                if ($('#alist').dataset.h !== html) { $('#alist').innerHTML = html; $('#alist').dataset.h = html; }
            }
            const headInfo = d => {
                const c = d.company, box = $('#acomp');
                $('#aname').textContent = c?.name || d.email; $('#amail').textContent = `${d.email} · обращение №${curT}`;
                if (!c) { box.hidden = true; return; }
                box.hidden = false;
                box.innerHTML = `<div><b>${esc(c.name)} · ${c.approved ? 'одобрена' : 'ожидает одобрения'}</b><small>${[c.industry, c.city, c.website].filter(Boolean).map(esc).join(' · ') || 'Данные о компании не заполнены'}</small></div>
          <button class="btn ${c.approved ? '' : 'primary'} sm" id="acomp-btn" data-uid="${d.user_id}" data-ap="${c.approved ? 0 : 1}">${c.approved ? 'Отозвать доступ' : 'Одобрить компанию'}</button>`;
            };
            async function openThread(id) {
                curT = id; $('#acomp').hidden = true; abox.classList.toggle('open', !!id); aform.hidden = !id; $('#astatus').hidden = !id; $('#adel').hidden = !id; reply.clear();
                if (!id) { pane = null; amsgs.innerHTML = '<p class="empty">Выберите обращение слева</p>'; $('#aname').textContent = 'Выберите обращение'; $('#amail').textContent = ''; return threads(); }
                pane = mkPane(amsgs, `/api/admin/support/${id}/messages`, '<p class="empty">Сообщений нет</p>');
                const d = await pane(true); headInfo(d); threads();
            }
            $('#alist').addEventListener('click', e => { const a = e.target.closest('[data-t]'); if (a) { e.preventDefault(); openThread(Number(a.dataset.t)).catch(fail); } });
            $('#acomp').addEventListener('click', async e => {
                const b = e.target.closest('#acomp-btn'); if (!b) return;
                const ok = b.dataset.ap === '1';
                try {
                    await api(`/api/admin/users/${b.dataset.uid}/approve`, { method: 'POST', body: { approved: ok } });
                    toast(ok ? 'Компания одобрена ✓' : 'Доступ отозван');
                    headInfo(await api(`/api/admin/support/${curT}/messages?after=999999999`)); await pane(false); threads();
                } catch (err) { fail(err); }
            });
            $('#aback').onclick = e => { e.preventDefault(); openThread(null); };
            document.addEventListener('click', async e => {
                const b = e.target.closest('[data-enrollment-doc]');
                if (!b) return;
                b.disabled = true;
                try { await downloadPdf(`/api/admin/enrollment/${encodeURIComponent(b.dataset.enrollmentDoc)}/document`, b.dataset.name); }
                catch (err) { fail(err); }
                finally { b.disabled = false; }
            });
            aform.addEventListener('submit', async e => {
                e.preventDefault(); const t = aform.elements.text.value.trim(); if (!t) return; aform.elements.text.value = '';
                try { await api(`/api/admin/support/${curT}/messages`, { method: 'POST', body: { text: t, reply_to: reply.get() } }); reply.clear(); await pane(false); threads(); } catch (err) { fail(err); aform.elements.text.value = t; }
            });
            $('#astatus').onclick = async () => { try { await api(`/api/admin/support/${curT}/status`, { method: 'POST', body: { status: 'closed' } }); toast('Обращение закрыто'); threads(); } catch (err) { fail(err); } };
            $('#uq').addEventListener('input', () => { clearTimeout(dq); dq = setTimeout(() => users().catch(fail), 280); });
            $('#urole').addEventListener('change', () => users().catch(fail));
            document.addEventListener('click', async e => {
                const b = e.target.closest('[data-ado], [data-enroll]'); if (!b) return;
                const a = b.dataset.ado || b.dataset.enroll, id = b.dataset.id;
                try {
                    if (a === 'del' && !confirm('Удалить пользователя и все его данные?')) return;
                    if (a === 'delvac' && !confirm('Удалить вакансию?')) return;
                    if (a === 'verify') await api(`/api/admin/users/${id}/verify`, { method: 'POST' });
                    else if (a === 'approve' || a === 'revoke') await api(`/api/admin/users/${id}/approve`, { method: 'POST', body: { approved: a === 'approve' } });
                    else if (a === 'block' || a === 'unblock') await api(`/api/admin/users/${id}/block`, { method: 'POST', body: { blocked: a === 'block' } });
                    else if (a === 'del') await api('/api/admin/users/' + id, { method: 'DELETE' });
                    else if (a === 'delvac') await api('/api/admin/vacancies/' + id, { method: 'DELETE' });
                    else if (a === 'approved' || a === 'rejected') await api('/api/admin/enrollment/' + id + '/review', { method: 'POST', body: { status: a } });
                    toast('Готово ✓'); a === 'delvac' ? vacs() : (a === 'approved' || a === 'rejected') ? enrollment() : users();
                } catch (err) { fail(err); }
            });
            document.addEventListener('click', e => { const a = e.target.closest('.stat-link'); if (a && a.dataset.role !== undefined) { $('#urole').value = a.dataset.role; $('#uq').value = ''; } });
            initTabs(n => { ({ overview, users, vacancies: vacs, enrollment, support: threads }[n])().catch(fail); });
            setInterval(() => { if (!document.hidden && $('[data-pane=support]') && !$('[data-pane=support]').hidden) { threads().catch(() => { }); pane?.(false).catch(() => { }); } }, 4000);
        }
    }
    main();
})();
