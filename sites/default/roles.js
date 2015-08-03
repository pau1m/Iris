var roles = {
  // anonymous user: anyone accessing the API
  'anonymous': {
    permissions: []
  },
  // authenticated user: anyone who has successfuly authenticated
  // with a userid/token pair
  'authenticated': {
    permissions: []
  },
  // admin user: anyone authenticated with userid defined as admin
  // OR anyone authenticating with secretkey and apikey
  'admin': {
    permissions: []
  }
};

module.exports = roles;
