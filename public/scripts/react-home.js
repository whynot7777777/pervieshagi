(() => {
    const mountNode = document.getElementById('react-hero-tools');
    if (!mountNode || !window.React || !window.ReactDOM) return;
    document.getElementById('hero-fallback')?.setAttribute('hidden', '');

    const { useState } = window.React;
    const modes = {
        student: {
            eyebrow: 'Для студентов',
            title: 'Покажи, что умеешь',
            text: 'Собери профиль за несколько минут и получай стажировки, которые подходят именно тебе.',
            action: 'Создать профиль',
            href: '/pages/register.html'
        },
        company: {
            eyebrow: 'Для компаний',
            title: 'Найди сильных новичков',
            text: 'Публикуй задачи и находи студентов, готовых расти вместе с вашей командой.',
            action: 'Разместить вакансию',
            href: '/pages/partners.html'
        }
    };

    function HeroTools() {
        const [mode, setMode] = useState('student');
        const copy = modes[mode];
        const choose = next => {
            setMode(next);
        };

        return React.createElement('div', { className: 'react-hero-tools rounded-4 border p-3 p-md-4', 'aria-live': 'polite' },
            React.createElement('div', { className: 'd-flex flex-wrap gap-2 mb-3', role: 'tablist', 'aria-label': 'Выберите сценарий' },
                Object.entries(modes).map(([key, item]) => React.createElement('button', {
                    key,
                    type: 'button',
                    role: 'tab',
                    'aria-selected': mode === key,
                    className: `btn btn-sm react-mode ${mode === key ? 'active' : ''}`,
                    onClick: () => choose(key)
                }, item.eyebrow))
            ),
            React.createElement('div', { className: 'react-hero-copy', key: mode },
                React.createElement('span', { className: 'react-hero-kicker' }, copy.eyebrow),
                React.createElement('strong', null, copy.title),
                React.createElement('p', null, copy.text),
                React.createElement('a', {
                    className: 'btn btn-light btn-sm react-action', href: copy.href, onClick: e => {
                    }
                }, copy.action, '  ')
            )
        );
    }

    window.ReactDOM.createRoot(mountNode).render(React.createElement(HeroTools));
})();
