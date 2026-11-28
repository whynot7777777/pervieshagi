const { Resend } = require('resend');

const { RESEND_API_KEY, MAIL_FROM } = process.env;

const mailConfigured = Boolean(RESEND_API_KEY);
const resend = mailConfigured ? new Resend(RESEND_API_KEY) : null;

exports.mailConfigured = mailConfigured;

exports.sendMail = async (to, subject, text, customHtml) => {
    if (!resend) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('RESEND_API_KEY не настроен. Письмо не отправлено.');
        }
        return false;
    }

    try {
        const escapedText = String(text)
            .replace(/[&<>"']/g, c => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[c]))
            .replace(/\n/g, '<br>');

        const { data, error } = await resend.emails.send({
            from: MAIL_FROM || 'Первый опыт <noreply@xn--b1afjbhk1al3e.xn--p1ai>',
            to: [to],
            subject: subject,
            text: text,
            html: customHtml || `
                <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
                    <h2 style="color:#333;">Первый опыт</h2>
                    <div style="font-size: 16px; margin: 20px 0;">
                        ${escapedText}
                    </div>
                    <p style="color:#888;font-size:12px;margin-top:30px;">
                        Если вы не запрашивали это письмо, просто проигнорируйте его.
                    </p>
                </div>
            `
        });

        if (error) {
            console.error('❌ Ошибка Resend:', error);
            return false;
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('Письмо успешно отправлено:', data?.id);
        }
        return true;
    } catch (err) {
        console.error('❌ Критическая ошибка при отправке письма:', err);
        return false;
    }
};
