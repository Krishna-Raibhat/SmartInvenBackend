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

// NEW DEVICE OTP EMAIL
export const sendNewDeviceOtpEmail = async ({ to, otp, device_name }) => {
  const subject = "New Device Verification — SmartInven";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Device Verification</title>
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
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;">New Device Detected</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
                A login attempt was made on an unverified device: <strong>${device_name || "Unknown Device"}</strong>. Please use the OTP below to trust this device and complete login. This code is valid for <strong>10 minutes</strong>.
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
                    <span style="font-size:13px;color:#92400e;">⏱ This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not request this login, we recommend changing your password immediately to secure your account.
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

  const text = `A login attempt was made on an unverified device (${device_name || "Unknown"}). Use the OTP below to trust this device: ${otp}\n\nThis OTP expires in 10 minutes.\nIf you did not make this request, we recommend securing your account immediately.`;

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

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Account Activated</title>
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

          <!-- Success Icon -->
          <tr>
            <td align="center" style="padding:36px 48px 0;">
              <div style="width:72px;height:72px;background:#e8f5e9;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:4px;">
                <div style="font-size:36px;line-height:72px;">✅</div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 48px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;text-align:center;">Payment Verified!</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.7;text-align:center;">
                Hello <strong>${full_name}</strong>, your payment has been successfully verified.<br/>
                Your SmartInven account is now fully active.
              </p>

              <!-- Info Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f5ff;border-radius:10px;padding:16px 20px;">
                      <tr><td style="font-size:12px;color:#1a73e8;font-weight:600;padding-bottom:4px;">📦 &nbsp;Subscription Duration</td></tr>
                      <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;">1 Year (365 Days)</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:16px 20px;">
                      <tr><td style="font-size:12px;color:#16a34a;font-weight:600;padding-bottom:4px;">✔ &nbsp;Account Status</td></tr>
                      <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;">Active</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-radius:10px;padding:16px 20px;">
                      <tr><td style="font-size:12px;color:#d97706;font-weight:600;padding-bottom:4px;">🔓 &nbsp;Access</td></tr>
                      <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;">Full Features Unlocked</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;text-align:center;">
                Thank you for choosing SmartInven. You can now log in and start managing your inventory.
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

  const text = `Hello ${full_name},\n\nYour payment has been verified and your SmartInven account is now active for 1 year (365 days).\n\nBest regards,\nSmartInven Team`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
};

// SUBSCRIPTION REMINDER
export const sendSubscriptionExpiryReminderEmail = async ({ to, full_name, expires_at }) => {
  const expiryDate = new Date(expires_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const daysLeft = Math.ceil((new Date(expires_at) - new Date()) / (1000 * 60 * 60 * 24));

  const subject = "Your SmartInven Subscription is Expiring Soon";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Subscription Expiring</title>
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

          <!-- Warning Icon -->
          <tr>
            <td align="center" style="padding:36px 48px 0;">
              <div style="width:72px;height:72px;background:#fff8e1;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">
                <div style="font-size:36px;line-height:72px;">⏰</div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 48px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;text-align:center;">Subscription Expiring Soon</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.7;text-align:center;">
                Hello <strong>${full_name}</strong>, your SmartInven subscription is expiring soon.<br/>
                Renew now to avoid any interruption to your inventory management.
              </p>

              <!-- Info Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-radius:10px;padding:16px 20px;">
                      <tr><td style="font-size:12px;color:#d97706;font-weight:600;padding-bottom:4px;">📅 &nbsp;Expiry Date</td></tr>
                      <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;">${expiryDate}</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:10px;padding:16px 20px;">
                      <tr><td style="font-size:12px;color:#dc2626;font-weight:600;padding-bottom:4px;">⚠️ &nbsp;Days Remaining</td></tr>
                      <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;">${daysLeft} day${daysLeft !== 1 ? "s" : ""}</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f5ff;border-radius:10px;padding:16px 20px;">
                      <tr><td style="font-size:12px;color:#1a73e8;font-weight:600;padding-bottom:4px;">💡 &nbsp;Action Required</td></tr>
                      <tr><td style="font-size:15px;color:#1a1a2e;font-weight:700;">Renew Subscription</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;text-align:center;">
                To renew, make a payment and upload your payment proof through the app.<br/>
                Our team will verify and activate your subscription promptly.
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

  const text = `Hello ${full_name},\n\nYour SmartInven subscription expires on ${expiryDate} (${daysLeft} days remaining).\n\nPlease renew by uploading your payment proof through the app.\n\nBest regards,\nSmartInven Team`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
};


// REGISTRATION OTP EMAIL
export const sendRegistrationOtpEmail = async ({ to, otp }) => {
  const subject = "Verify Your Email — SmartInven Registration";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Email Verification</title>
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
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;">Email Verification</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
                Thank you for registering with SmartInven! Please use the OTP below to verify your email address. This code is valid for <strong>3 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <div style="display:inline-block;background:#f0f5ff;border:2px dashed #1a73e8;border-radius:12px;padding:20px 48px;">
                      <div style="font-size:11px;font-weight:600;color:#1a73e8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Your Verification Code</div>
                      <div style="font-size:42px;font-weight:700;color:#1a1a2e;letter-spacing:12px;">${otp}</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Timer note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#fff8e1;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;">
                    <span style="font-size:13px;color:#92400e;">⏱ This OTP expires in <strong>3 minutes</strong>. Do not share it with anyone.</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not register for a SmartInven account, you can safely ignore this email.
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

  const text = `Your email verification OTP is: ${otp}\n\nThis OTP expires in 5 minutes.\nIf you did not register for a SmartInven account, ignore this email.`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
};
