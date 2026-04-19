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
