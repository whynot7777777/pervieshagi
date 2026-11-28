const bcrypt = require('bcryptjs');
const { query, one, init, pool } = require('./database');

const companies = [
    ['СеверСофт', 'IT и разработка', 'Москва'], ['Волга Диджитал', 'IT и разработка', 'Казань'],
    ['Неон Медиа', 'Маркетинг и медиа', 'Санкт-Петербург'], ['Контур Лаб', 'Финтех', 'Екатеринбург'],
    ['УралТех', 'Инженерия', 'Екатеринбург'], ['Городской Сервис', 'Сервис и логистика', 'Новосибирск'],
    ['Альфа Энерго', 'Энергетика', 'Самара'], ['ПромАвтоматика', 'Производство', 'Тула'],
    ['Маяк Образование', 'Образование', 'Москва'], ['Лайт Архитектура', 'Архитектура', 'Нижний Новгород'],
    ['ФармаПлюс', 'Медицина и фармация', 'Воронеж'], ['ЭкоКонтроль', 'Экология', 'Краснодар']
];
const roles = [
    ['Стажёр-разработчик JavaScript', 'Программирование'], ['Junior QA-инженер', 'Тестирование и QA'],
    ['Стажёр-аналитик данных', 'Аналитика данных'], ['Помощник системного администратора', 'Системное администрирование'],
    ['Младший UX/UI-дизайнер', 'UX/UI'], ['Контент-менеджер', 'SMM и контент'],
    ['Ассистент бухгалтера', 'Финансы и бухгалтерия'], ['Менеджер по работе с клиентами', 'Клиентский сервис'],
    ['Стажёр-инженер', 'Инженерия'], ['Техник по автоматизации', 'Электроника и автоматизация'],
    ['Координатор логистики', 'Логистика'], ['Помощник проектировщика', 'Архитектура'],
    ['Лаборант-стажёр', 'Медицина и фармация'], ['Ассистент эколога', 'Экология'],
    ['Помощник маркетолога', 'Маркетинг'], ['Стажёр по HR', 'HR'],
    ['Помощник юриста', 'Юриспруденция'], ['Младший специалист по продажам', 'Продажи'],
    ['Стажёр по информационной безопасности', 'Информационная безопасность'], ['Помощник технолога', 'Производство']
];
const cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск', 'Самара'];
const formats = ['Офис', 'Гибрид', 'Удалённо'];

async function main() {
    await init();
    const password = bcrypt.hashSync('DemoPass123!', 10);
    for (let i = 0; i < companies.length; i += 1) {
        const [name, industry, city] = companies[i];
        const email = `demo-company-${String(i + 1).padStart(2, '0')}@example.com`;
        const user = await one(`INSERT INTO users (email, password_hash, role, email_verified)
      VALUES ($1,$2,'company',true) ON CONFLICT (email) DO UPDATE SET role='company', email_verified=true RETURNING id`, [email, password]);
        const userId = user.id || (await one('SELECT id FROM users WHERE email = $1', [email])).id;
        await query(`INSERT INTO companies (user_id, name, industry, city, description, approved)
      VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (user_id) DO UPDATE SET name=EXCLUDED.name, industry=EXCLUDED.industry, city=EXCLUDED.city, approved=true`,
            [userId, name, industry, city, `Учебные вакансии компании ${name} для студентов и начинающих специалистов.`]);
        for (let j = 0; j < 3; j += 1) {
            const role = roles[(i * 3 + j) % roles.length];
            const title = `${role[0]} · ${name}`;
            await query(`INSERT INTO vacancies (company, title, description, company_id, city, format, category, paid, is_active)
        SELECT $1,$2,$3,$4,$5,$6,$7,$8,true WHERE NOT EXISTS (SELECT 1 FROM vacancies WHERE company_id=$4 AND title=$2)`,
                [name, title, `Практические задачи в команде, наставник и понятный план развития. Подходит студентам СПО и вузов.`, userId, cities[(i + j) % cities.length], formats[(i + j) % formats.length], role[1], j % 2 === 0]);
        }
    }
    const counts = await one(`SELECT (SELECT COUNT(*)::int FROM companies WHERE approved) companies, (SELECT COUNT(*)::int FROM vacancies WHERE is_active) vacancies`);
    console.log(`Seed готов: ${counts.companies} компаний, ${counts.vacancies} вакансий`);
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => pool.end());
