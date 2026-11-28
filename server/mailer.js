const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
const secure = SMTP_SECURE === 'true';
const transport = SMTP_HOST && SMTP_USER && SMTP_PASS && nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || (secure ? 465 : 587),
    secure,
    requireTLS: !secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
});

exports.mailConfigured = Boolean(transport);
exports.sendMail = async (to, subject, text) => {
    if (!transport) return false;
    try {
        const result = await transport.sendMail({
            from: MAIL_FROM || { name: 'Первый шаг', address: SMTP_USER },
            to: { address: to },
            subject,
            text,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Первый шаг</h2><p>${text.replace(/\n/g, '<br>')}</p></div>`
        });
        return result.accepted.length > 0;
    } catch (err) {
        console.error('Ошибка SMTP при отправке кода', err.code || err.name, err.responseCode || '');
        return false;
    }
};
