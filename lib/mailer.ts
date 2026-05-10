import 'server-only'

import nodemailer from 'nodemailer'
import { formatPHP } from '@/lib/currency'
import { PAYMONGO_ORDER_CHECKOUT_DESCRIPTION } from '@/lib/paymongo'
import { SITE_NAME } from '@/lib/site'
import type { OrderRecord } from '@/lib/store-engine'
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

function getSenderEmailAddress(from: string) {
  const matchedAddress = from.match(/<([^>]+)>/)
  return matchedAddress?.[1]?.trim() || from.trim()
}

function getOrderPaidAt(order: OrderRecord) {
  const paymentTimelineEntry = [...order.timeline]
    .reverse()
    .find((entry) => entry.note.toLowerCase().includes('payment'))

  return paymentTimelineEntry?.createdAt ?? order.createdAt
}

function getPaymongoChannelFromNotes(order: OrderRecord) {
  const segments =
    order.notes
      ?.split('|')
      .map((value) => value.trim())
      .filter(Boolean) ?? []

  const paymentChannelSegment = segments.find((segment) => segment.startsWith('PayMongo channel:'))

  return paymentChannelSegment?.replace('PayMongo channel:', '').trim() || undefined
}

function getReceiptPaymentMethodLabel(order: OrderRecord) {
  return getPaymongoChannelFromNotes(order) ?? order.paymentMethod
}

function formatReceiptDate(dateValue: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue))
}

function createReceiptItemLabel(item: OrderRecord['items'][number]) {
  return `${item.productName} ${item.size}ml x ${item.quantity}`
}

function buildReceiptText(options: {
  order: OrderRecord
  displayName: string
  contactEmail: string
  paymentMethodLabel: string
  paidDate: string
}) {
  const { order, displayName, contactEmail, paymentMethodLabel, paidDate } = options
  const itemLines = order.items
    .map((item) => `${createReceiptItemLabel(item)} - ${formatPHP(item.unitPrice * item.quantity)}`)
    .join('\n')

  return `Your receipt from ${SITE_NAME}

Hi ${displayName},

Thank you for your payment. Here's a copy of your receipt.

Order details
${itemLines}

Amount paid
${formatPHP(order.total)}

Payment description
${PAYMONGO_ORDER_CHECKOUT_DESCRIPTION}

Billed to
${displayName}
${order.customerEmail}

Payment method
${paymentMethodLabel}

Date paid
${paidDate}

If you have any questions about this payment, contact ${SITE_NAME} at ${contactEmail}.`
}

function buildReceiptHtml(options: {
  order: OrderRecord
  displayName: string
  contactEmail: string
  paymentMethodLabel: string
  paidDate: string
}) {
  const { order, displayName, contactEmail, paymentMethodLabel, paidDate } = options
  const receiptRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 0 0 14px; color: #1f1f1f; font-size: 14px;">${escapeHtml(createReceiptItemLabel(item))}</td>
          <td style="padding: 0 0 14px; color: #1f1f1f; font-size: 14px; text-align: right; white-space: nowrap;">${escapeHtml(formatPHP(item.unitPrice * item.quantity))}</td>
        </tr>
      `,
    )
    .join('')

  return `
    <div style="margin: 0; padding: 32px 16px; background: #eaf2e5; font-family: Arial, sans-serif; color: #2f2c2a;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff;">
        <div style="padding: 28px 32px; background: #18483f; color: #ffffff;">
          <p style="margin: 0; font-size: 13px; font-weight: 600;">Your receipt from</p>
          <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700;">${escapeHtml(SITE_NAME)}</p>
        </div>

        <div style="padding: 28px 32px;">
          <p style="margin: 0 0 12px; font-size: 30px; line-height: 1.2; color: #2f2c2a;">Hi ${escapeHtml(displayName)},</p>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5b5755;">Thank you for your payment. Here's a copy of your receipt.</p>
        </div>

        <div style="border-top: 1px solid #d8dde0;">
          <div style="padding: 18px 32px 8px;">
            <p style="margin: 0; font-size: 13px; color: #7a7674;">Order details</p>
          </div>
          <div style="padding: 12px 32px 2px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${receiptRows}
            </table>
          </div>
        </div>

        <div style="border-top: 1px solid #eef1f3; padding: 18px 32px 22px;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #999492;">Amount paid</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #2f2c2a;">${escapeHtml(formatPHP(order.total))}</p>
        </div>

        <div style="border-top: 1px solid #eef1f3; padding: 18px 32px 22px;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #999492;">Payment description</p>
          <p style="margin: 0; font-size: 15px; color: #2f2c2a;">${escapeHtml(PAYMONGO_ORDER_CHECKOUT_DESCRIPTION)}</p>
        </div>

        <div style="border-top: 1px solid #eef1f3; padding: 18px 32px 22px;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #999492;">Billed to</p>
          <p style="margin: 0; font-size: 15px; color: #2f2c2a;">${escapeHtml(displayName)}</p>
          <p style="margin: 6px 0 0; font-size: 14px; color: #5b5755;">${escapeHtml(order.customerEmail)}</p>
        </div>

        <div style="border-top: 1px solid #eef1f3;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width: 50%; padding: 18px 32px 22px; vertical-align: top; border-right: 1px solid #eef1f3;">
                <p style="margin: 0 0 10px; font-size: 13px; color: #999492;">Payment method</p>
                <p style="margin: 0; font-size: 15px; color: #2f2c2a;">${escapeHtml(paymentMethodLabel)}</p>
              </td>
              <td style="width: 50%; padding: 18px 32px 22px; vertical-align: top;">
                <p style="margin: 0 0 10px; font-size: 13px; color: #999492;">Date paid</p>
                <p style="margin: 0; font-size: 15px; color: #2f2c2a;">${escapeHtml(paidDate)}</p>
              </td>
            </tr>
          </table>
        </div>

        <div style="border-top: 1px solid #eef1f3; padding: 18px 32px 28px;">
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #5b5755;">If you have any questions about this payment, contact ${escapeHtml(SITE_NAME)} at <a href="mailto:${escapeHtml(contactEmail)}" style="color: #18483f; text-decoration: none;">${escapeHtml(contactEmail)}</a>.</p>
        </div>
      </div>
    </div>
  `
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

export async function sendPaymongoReceiptEmail(options: { order: OrderRecord }) {
  const smtp = getSmtpConfig()
  const transporter = createTransporter()
  const displayName = options.order.customerName.trim() || 'Customer'
  const contactEmail = getSenderEmailAddress(smtp.from)
  const paymentMethodLabel = getReceiptPaymentMethodLabel(options.order)
  const paidDate = formatReceiptDate(getOrderPaidAt(options.order))

  await transporter.sendMail({
    from: smtp.from,
    to: options.order.customerEmail,
    subject: `Your receipt from ${SITE_NAME}`,
    text: buildReceiptText({
      order: options.order,
      displayName,
      contactEmail,
      paymentMethodLabel,
      paidDate,
    }),
    html: buildReceiptHtml({
      order: options.order,
      displayName,
      contactEmail,
      paymentMethodLabel,
      paidDate,
    }),
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
