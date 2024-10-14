module.exports = {
    expired_token: 'expired token, cant get new auth? Check access oauth server.',
    invalid_token: 'invalid token, need reinstall application',
    invalid_grant: 'invalid grant, check out define C_REST_CLIENT_SECRET or C_REST_CLIENT_ID',
    invalid_client: 'invalid client, check out define C_REST_CLIENT_SECRET or C_REST_CLIENT_ID',
    QUERY_LIMIT_EXCEEDED: 'Too many requests, maximum 2 query by second',
    ERROR_METHOD_NOT_FOUND: "Method not found! You can see the permissions of the application: CRest::call('scope')",
    NO_AUTH_FOUND: 'Some setup error b24, check in table "b_module_to_module" event "OnRestCheckAuth"',
    INTERNAL_SERVER_ERROR: 'Server down, try later',
    CONNECTION_ERROR: 'Error connecting to authorization server',
  };
  