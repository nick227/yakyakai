import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_PORT === '465',
  auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
})

export async function sendResetEmail(to, resetUrl) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'YakyakAI <noreply@yakyakai.com>',
    to,
    subject: 'Reset your YakyakAI password',
    text: `Reset your password (link expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Reset your YakyakAI password — link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  })
}
