import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

// Attempt to create a Nodemailer transporter if SMTP settings are provided.
let transporter: any;
let isEthereal = false;
let etherealInitPromise: Promise<void> | null = null;

// Debug: log SMTP config status at startup
console.log('[Mailer] SMTP_HOST:', process.env.SMTP_HOST || '(not set)');
console.log('[Mailer] SMTP_USER:', process.env.SMTP_USER || '(not set)');
console.log('[Mailer] SMTP_PASS:', process.env.SMTP_PASS ? '***set***' : '(not set)');
console.log('[Mailer] SMTP_FROM:', process.env.SMTP_FROM || '(not set)');

try {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('[Mailer] Creating SMTP transporter with Gmail config...');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        // Gmail requires an App Password (not your regular login password).
        // Generate one at: https://myaccount.google.com/apppasswords
        // Ensure 2-Step Verification is enabled on the Gmail account first.
        pass: process.env.SMTP_PASS,
      },
      tls: {
        // Prevent certificate errors in some network environments
        rejectUnauthorized: false,
      },
    });
    console.log('[Mailer] SMTP transporter created successfully.');
  } else {
    console.log('[Mailer] No SMTP config found. Creating Ethereal Test Account...');
    etherealInitPromise = nodemailer.createTestAccount().then((account: any) => {
      transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass
        }
      });
      isEthereal = true;
      console.log('[Mailer] Ethereal Email test account created successfully!');
    }).catch((err: any) => {
      console.warn('[Mailer] Failed to create Ethereal account, falling back to console:', err);
    });
  }
} catch (e) {
  console.warn('[Mailer] Nodemailer failed to initialize – email will be logged to console', e);
}

/**
 * Sends an email. If a valid transporter exists, it uses Nodemailer;
 * otherwise it falls back to logging the email contents.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<string | void> {
  if (etherealInitPromise) await etherealInitPromise;
  
  console.log(`[Mailer] sendMail called → To: "${to}", Subject: "${subject}"`);

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '"Exam Scheduler" <noreply@example.com>',
    to,
    subject,
    html,
  };

  if (transporter) {
    console.log(`[Mailer] Sending via SMTP → From: "${mailOptions.from}" → To: "${mailOptions.to}"`);
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Mailer] ✅ Email sent successfully! MessageId: ${info.messageId}, Response: ${info.response}`);
      if (isEthereal) {
        const url = nodemailer.getTestMessageUrl(info);
        console.log('[Mailer] Ethereal Preview URL: ' + url);
        return url as string;
      }
    } catch (sendErr: any) {
      console.warn(`[Mailer] ❌ Failed to send email to "${to}" via configured SMTP:`, sendErr.message || sendErr);
      
      // If it's not already Ethereal, try falling back to Ethereal
      if (!isEthereal) {
        console.log('[Mailer] Attempting Ethereal test account fallback...');
        try {
          const account = await nodemailer.createTestAccount();
          const etherealTransporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
              user: account.user,
              pass: account.pass
            }
          });
          const info = await etherealTransporter.sendMail(mailOptions);
          const url = nodemailer.getTestMessageUrl(info);
          console.log('[Mailer] ✅ Ethereal Fallback sent successfully! Preview URL: ' + url);
          return url as string;
        } catch (etherealErr: any) {
          console.error('[Mailer] ❌ Ethereal fallback also failed:', etherealErr.message || etherealErr);
        }
      }
      
      // If everything else fails, log to console and return a mock URL
      console.log('[Mailer] Final fallback: Logging email to console:');
      console.log('=== Email Notification (SMTP FAIL FALLBACK) ===');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Body:', html);
      console.log('=== End Email ===');
      return 'https://ethereal.email/message/fallback-logged-to-console';
    }
  } else {
    console.log('[Mailer] No transporter available – logging email to console:');
    console.log('=== Email Notification ===');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', html);
    console.log('=== End Email ===');
    return 'https://ethereal.email/message/fallback-logged-to-console';
  }
}
