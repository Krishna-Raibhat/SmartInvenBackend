const mailer = require("../utils/mailer");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.reportIssue = async (req, res) => {
  try {
    const { name, email, subject, description } = req.body;

    if (!name || !email || !subject || !description) {
      return fail(res, 400, "VALIDATION_ERROR", "All fields are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid email format");
    }

    if (!process.env.SUPPORT_EMAIL) {
      return fail(res, 500, "CONFIG_ERROR", "Support email not configured");
    }

    await mailer.sendIssueReport({ name, email, subject, description });

    return res.json({
      success: true,
      message: "Issue report sent successfully",
    });
  } catch (e) {
    console.error("Issue report error:", e);
    return fail(res, 500, "SERVER_ERROR", "Failed to send issue report");
  }
};
