(() => {
    const root = document.documentElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const $$ = s => [...document.querySelectorAll(s)];
    // d: [фон тёмной, акцент], l: [фон светлой]
    const PAL = [
        { id: 'mono', name: 'Монохром', d: ['#050506', '#f1f1ef'], l: ['#f3f4f6'] },
        { id: 'gold', name: 'Шампань', d: ['#0a0805', '#d9c28a'], l: ['#f5f0e5'] },
        { id: 'sapphire', name: 'Сапфир', d: ['#04070f', '#8fb4ff'], l: ['#eef3fb'] },
        { id: 'emerald', name: 'Изумруд', d: ['#030a07', '#7fe3b5'], l: ['#eef5f0'] },
        { id: 'ruby', name: 'Бордо', d: ['#0b0406', '#ff8fa3'], l: ['#faf0f0'] },
        { id: 'amethyst', name: 'Аметист', d: ['#07050d', '#c4a6ff'], l: ['#f3f0fa'] }
    ];
    const DEF = { mode: 'auto', palette: 'mono', halftone: true, density: 1, speed: 1, glow: 1, grain: true, radius: 20, font: 1, motion: true, respectOS: false };
    let S = { ...DEF };
    try {
        const saved = JSON.parse(localStorage.getItem('settings') || 'null');
        if (saved) S = { ...DEF, ...saved }; else if (localStorage.getItem('theme')) S.mode = localStorage.getItem('theme');
        if (saved && saved.halftone === undefined) S = { ...DEF, mode: S.mode, palette: 'mono', grain: false };
    } catch { }
    // Системная настройка «уменьшить движение» учитывается только если включить её в «Оформление и тема».
    // Иначе при выключенных анимациях Windows не работают бегущая строка, смена слов и наклон карточки.
    const osReduce = () => !!S.respectOS && reducedMotion.matches;
    const save = () => { try { localStorage.setItem('settings', JSON.stringify(S)); } catch { } };
    const mq = matchMedia('(prefers-color-scheme: dark)');
    function apply() {
        const dark = S.mode === 'auto' ? mq.matches : S.mode === 'dark';
        root.dataset.theme = dark ? 'dark' : 'light'; root.dataset.palette = S.palette; root.dataset.motion = S.motion && !osReduce() ? 'on' : 'off'; root.dataset.osReduce = osReduce() ? 'on' : 'off';
        root.style.setProperty('--gk', S.glow); root.style.setProperty('--r', S.radius + 'px'); root.style.setProperty('--fs', S.font);
        root.style.setProperty('--grain', S.grain ? '' : '0');
    }
    mq.addEventListener('change', () => { if (S.mode === 'auto') apply(); });
    apply();
    root.classList.remove('no-js');
    let sync = () => { }, pc = () => { }, syncProfiles = () => { };
    let tm;
    reducedMotion.addEventListener('change', () => { apply(); pc(); syncProfiles(); });
    const commit = () => { // плавная смена темы и палитры
        root.classList.add('theming'); clearTimeout(tm); tm = setTimeout(() => root.classList.remove('theming'), 800);
        apply(); save(); sync(); pc(); syncProfiles();
    };

    const tb = document.getElementById('theme');
    const profileSlides = $$('[data-profile-slide]');
    let profileIndex = Math.max(0, profileSlides.findIndex(el => el.classList.contains('is-active')));
    let profileTimer = 0, profileFadeTimer = 0;
    const setProfileSlide = index => {
        profileIndex = index;
        profileSlides.forEach((slide, i) => {
            const active = i === profileIndex;
            slide.classList.toggle('is-active', active);
            slide.setAttribute('aria-hidden', String(!active));
        });
    };
    syncProfiles = () => {
        clearTimeout(profileTimer); clearTimeout(profileFadeTimer);
        if (!profileSlides.length) return;
        setProfileSlide(profileIndex);
        if (profileSlides.length < 2 || !S.motion || osReduce() || document.hidden) return;
        profileTimer = setTimeout(() => {
            profileSlides[profileIndex].classList.remove('is-active');
            profileSlides[profileIndex].setAttribute('aria-hidden', 'true');
            profileFadeTimer = setTimeout(() => {
                setProfileSlide((profileIndex + 1) % profileSlides.length);
                syncProfiles();
            }, 560);
        }, 5000);
    };
    syncProfiles();
    document.addEventListener('visibilitychange', syncProfiles);

    // ---- прогресс, появление блоков, подсветка карточек ----
    const bar = document.querySelector('.progress'), header = document.querySelector('header');
    let scrollFrame = 0;
    const onScroll = () => {
        const h = document.body.scrollHeight - innerHeight;
        if (bar) bar.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
        if (header) header.classList.toggle('scrolled', scrollY > 10);
    };
    addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { onScroll(); scrollFrame = 0; }); }, { passive: true }); onScroll();
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
    $$('.reveal').forEach(el => io.observe(el));
    document.addEventListener('pointermove', e => {
        const c = e.target.closest && e.target.closest('.card,.panel,.profile');
        if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
    });

    // ---- панель настроек ----
    const rg = (k, label, min, max, step) => `<label class="rg"><span>${label}<b data-out="${k}"></b></span><input type="range" min="${min}" max="${max}" step="${step}" data-key="${k}"></label>`;
    const sw = (k, label) => `<label class="sw"><span>${label}</span><input type="checkbox" data-key="${k}"><i></i></label>`;
    const ui = document.createElement('div'); ui.id = 'settings';
    ui.innerHTML = `<div class="sbk"></div><aside class="sdrawer" aria-label="Настройки">
    <div class="shead"><b>Настройки</b><button class="theme sclose" aria-label="Закрыть"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="sbody">
      <div class="sgroup"><h4>Режим</h4><div class="seg"><button data-v="dark">Тёмный</button><button data-v="light">Светлый</button><button data-v="auto">Авто</button></div></div>
      <div class="sgroup"><h4>Цветовая палитра</h4><div class="pals">${PAL.map(p => `<button class="pal" data-v="${p.id}" style="--a:${p.d[0]};--b:${p.l[0]};--c:${p.d[1]}"><i></i>${p.name}</button>`).join('')}</div></div>
      <div class="sgroup"><h4>Halftone</h4>${sw('halftone', 'Показывать halftone')}${rg('density', 'Плотность точек', .5, 1.8, .1)}${rg('speed', 'Реакция на движение', .3, 2.5, .1)}</div>
      <div class="sgroup"><h4>Оформление</h4>${rg('glow', 'Яркость свечения', 0, 1.6, .1)}${rg('radius', 'Скругление углов', 6, 34, 1)}${rg('font', 'Размер текста', .9, 1.2, .05)}${sw('grain', 'Плёночное зерно')}${sw('motion', 'Плавные анимации')}${sw('respectOS', 'Учитывать системное «уменьшить движение»')}</div>
    </div>
    <div class="sfoot"><button class="btn sm" id="sreset">Сбросить настройки</button></div></aside>`;
    document.body.appendChild(ui);
    window.openSettings = () => ui.classList.add('open');
    if (tb) {
        tb.setAttribute('aria-label', 'Настройки темы и оформления');
        tb.onclick = () => window.openSettings();
    }
    addEventListener('keydown', e => { if (e.key === 'Escape') ui.classList.remove('open'); });
    const fmt = { density: v => Math.round(v * 100) + '%', speed: v => Math.round(v * 100) + '%', glow: v => Math.round(v * 100) + '%', radius: v => v + 'px', font: v => Math.round(v * 100) + '%' };
    sync = () => {
        ui.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.mode));
        ui.querySelectorAll('.pal').forEach(b => b.classList.toggle('on', b.dataset.v === S.palette));
        ui.querySelectorAll('input[data-key]').forEach(i => {
            const v = S[i.dataset.key];
            if (i.type === 'checkbox') i.checked = !!v;
            else { i.value = v; const o = ui.querySelector(`[data-out="${i.dataset.key}"]`); if (o) o.textContent = fmt[i.dataset.key](+v); }
        });
    };
    ui.addEventListener('click', e => {
        const b = e.target.closest('.seg button, .pal');
        if (b) { S[b.classList.contains('pal') ? 'palette' : 'mode'] = b.dataset.v; commit(); }
        if (e.target.closest('.sbk, .sclose')) ui.classList.remove('open');
        if (e.target.closest('#sreset')) { S = { ...DEF }; commit(); }
    });
    ui.addEventListener('input', e => {
        const i = e.target; if (!i.dataset.key) return;
        S[i.dataset.key] = i.type === 'checkbox' ? i.checked : Number(i.value); commit();
    });
    sync();

    // ---- анимированный полутон ----
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
        canvas.id = "halftone";
        canvas.setAttribute("aria-hidden", "true");
        document.body.prepend(canvas);
        const home = document.body.dataset.page === "home";
        let width, height, frame = 0, last = -Infinity;
        let pointerX = 0, pointerY = 0, cursorX = 0, cursorY = 0;
        const resize = () => {
            const scale = Math.min(devicePixelRatio || 1, 1.5);
            width = innerWidth; height = innerHeight;
            canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
            context.setTransform(scale, 0, 0, scale, 0, 0);
        };
        function draw(time) {
            frame = 0;
            if (document.hidden || !S.halftone) return;
            const animate = S.motion && !reducedMotion.matches;
            if (time - last >= 30) {
                last = time;
                cursorX += (pointerX - cursorX) * Math.min(.25, .09 * S.speed);
                cursorY += (pointerY - cursorY) * Math.min(.25, .09 * S.speed);
                const phase = animate ? time / 3800 : 0;
                const gap = Math.max(5, Math.min(12, 8 / S.density));
                context.clearRect(0, 0, width, height);
                context.fillStyle = root.dataset.theme === "light" ? "#242323" : "#f0e9df";
                const cursorPx = cursorX * width + width / 2, cursorPy = cursorY * height + height / 2;
                context.beginPath();
                for (let x = gap / 2; x < width; x += gap) {
                    const u = x / width;
          const edge = Math.max(0, (u - .64) / .36, (.30 - u) / .30);
                    if (!edge) continue;
                    const ribbon = .45 + .22 * Math.sin(u * 8 + phase) + .12 * Math.sin(u * 14 - phase * .6);
                    for (let y = gap / 2; y < height; y += gap) {
                        const distance = Math.hypot(x - cursorPx, y - cursorPy);
                        const ripple = animate ? Math.sin(distance * .09 - time * .008) * Math.exp(-distance / 260) : 0;
                        const offset = y / height - ribbon - (animate ? cursorY * .016 + cursorX * .01 + ripple * .012 : 0);
            const band = Math.max(0, 1 - Math.abs(offset) / .17);
            const echo = .45 * Math.max(0, 1 - Math.abs(offset - .24) / .085);
            const radius = gap * (.43 + Math.max(0, ripple) * .26) * Math.max(band, echo) * Math.sqrt(edge) * (home ? 1.12 : .98);
                        if (radius < .35) continue;
                        context.moveTo(x + radius, y);
                        context.arc(x, y, radius, 0, Math.PI * 2);
                    }
                }
                context.fill();
            }
            if (animate) frame = requestAnimationFrame(draw);
        }
        pc = () => {
            cancelAnimationFrame(frame);
            last = -Infinity;
            context.clearRect(0, 0, width, height);
            draw(performance.now());
        };
        addEventListener("resize", () => { resize(); pc(); }, { passive: true });
        addEventListener("pointermove", e => {
            if (e.pointerType === "touch") return;
            pointerX = e.clientX / width - .5;
            pointerY = e.clientY / height - .5;
        }, { passive: true });
        document.documentElement.addEventListener("pointerleave", () => { pointerX = pointerY = 0; });
        document.addEventListener("visibilitychange", pc);
        mq.addEventListener("change", pc);
        if (home) {
            const wordmark = document.createElement('div');
            wordmark.className = 'halftone-wordmark';
            wordmark.textContent = 'Первый шаг';
            document.body.appendChild(wordmark);
            setInterval(() => { wordmark.classList.remove('fly'); requestAnimationFrame(() => wordmark.classList.add('fly')); }, 180000);
            setTimeout(() => wordmark.classList.add('fly'), 9000);
        }
        resize(); pc();
    }

    // ---- показать/скрыть пароль ----
    const EYE = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    $$('input[type=password]').forEach(i => {
        const w = document.createElement('div'); w.className = 'pwwrap'; i.parentNode.insertBefore(w, i); w.appendChild(i);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'eye'; b.setAttribute('aria-label', 'Показать пароль'); b.innerHTML = EYE;
        b.onclick = () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.classList.toggle('on', show); b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль'); };
        w.appendChild(b);
    });

    // ---- единая навигация: одинаковое поведение на всех страницах ----
    const groups = [...document.querySelectorAll('.nav-group')];
    const setGroupOpen = (group, open) => {
        const button = group.querySelector('.nav-disclosure');
        const menu = group.querySelector('.nav-dropdown');
        if (!button || !menu) return;
        button.setAttribute('aria-expanded', String(open));
        group.classList.toggle('open', open);
        menu.hidden = !open;
    };
    const closeGroups = (except = null) => groups.forEach(group => {
        if (group !== except) setGroupOpen(group, false);
    });
    const rightEl = document.querySelector('.right'), linksEl = document.querySelector('.links');
    let burger = null;
    const setMainMenu = open => {
        if (!linksEl || !burger) return;
        linksEl.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', String(open));
        if (!open) closeGroups();
    };
    groups.forEach(group => {
        const button = group.querySelector('.nav-disclosure'), menu = group.querySelector('.nav-dropdown');
        if (!button || !menu) return;
        setGroupOpen(group, false);
        const open = () => { closeGroups(group); setGroupOpen(group, true); };
        button.addEventListener('click', () => {
            if (button.getAttribute('aria-expanded') === 'true') setGroupOpen(group, false);
            else open();
        });
        button.addEventListener('keydown', e => {
            if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
            e.preventDefault(); open();
            const items = [...menu.querySelectorAll('a')];
            (e.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus();
        });
        menu.addEventListener('keydown', e => {
            const items = [...menu.querySelectorAll('a')], i = items.indexOf(document.activeElement);
            if (!items.length) return;
            const target = { ArrowDown: (i + 1) % items.length, ArrowUp: (i - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[e.key];
            if (target !== undefined) { e.preventDefault(); items[target].focus(); }
        });
        group.addEventListener('focusout', e => {
            if (!group.contains(e.relatedTarget)) setGroupOpen(group, false);
        });
        menu.addEventListener('click', e => {
            if (e.target.closest('a')) { closeGroups(); setMainMenu(false); }
        });
    });
    if (rightEl && linksEl) {
        burger = document.createElement('button'); burger.type = 'button'; burger.className = 'theme burger';
        burger.setAttribute('aria-label', 'Основное меню'); burger.setAttribute('aria-controls', linksEl.id);
        burger.setAttribute('aria-expanded', 'false');
        burger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
        rightEl.appendChild(burger);
        burger.addEventListener('click', () => setMainMenu(!linksEl.classList.contains('open')));
        linksEl.addEventListener('click', e => { if (e.target.closest('a')) setMainMenu(false); });
        matchMedia('(max-width: 1000px)').addEventListener('change', () => setMainMenu(false));
    }
    document.addEventListener('click', e => {
        if (!e.target.closest('.nav-group')) closeGroups();
        if (!linksEl?.contains(e.target) && !burger?.contains(e.target)) setMainMenu(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const activeGroup = groups.find(group => group.classList.contains('open'));
        if (activeGroup) {
            e.preventDefault(); setGroupOpen(activeGroup, false);
            activeGroup.querySelector('.nav-disclosure')?.focus();
        } else if (linksEl?.classList.contains('open')) {
            setMainMenu(false); burger?.focus();
        }
    });

    document.querySelectorAll('.footer-settings').forEach(b => b.onclick = () => { window.openSettings(); ui.querySelector('.sclose').focus(); });

    // ---- анимированные счётчики ----
    const run = el => {
        const to = Number(el.dataset.count) || 0, suf = el.dataset.suffix || '', t0 = performance.now();
        if (!S.motion || osReduce()) { el.textContent = to + suf; return; }
        const step = t => { const p = Math.min(1, (t - t0) / 1000); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
    };
    const cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { cio.unobserve(e.target); run(e.target); } }), { threshold: .3 });
    window.watchCounts = (r = document) => r.querySelectorAll('[data-count]').forEach(el => cio.observe(el));
    watchCounts();


    // ---- отдельные слои парения и интерактивного наклона: без конфликтов с reveal ----
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    $$('[data-tilt]').forEach(t => {
        const scene = t.closest('.profile-scene') || t;
        let frame = 0, drag = null, target = { x: 0, y: 0, rx: 0, ry: 0 };
        const allowed = e => finePointer.matches && e.pointerType !== 'touch' && S.motion && !osReduce();
        const clamp = (n, max) => Math.max(-max, Math.min(max, n));
        const update = next => {
            target = next;
            if (!frame) frame = requestAnimationFrame(() => {
                frame = 0;
                t.style.setProperty('--profile-x', target.x.toFixed(2) + 'px'); t.style.setProperty('--profile-y', target.y.toFixed(2) + 'px');
                t.style.setProperty('--profile-rx', target.rx.toFixed(2) + 'deg'); t.style.setProperty('--profile-ry', target.ry.toFixed(2) + 'deg');
            });
        };
        const reset = () => { drag = null; t.classList.remove('dragging'); update({ x: 0, y: 0, rx: 0, ry: 0 }); };
        t.addEventListener('pointermove', e => {
            if (!allowed(e)) return reset();
            if (drag) {
                const x = clamp(e.clientX - drag.x, 24), y = clamp(e.clientY - drag.y, 24);
                update({ x, y, rx: -y / 5, ry: x / 5 });
            } else {
                const r = scene.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width - .5, .5), y = clamp((e.clientY - r.top) / r.height - .5, .5);
                update({ x: x * 10, y: y * 8, rx: -y * 12, ry: x * 12 });
            }
        });
        t.addEventListener('pointerdown', e => {
            if (!allowed(e) || e.button !== 0 || e.target.closest('a,button,input,textarea,select')) return;
            drag = { x: e.clientX, y: e.clientY }; t.setPointerCapture(e.pointerId); t.classList.add('dragging'); e.preventDefault();
        });
        t.addEventListener('pointerup', e => { if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId); reset(); });
        t.addEventListener('pointercancel', reset); t.addEventListener('lostpointercapture', reset);
        t.addEventListener('pointerleave', () => { if (!drag) reset(); });
        new MutationObserver(() => { if (root.dataset.motion === 'off') reset(); }).observe(root, { attributes: true, attributeFilter: ['data-motion'] });
    });
    // смена слов в заголовке: слова лежат друг на друге в одной ячейке (высота не прыгает), плавный кросс-фейд
    $$('.rot').forEach(el => {
        const w = el.dataset.words.split('|'); let i = 0;
        el.innerHTML = '<span class="sr-only">' + w[0].replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</span>' + w.map((t, k) => `<span aria-hidden="true" class="rw${k ? '' : ' on'}">${t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join('');
        const items = [...el.querySelectorAll('.rw')];
        setInterval(() => { if (!S.motion || osReduce() || document.hidden) return; items[i].classList.remove('on'); i = (i + 1) % items.length; items[i].classList.add('on'); }, 4800);
    });
})();
