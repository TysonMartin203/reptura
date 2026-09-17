// Uses Resend's HTTPS API rather than SMTP. Railway blocks outbound SMTP ports
// (25, 465, 587, 2525) entirely on Free/Trial/Hobby plans (and has had spotty
// enforcement even on Pro) — see https://docs.railway.com/reference/outbound-networking.
// An HTTPS API call on port 443 isn't subject to that restriction at all.

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!isConfigured()) throw new Error('Email sending is not configured yet.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Reptura <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Reset your Reptura password',
        text: `Someone requested a password reset for your Reptura account. If this was you, reset your password here: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
        html: `<p>Someone requested a password reset for your Reptura account.</p><p>If this was you, <a href="${resetUrl}">click here to reset your password</a>. This link expires in 1 hour.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Email provider timed out.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email provider returned ${res.status}: ${body.slice(0, 200)}`);
  }
}

module.exports = { sendPasswordResetEmail };
