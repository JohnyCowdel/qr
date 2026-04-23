import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@qr-game.vercel.app";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

export async function sendApprovalEmail(userEmail: string, userHandle: string) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: "🎉 Tvá přihláška byla schválena!",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                line-height: 1.6;
                color: #223027;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 2px solid #d56c32;
              }
              .content {
                padding: 30px 0;
              }
              .button {
                display: inline-block;
                background-color: #d56c32;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 999px;
                font-weight: 600;
                margin-top: 20px;
              }
              .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #e0d9d3;
                font-size: 12px;
                color: #8b7765;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Vítej v QR Impériu!</h1>
              </div>
              
              <div class="content">
                <p>Ahoj <strong>${userHandle}</strong>,</p>
                
                <p>Vaše přihláška byla schválena správcem. Nyní se můžete přihlásit a začít hrát!</p>
                
                <h3>Jak začít?</h3>
                <ol>
                  <li>Přihlaste se na <a href="https://qrempire.space/auth/login">QR Území</a></li>
                  <li>Vyberte si svůj tým</li>
                  <li>Naskenujte QR kód na místě a obsaďte lokaci</li>
                  <li>Užívejte si hru! 🎮</li>
                </ol>
                
                <p>Máte otázky? Podívejte se na <a href="https://qrempire.space/jak-na-to">Jak na to?</a></p>
                
                <a href="https://qrempire.space/auth/login" class="button">Přihlásit se →</a>
              </div>
              
              <div class="footer">
                <p>Tento email byl odeslán automaticky. Neodpovídejte na něj.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { ok: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { ok: false, error: String(error) };
  }
}

export async function sendLoginEmail(userEmail: string, loginToken: string, userHandle: string) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://qr-game.vercel.app"}/auth/verify?token=${loginToken}`;
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: "🔐 Tvůj přihlašovací odkaz",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                line-height: 1.6;
                color: #223027;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 2px solid #d56c32;
              }
              .content {
                padding: 30px 0;
              }
              .button {
                display: inline-block;
                background-color: #d56c32;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 999px;
                font-weight: 600;
                margin-top: 20px;
              }
              .code {
                background-color: #f5f1ed;
                padding: 15px;
                border-radius: 8px;
                font-family: monospace;
                word-break: break-all;
                margin: 15px 0;
              }
              .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #e0d9d3;
                font-size: 12px;
                color: #8b7765;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Přihlašovací odkaz</h1>
              </div>
              
              <div class="content">
                <p>Ahoj <strong>${userHandle}</strong>,</p>
                
                <p>Klikněte na tlačítko níže pro přihlášení do QR Území:</p>
                
                <a href="${loginUrl}" class="button">Přihlásit se →</a>
                
                <p>Nebo zkopírujte tento odkaz do adresního řádku:</p>
                <div class="code">${loginUrl}</div>
                
                <p>Odkaz vyprší za 24 hodin.</p>
              </div>
              
              <div class="footer">
                <p>Pokud jste si to neobjednali, ignorujte tento email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { ok: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { ok: false, error: String(error) };
  }
}
