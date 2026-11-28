// Подбор вакансий под профиль студента: навыки (45%), интересы (40%), город/удалённо (15%).
// Если в профиле нет ни навыков, ни интересов — процент не считается (match = null).
const STOP = new Set(['опыт', 'опыта', 'опыте', 'хочу', 'хотел', 'хотелось', 'работа', 'работы', 'работать', 'работу', 'компания', 'компании',
  'студент', 'студента', 'стажировка', 'стажировки', 'стажер', 'любой', 'любая', 'чтобы', 'очень', 'своей', 'своего']);
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
const words = s => norm(s).split(/[^a-zа-я0-9#+]+/).filter(w => w.length >= 3 && !STOP.has(w));
const stem = w => (w.length > 5 ? w.slice(0, 5) : w); // грубая основа слова: «маркетолог» ~ «маркетинг»
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bounded = (s, hay) => new RegExp(`(^|[^a-zа-я0-9])${reEsc(s)}($|[^a-zа-я0-9])`).test(hay);

function prepare(p) {
  if (!p) return null;
  const skills = String(p.skills || '').split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length >= 2);
  const interestText = norm([p.desired_experience, p.specialty, p.about].filter(Boolean).join(' '));
  const keys = new Set(words(interestText).map(stem));
  if (!skills.length && !keys.size) return null;
  return { skills, interestText, keys, city: norm(p.city).trim() };
}

function score(prep, v) {
  if (!prep) return { match: null, why: [] };
  const hay = norm(`${v.title} ${v.category || ''} ${v.description || ''}`);
  const hayStems = new Set(words(hay).map(stem));
  const why = [], parts = [];
  if (prep.skills.length) {
    const hit = prep.skills.filter(sk => {
      const s = norm(sk).trim();
      if (s.length <= 3 || /[#+]/.test(s)) return bounded(s, hay);
      if (hay.includes(s)) return true;
      const w = words(s);
      return w.length === 1 && s.length >= 6 && hayStems.has(stem(w[0]));
    });
    parts.push([.45, Math.min(1, hit.length / Math.min(prep.skills.length, 3))]);
    if (hit.length) why.push('Навыки: ' + hit.slice(0, 3).join(', '));
  }
  if (prep.keys.size) {
    const cat = norm(v.category).trim();
    const catHit = cat && (cat.length <= 3 ? bounded(cat, prep.interestText) : prep.interestText.includes(cat));
    let overlap = 0;
    for (const k of prep.keys) if (hayStems.has(k)) overlap++;
    const val = catHit ? 1 : Math.min(1, overlap / Math.min(3, prep.keys.size));
    parts.push([.4, val]);
    if (val >= .34) why.push('По вашим интересам');
  }
  const vc = norm(v.city).trim();
  let cv = .5;
  if (v.format === 'Удалённо') { cv = 1; why.push('Удалённо'); }
  else if (prep.city && vc) { cv = prep.city === vc ? 1 : .1; if (cv === 1) why.push('Ваш город'); }
  parts.push([.15, cv]);
  const wsum = parts.reduce((a, [w]) => a + w, 0), total = parts.reduce((a, [w, x]) => a + w * x, 0);
  return { match: Math.round(100 * total / wsum), why: why.slice(0, 3) };
}
module.exports = { prepare, score };
