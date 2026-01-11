const { validationResult } = require('express-validator');

const validate = (req, res, next) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation errors:", errors.array()); // Debug: see which fields failed

    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value, // include the invalid value for clarity
      }))
    });
  }
  next();
};

module.exports = validate;
