function formatValidationPath(path) {
  const text = path.map((part) => String(part)).filter(Boolean).join(".");
  return text || "body";
}

function formatValidationMessage(issues) {
  const details = issues.map((issue) => `${formatValidationPath(issue.path)}: ${issue.message}`);
  return `Invalid request body: ${details.join("; ")}`;
}

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: formatValidationMessage(parsed.error.issues),
        details: parsed.error.issues.map((issue) => ({
          path: formatValidationPath(issue.path),
          message: issue.message
        }))
      });
    }
    req.body = parsed.data;
    next();
  };
}

module.exports = { validate };
