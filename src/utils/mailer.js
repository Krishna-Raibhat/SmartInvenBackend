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
  const subject = "Your Password Reset OTP — SmartInven";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>OTP Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:36px 40px 28px;">
              <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;">SmartInven</div>
              <div style="font-size:13px;color:#a8c7fa;margin-top:4px;letter-spacing:0.5px;">Inventory Management System</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;">Password Reset Request</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
                We received a request to reset your password. Use the OTP below to proceed. This code is valid for <strong>2 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <div style="display:inline-block;background:#f0f5ff;border:2px dashed #1a73e8;border-radius:12px;padding:20px 48px;">
                      <div style="font-size:11px;font-weight:600;color:#1a73e8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Your OTP Code</div>
                      <div style="font-size:42px;font-weight:700;color:#1a1a2e;letter-spacing:12px;">${otp}</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Timer note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fff8e1;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;">
                    <span style="font-size:13px;color:#92400e;">⏱ This OTP expires in <strong>2 minutes</strong>. Do not share it with anyone.</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not request a password reset, you can safely ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 48px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} SmartInven. All rights reserved.<br/>
                This is an automated email — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `Your OTP is: ${otp}\n\nThis OTP expires in 2 minutes.\nIf you did not request this, ignore this email.`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
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