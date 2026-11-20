const { Resend } = require('resend');

const { RESEND_API_KEY } = process.env;
const mailConfigured = Boolean(RESEND_API_KEY);
const resend = mailConfigured ? new Resend(RESEND_API_KEY) : null;

exports.mailConfigured = mailConfigured;

exports.sendMail = async (to, subject, text) => {
    if (!resend) {
        console.log('⚠️ RESEND_API_KEY не настроен. Письмо не отправлено.');
        return false;
    }

    try {
        // Формируем красивый HTML-шаблон
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                    .header { background: #1a1a1a; padding: 30px 20px; text-align: center; color: white; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
                    .content { padding: 40px 30px; text-align: center; color: #333333; }
                    .code-box { display: inline-block; background: #f0f4f8; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px 40px; margin: 25px 0; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b; }
                    .text { font-size: 16px; line-height: 1.6; margin-bottom: 10px; color: #475569; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
                    .footer a { color: #64748b; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Первый шаг</h1>
                    </div>
                    <div class="content">
                        <p class="text">Ваш код подтверждения:</p>
                        <div class="code-box">${text}</div>
                        <p class="text">Введите этот код на сайте. Он действует 10 минут.</p>
                    </div>
                    <div class="footer">
                        Если вы не запрашивали этот код, просто проигнорируйте это письмо.<br>
                        С уважением, команда <strong>Первый шаг</strong>.
                    </div>
                </div>
            </body>
            </html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'Первый шаг <proof@project.wn-7.ru>',
            to: [to],
            subject: subject,
            text: text, // Отправляем чистый текст (только код) для почтовых клиентов без HTML
            html: html,
        });

        if (error) {
            console.error('❌ Ошибка Resend:', error);
            return false;
        }

        console.log(`✅ Письмо успешно отправлено на ${to} (ID: ${data.id})`);
        return true;
    } catch (err) {
        console.error('❌ Критическая ошибка при отправке:', err);
        return false;
    }
};