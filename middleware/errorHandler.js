module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
  
    if (process.env.NODE_ENV === 'development') {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        error: err,
        stack: err.stack
      });
    } else {
      // Operational, trusted error: send message to client
      if (err.isOperational) {
        res.status(err.statusCode).json({
          status: err.status,
          message: err.message,
          details: err.details
        });
      } else {
        // Programming or other unknown error
        console.error('ERROR 💥', err);
        res.status(500).json({
          status: 'error',
          message: 'Something went very wrong!'
        });
      }
    }
  };