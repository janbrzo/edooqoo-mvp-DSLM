# Supabase Confirmation Email — Custom Template

Paste into Supabase Dashboard → Authentication → Email Templates → "Confirm signup".

**Subject**: `Confirm your Edooqoo account`
**Sender name**: `Edooqoo` (Project Settings → Auth → SMTP)

```html
<!DOCTYPE html>
<html lang="en"><body style="margin:0;background:#fff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1220;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e5e7eb;border-radius:12px;">
<tr><td style="padding:32px;">
<div style="font-size:14px;color:#5E3FD9;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Edooqoo</div>
<h1 style="margin:12px 0 8px;font-size:24px;color:#0b1220;">Confirm your email</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">Click the button below to activate your Edooqoo account. After confirming, you'll get a welcome email with next steps.</p>
<p style="text-align:center;margin:0 0 20px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#5E3FD9;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">Confirm email</a></p>
<p style="font-size:12px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px;">Edooqoo · hello@edooqoo.com</p>
</td></tr></table></td></tr></table></body></html>
```

Reply-to (`hello@edooqoo.com`) requires custom SMTP — not configured. Optional future improvement.

```wcześniej był taki
<!DOCTYPE html>
<html>
  <body style="font-family: sans-serif; background-color: #f5f5f5; padding: 20px; color: #333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
      <tr>
        <td>
          <h2 style="color: #111;">Welcome{{if.UserMetadata.first_name}},{{.UserMetadata.first_name}}{{end}} to EDOOQOO!</h2>
          <p style="font-size: 16px;">You're in! Get ready to generate unique ESL worksheets tailored to your students in seconds.</p>

          <p style="font-size: 16px; margin-top: 20px;">To activate your account, click the button below:</p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" style="background-color: #5a67d8; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Confirm your email
            </a>
          </p>

          <p style="font-size: 16px;">After confirming, you'll instantly get <strong>2 free tokens</strong> to explore the platform and create your first materials - no strings attached.</p>

          <p style="font-size: 15px; color: #777; margin-top: 40px;">If you didn’t sign up, feel free to ignore this message.</p>

          <p style="font-size: 15px; color: #777;">— EDOOQOO Team</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```
