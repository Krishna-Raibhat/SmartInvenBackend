import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// OTP EMAIL
export const sendOtpEmail = async ({ to, otp }) => {
  const subject = "Password Reset OTP";
  const text = `Your OTP is: ${otp}\n\nThis OTP expires in 2 minutes.\nIf you did not request this, ignore this email.`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

// ISSUE REPORT
export const sendIssueReport = async ({ name, email, subject, description }) => {
  const mailSubject = `Issue Report: ${subject}`;
  const text = `
Issue Report Received

From: ${name}
Email: ${email}
Subject: ${subject}

Description:
${description}

---
Sent from SmartInven Issue Reporter
  `.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.SUPPORT_EMAIL,
    replyTo: email,
    subject: mailSubject,
    text,
  });
};

// ACCOUNT ACTIVATED
export const sendAccountActivatedEmail = async ({ to, full_name }) => {
  const subject = "Your SmartInven Account is Now Active!";
  const text = `
Hello ${full_name},

Great news! Your payment has been verified and your SmartInven account is now active.

You now have full access to all features for the next 30 days.

Login: ${process.env.APP_URL || 'https://smartinven.com'}

Best regards,
SmartInven Team
  `.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

// SUBSCRIPTION REMINDER
export const sendSubscriptionExpiryReminderEmail = async ({ to, full_name, expires_at }) => {
  const expiryDate = new Date(expires_at).toLocaleDateString();

  const subject = "Your SmartInven Subscription is Expiring Soon";
  const text = `
Hello ${full_name},

Your SmartInven subscription will expire on ${expiryDate}.

Renew before expiry to continue using all features.

Login: ${process.env.APP_URL || 'https://smartinven.com'}

Best regards,
SmartInven Team
  `.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};