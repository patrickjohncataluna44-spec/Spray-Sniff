import 'server-only'

import nodemailer from 'nodemailer'
import { getRequiredServerEnv } from '@/lib/server-runtime-env'

function getSmtpConfig() {
  const host = getRequiredServerEnv('SMTP_HOST')
  const port = Number(getRequiredServerEnv('SMTP_PORT'))
  const user = getRequiredServerEnv('SMTP_USER')
  const pass = getRequiredServerEnv('SMTP_PASS')
  const from = getRequiredServerEnv('SMTP_FROM')

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a valid number.')
  }

  return { host, port, user, pass, from }
}

function createTransporter() {
  const smtp = getSmtpConfig()

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function sendAccountWelcomeEmail(options: { email: string; name: string }) {
  const smtp = getSmtpConfig()
  const transporter = createTransporter()
  const displayName = options.name.trim() || 'Customer'

  await transporter.sendMail({
    from: smtp.from,
    to: options.email,
    subject: 'Your Spray & Sniff account is ready',
    text: `Hi ${displayName},

Your Spray & Sniff account has been created successfully.

You can now sign in using this email address and the password you just created.

If you did not create this account, please reply to this email right away.

Spray & Sniff`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #332d29;">
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>Your Spray &amp; Sniff account has been created successfully.</p>
        <p>You can now sign in using this email address and the password you just created.</p>
        <p>If you did not create this account, please reply to this email right away.</p>
        <p>Spray &amp; Sniff</p>
      </div>
    `,
  })
}

export async function sendAccountVerificationEmail(options: { email: string; name: string; verificationUrl: string }) {
  const smtp = getSmtpConfig()
  const transporter = createTransporter()
  const displayName = options.name.trim() || 'Customer'

  await transporter.sendMail({
    from: smtp.from,
    to: options.email,
    subject: 'Verify your Spray & Sniff account',
    text: `Hi ${displayName},

Please verify your Spray & Sniff account by opening this link:

${options.verificationUrl}

After verifying your email, go back to the sign-in page and log in with your email and password.

If you did not create this account, you can ignore this email.

Spray & Sniff`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #332d29;">
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>Please verify your Spray &amp; Sniff account by clicking the button below.</p>
        <p style="margin: 24px 0;">
          <a
            href="${escapeHtml(options.verificationUrl)}"
            style="display: inline-block; padding: 12px 20px; background: #b89968; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600;"
          >
            Verify Email
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p><a href="${escapeHtml(options.verificationUrl)}">${escapeHtml(options.verificationUrl)}</a></p>
        <p>After verifying your email, go back to sign in with your email and password.</p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p>Spray &amp; Sniff</p>
      </div>
    `,
  })
}
