// Письмо с кодом в стиле сайта: глубокий чёрный, слоновая кость, halftone.
// Картинки лежат в public/img и подтягиваются по SITE_URL (письмо остаётся читаемым и без них).
const SITE = (process.env.SITE_URL || 'https://project.wn-7.ru').replace(/\/+$/, '');

const COPY = {
    verify: {
        eyebrow: 'Подтверждение почты',
        title: 'Ваш код подтверждения',
        lead: 'Введите этот код на странице подтверждения, чтобы завершить регистрацию и начать откликаться на стажировки.',
        cta: 'Открыть страницу подтверждения',
        path: '/pages/verify.html'
    },
    reset: {
        eyebrow: 'Сброс пароля',
        title: 'Код для смены пароля',
        lead: 'Мы получили запрос на восстановление доступа. Введите код на странице восстановления и задайте новый пароль.',
        cta: 'Перейти к восстановлению',
        path: '/pages/forgot.html'
    }
};

const FONT = "'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono','SF Mono',SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

exports.codeEmail = ({ code, purpose = 'verify', minutes = 10 }) => {
    const c = COPY[purpose] || COPY.verify;
    const safeCode = String(code).replace(/[^0-9]/g, '');
    const link = SITE + c.path;

    const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${c.title} — Первый шаг</title>
<style>
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0;padding:0;background:#050506}
a{color:#f1f1ef}
@media only screen and (max-width:640px){
  .wrap{padding:12px 8px!important}
  .pad{padding-left:22px!important;padding-right:22px!important}
  .code{font-size:34px!important;letter-spacing:8px!important;padding-left:8px!important}
  .title{font-size:24px!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:#050506;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#050506;font-size:1px;line-height:1px;">Ваш код: ${safeCode}. Действует ${minutes} минут.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050506" style="background:#050506;">
<tr><td align="center" class="wrap" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#09090b" style="width:100%;max-width:600px;background:#09090b;border:1px solid #1f1f24;border-radius:24px;overflow:hidden;">

    <!-- halftone-шапка -->
    <tr><td style="padding:0;line-height:0;font-size:0;background:#050506;">
      <img src="${SITE}/img/mail-halftone.png" width="600" alt="Первый шаг" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;background:#050506;color:#f1f1ef;font:700 28px ${FONT};line-height:1.4;">
    </td></tr>

    <tr><td class="pad" style="padding:36px 44px 8px;font-family:${FONT};">
      <div style="font:600 11px ${FONT};letter-spacing:.22em;text-transform:uppercase;color:#8d8d94;">${c.eyebrow}</div>
      <h1 class="title" style="margin:14px 0 0;font:700 28px/1.2 ${FONT};letter-spacing:-.02em;color:#f1f1ef;">${c.title}</h1>
      <p style="margin:14px 0 0;font:400 15px/1.65 ${FONT};color:#a8a8b0;">${c.lead}</p>
    </td></tr>

    <!-- код -->
    <tr><td class="pad" style="padding:26px 44px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e0e11" style="background:#0e0e11;border:1px solid #2a2a30;border-radius:18px;">
        <tr><td align="center" style="padding:30px 12px 10px;font:600 11px ${FONT};letter-spacing:.2em;text-transform:uppercase;color:#6f6f78;">Одноразовый код</td></tr>
        <tr><td align="center" class="code" style="padding:0 12px 14px 24px;font-family:${MONO};font-size:46px;line-height:1.1;font-weight:700;letter-spacing:14px;color:#f1f1ef;">${safeCode}</td></tr>
        <tr><td align="center" style="padding:0 12px 28px;font:400 13px ${FONT};color:#8d8d94;">Действует ${minutes} минут</td></tr>
      </table>
    </td></tr>

    <!-- кнопка -->
    <tr><td class="pad" align="left" style="padding:24px 44px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#f1f1ef" style="background:#f1f1ef;border-radius:999px;">
          <a href="${link}" style="display:inline-block;padding:14px 28px;font:600 14px ${FONT};color:#050506;text-decoration:none;border-radius:999px;">${c.cta}&nbsp;&rarr;</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- безопасность -->
    <tr><td class="pad" style="padding:28px 44px 34px;font-family:${FONT};">
      <div style="height:1px;line-height:1px;font-size:1px;background:#1f1f24;margin-bottom:20px;">&nbsp;</div>
      <p style="margin:0;font:400 13px/1.65 ${FONT};color:#8d8d94;">Никому не сообщайте этот код: сотрудники «Первого шага» никогда его не спрашивают. Если вы ничего не запрашивали, просто проигнорируйте письмо — без кода никто не получит доступ к вашему аккаунту.</p>
    </td></tr>

    <!-- halftone-подвал -->
    <tr><td style="padding:0;line-height:0;font-size:0;background:#050506;">
      <img src="${SITE}/img/mail-halftone-foot.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#050506;">
    </td></tr>
    <tr><td align="center" style="padding:18px 24px 26px;background:#050506;font:400 12px/1.6 ${FONT};color:#6f6f78;">
      <a href="${SITE}" style="color:#a8a8b0;text-decoration:none;font-weight:600;">Первый шаг</a> &nbsp;·&nbsp; платформа стажировок для студентов<br>
      Это автоматическое письмо, отвечать на него не нужно.
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

    const text = `${c.title}\n\nВаш код: ${safeCode}\nОн действует ${minutes} минут.\n\n${c.cta}: ${link}\n\nЕсли это были не вы, просто проигнорируйте письмо. Никому не сообщайте код.`;
    return { html, text };
};
