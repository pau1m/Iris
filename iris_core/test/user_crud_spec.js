var frisby = require('frisby');
var utils = require('./test_utils');
var config = require('./test_config');

var generateString = utils.generateString;
var formatParams = utils.formatParams;

var adminUser = config.adminUser;

var user = {
        login: {
            username: "",
            password: ""
        },
        auth: {
            token: "",
            userid: "",
            roles: ['authenticated']
        }
    }

testUser = user;
testUser.login.username = generateString(5);
testUser.login.password = generateString(10);

frisby.create('Request auth key')
  .post('http://www.iris.local:4000/api/login',
      adminUser.login,
      { 
        json: true
      }
  )
  .expectStatus(200)
  .expectHeaderContains('content-type', 'application/json')
  .expectJSONTypes({
      userid: String,
      token: String
  })
  .afterJSON(function (res) {
      adminUser.auth.token = res.token;

      frisby.create('Create a user')
          .post('http://www.iris.local:4000/entity/create/user',
            {
                credentials: adminUser.auth,
                username: testUser.login.username,
                password: testUser.login.password,
                roles:  testUser.auth.roles
            },
            { json: true })
          .expectStatus(200)
          .expectHeaderContains('content-type', 'application/json')
          .expectJSONTypes({
              eid: Number,
              roles: Array,
              username: String,
              password: String,
              entityType: String
          })
          .inspectJSON()
          .inspectBody()
          .afterJSON(function (res) {
                testUser.auth.userid = res.eid;
                frisby.create('Update user roles with admin')
                    .post('http://www.iris.local:4000/entity/edit/user/' + testUser.auth.userid,
                    {
                        credentials: adminUser.auth,
                        roles: ['admin']
                    },
                    { json : true })
                    .expectStatus(200)
                    .inspectJSON()
                    .expectHeaderContains('content-type', 'application/json')
                    .toss()        
            })
            .toss()
  })
  .inspectJSON()
  .toss();



