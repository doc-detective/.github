// Scope management exports
module.exports = {
  // Registry
  ...require('./registry'),
  
  // Terminal scopes
  ...require('./terminal'),
  
  // Code scopes - PLACEHOLDER: These functions throw "not implemented" errors.
  // They are exported for API completeness and future implementation.
  // See code.js for details.
  ...require('./code'),
  
  // WaitUntil utilities
  ...require('./waitUntil'),
  
  // Cleanup
  ...require('./cleanup')
};
