// Scope management exports
module.exports = {
  // Registry
  ...require('./registry'),
  
  // Terminal scopes
  ...require('./terminal'),
  
  // Code scopes (future)
  ...require('./code'),
  
  // WaitUntil utilities
  ...require('./waitUntil'),
  
  // Cleanup
  ...require('./cleanup')
};
