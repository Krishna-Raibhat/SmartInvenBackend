export default (req, res, next) => {
  if (!req.superAdmin) {
    return res.status(403).json({
      success: false,
      error_code: "FORBIDDEN",
      message: "Super admin access required.",
    });
  }
  next();
};