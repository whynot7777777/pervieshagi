(() => {
    const root = document.documentElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const $$ = s => [...document.querySelectorAll(s)];

    // Header navigation uses native links. Handle them in capture phase so unrelated
    // page-level bubbling handlers cannot accidentally swallow a click.
    document.addEventListener('click', event => {
        const link = event.target.closest && event.target.closest('.site-header .links a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = link.getAttribute('target');
        if (target && target !== '_self') return;
        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        event.preventDefault();
        window.location.assign(destination.href);
    }, true);
    const DEF = { mode: 'dark', palette: 'mono', halftone: true, density: 1, speed: 1, glow: 1, grain: true, radius: 20, font: 1, motion: true, respectOS: false };
    let S = { ...DEF };
    try {
        const legacy = JSON.parse(localStorage.getItem('settings') || 'null');
        const savedTheme = localStorage.getItem('theme') || (legacy && legacy.mode);
        if (savedTheme === 'light' || savedTheme === 'dark') S.mode = savedTheme;
    } catch { }
    const osReduce = () => !!S.respectOS && reducedMotion.matches;
    const save = () => { try { localStorage.setItem('theme', S.mode); } catch { } };
    function apply() {
        const dark = S.mode === 'dark';
        root.dataset.theme = dark ? 'dark' : 'light';
        root.dataset.palette = 'mono';
        root.dataset.motion = S.motion && !osReduce() ? 'on' : 'off';
        root.dataset.osReduce = osReduce() ? 'on' : 'off';
        root.style.setProperty('--gk', '1');
        root.style.setProperty('--r', '20px');
        root.style.setProperty('--fs', '1');
        root.style.setProperty('--grain', '');
        const toggle = document.getElementById('theme');
        if (toggle) {
            toggle.setAttribute('aria-label', dark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему');
            toggle.setAttribute('title', dark ? 'Светлая тема' : 'Тёмная тема');
            toggle.setAttribute('aria-pressed', String(dark));
        }
    }
    apply();
    root.classList.remove('no-js');
    let sync = () => { }, pc = () => { }, syncProfiles = () => { };
    let tm;
    reducedMotion.addEventListener('change', () => { apply(); pc(); syncProfiles(); });
    const commit = () => {
        root.classList.add('theming'); clearTimeout(tm); tm = setTimeout(() => root.classList.remove('theming'), 800);
        apply(); save(); sync(); pc(); syncProfiles();
    };
    const tb = document.getElementById('theme');
    if (tb) tb.onclick = () => { S.mode = S.mode === 'dark' ? 'light' : 'dark'; commit(); };
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
                    // Broad animated halftone ribbon across the viewport.
                    const edge = .22 + .78 * Math.max(0, 1 - Math.abs(u - (.5 + .18 * Math.sin(phase * .7))) / .72);
                    const ribbon = .48 + .22 * Math.sin(u * 5.4 + phase) + .10 * Math.sin(u * 11 - phase * .6);
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
        if (home) {
            const wordmark = document.createElement('div');
            wordmark.className = 'halftone-wordmark';
            wordmark.textContent = 'Первый опыт';
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
