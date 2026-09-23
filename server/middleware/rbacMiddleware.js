const authenticate = require('./authenticate');
const authorize = require('./authorize');

module.exports = {
  authenticateToken: authenticate,
  requirePermission: authorize
};
