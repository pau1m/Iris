/**
 * @file User management module
 */

/**
 * @namespace user
 */

iris.registerModule("user");

var bcrypt = require("bcrypt-nodejs");

// First ever login form

// Set up first user account via API

iris.route.post("/api/user/first", function (req, res) {

  if (!req.body.password || !req.body.username) {

    res.status(400).json("Need to supply a username and a password");

    return false;

  }

  iris.dbCollections["user"].count({}, function (err, count) {

      if (count === 0) {

        iris.invokeHook("hook_form_submit__set_first_user", "root", {
          params: {
            password: req.body.password,
            username: req.body.username
          }
        }, null).then(function (success) {

          res.status(200).json("First user created");

        }, function (fail) {

          res.status(400).json(fail);

        })

      } else {

        res.status(403).json("Admin user already set up");

      }

  });

})

iris.modules.user.registerHook("hook_form_render__set_first_user", 0, function (thisHook, data) {

  iris.dbCollections["user"].count({}, function (err, count) {

    if (count === 0) {

      data.schema.profile = {
        "type": "string",
        "title": "Installation profile",
        "enum": ["minimal", "standard"]
      }

      data.schema.username = {
        "type": "text",
        "title": "Administrator email address"
      }

      data.schema.password = {
        "type": "password",
        "title": "Password",
        "description": "Make it strong"
      };

      data.form = [
        {
          "key": "profile",
          "description": "The Minimal profile will exclude all optional UI modules and features. In a Minimal setup, " +
            "Iris can be used as a lightweight webservice.<br/>Use Standard profile to build a user-facing CMS type system.<br/>" +
            "If choosing Standard, please wait after clicking 'Install' for the server to restart. The blank page is expected.",
          "titleMap": {
            "minimal": "Minimal",
            "standard": "Standard"
          }
        },
        {
          "key": "username",
          "type": "email",
          "description": "Use this to login with in future"
        },
        "password",
        {
          "type": "submit",
          "title": "Install"
        }
      ];

      thisHook.pass(data);

    } else {

      thisHook.fail(data);

    }
  });

})

iris.modules.user.registerHook("hook_form_submit__set_first_user", 0, function (thisHook, data) {

  iris.dbCollections["user"].count({}, function (err, count) {
    if (count === 0) {

      var newUser = {

        entityType: "user",
        entityAuthor: "system",
        password: thisHook.context.params.password,
        username: thisHook.context.params.username,
        roles: ["admin"]
      }

      iris.invokeHook("hook_entity_create", "root", newUser, newUser).then(function (user) {

        var auth = {
          password: thisHook.context.params.password,
          username: thisHook.context.params.username
        }

        iris.modules.user.globals.login(auth, thisHook.context.res, function (uid) {

          if (thisHook.context.params.profile == 'standard') {

            var enabled = [
              {
                name: 'blocks'
              },
              {
                name: 'roles_ui'
              },
              {
                name: 'configUI'
              },
              {
                name: 'custom_blocks'
              },
              {
                name: 'entityUI'
              },
              {
                name: 'ckeditor'
              },
              {
                name: 'permissionsUI'
              },
              {
                name: 'page'
              },
              {
                name: 'menu_block'
              },
              {
                name: 'regions'
              },
              {
                name: 'lists'
              }
            ];
            var fs = require("fs");
            fs.writeFileSync(iris.sitePath + "/enabled_modules.json", JSON.stringify(enabled));

          }
          iris.message(uid, "Welcome to your new Iris site!", "info");
          thisHook.pass(function (res) {
            res.json("/admin");
            if (enabled) {
              console.log('restarting');
              iris.message(uid, "Don't worry, that short glitch was the server restarting to install the Standard profile.", "info");
              iris.restart(uid, "UI modules enabled.");
            }
          });
        });

      }, function (fail) {

        iris.log(fail);
        thisHook.fail(data);

      });

    } else {

      thisHook.fail(data);

    }

  });

});

// First ever login page (should only show if no user has been set up)

iris.app.get("/", function (req, res, next) {

  iris.dbCollections["user"].count({}, function (err, count) {
    if (count === 0) {

      iris.modules.frontend.globals.parseTemplateFile(["first_user"], null, {}, req.authPass, req).then(function (success) {

        res.send(success)

      }, function (fail) {

        iris.modules.frontend.globals.displayErrorPage(500, req, res);

        iris.log("error", e);

      });

    } else {

      next();

    }
  })
})

/**
 * @function login
 * @memberof user
 *
 * @desc Login a user given a login object (containing username and password)
 *
 * @param {object} auth - Auth object consisting of key-value pairs username and password
 * @param {object} res - Express response object
 * @param {function} callback - Callback which is run with the userid of the logged in user (if successful) as its first argument, or, if unsuccessful, an error message
 */
iris.modules.user.globals.login = function (auth, res, callback) {

  iris.dbCollections['user'].findOne({
    "username": auth.username
  }, function (err, doc) {

    if (doc) {

      var userid = doc.eid.toString();

      bcrypt.compare(auth.password, doc.password, function (err, match) {

        if (!err && match === true) {

          iris.invokeHook("hook_auth_maketoken", "root", null, {
            userid: userid
          }).then(function (token) {

            if (res) {

              iris.modules.sessions.globals.writeCookies(userid, token.id, res, 8.64e7, {});

              callback(userid);

            } else {

              callback(userid, token.id);

            }

          }, function (fail) {

            iris.log("error", fail);

          });

        } else {

          callback(false);

        }

      });

    } else {

      callback(false);

    }

  });

};

iris.app.get("/user/logout", function (req, res) {

  // Delete session

  delete iris.modules.auth.globals.userList[req.authPass.userid];

  res.clearCookie('userid');
  res.clearCookie('token');

  res.clearCookie('admin_auth');

  res.redirect("/");

});

iris.modules.user.registerHook("hook_entity_presave", 1, function (thisHook, entity) {

  if (entity.password && entity.password.length) {

    bcrypt.hash(entity.password, null, null, function (err, hash) {

      if (err) {

        thisHook.fail("Could not hash password");

      } else {

        entity.password = hash;
        thisHook.pass(entity);

      }

    });

  } else {

    // If password is blank or not set, don't bother hashing it

    // When editing a user, this results in a blank password
    // meaning "keep the same password"

    delete entity.password;

    thisHook.pass(entity);

  }

  // Change roles in cache

  iris.modules.user.globals.userRoles[entity.eid] = entity.roles;

});

iris.modules.user.globals.userRoles = {};

/**
 * @function getRole
 * @memberof user
 *
 * @desc Fetch the roles that a user has given their userid.
 *
 * @param {string} userid - The userid
 * @param {function} callback - The callback which is run with the user's roles as its first argument
 */
iris.modules.user.globals.getRole = function (userid, callback) {

  if (iris.modules.user.globals.userRoles[userid]) {

    callback(iris.modules.user.globals.userRoles[userid]);

  } else {

    iris.dbCollections['user'].findOne({
      eid: parseInt(userid)
    }, function (err, doc) {

      if (!err && doc && doc.roles) {

        iris.modules.user.globals.userRoles[userid] = doc.roles;

        callback(doc.roles);

      } else {

        callback([]);

      }

    });

  }

};

iris.modules.user.registerHook("hook_auth_authpass", 5, function (thisHook, data) {

  if (data.roles && data.roles.indexOf('authenticated') !== -1) {

    iris.modules.user.globals.getRole(thisHook.authPass.userid, function (roles) {

      data.roles = data.roles.concat(roles);

      thisHook.pass(data);

    });

  } else {

    thisHook.pass(data);

  }

});

iris.modules.user.registerHook("hook_entity_updated", 1, function (thisHook, entity) {

  if (entity.entityType === 'user' && entity.userid) {

    if (iris.modules.user.globals.userRoles[entity.userid]) {

      delete iris.modules.user.globals.userRoles[entity.userid];

    }

  }

  thisHook.pass(entity);

});

require('./login_form.js');

// Login form

iris.route.get("/user/login", {
  "title": "Login"
}, function (req, res) {

  // If not admin, present 403 page

  if (req.authPass.roles.indexOf('authenticated') !== -1) {

    res.send("Already logged in");

    return false;

  }

  iris.modules.frontend.globals.parseTemplateFile(["login"], ['html'], {}, req.authPass, req).then(function (success) {

    res.send(success)

  }, function (fail) {

    iris.modules.frontend.globals.displayErrorPage(500, req, res);

    iris.log("error", fail);

  });

});

iris.app.get("/user", function (req, res) {

  if (req.authPass.roles.indexOf('authenticated') == -1) {
    // Anonymous. Redirect to login page.
    res.redirect('/user/login');
  } else {
    // Redirect to own user page.
    res.redirect('/user/' + req.authPass.userid);
  }
});

// Blank password field on entity edit

// Prepopulate roles

iris.modules.user.registerHook("hook_form_render__editEntity", 1, function (thisHook, data) {

  if (thisHook.context.params[1] === "user" && data.schema && data.schema.password) {

    data.schema.password.default = null;
    data.schema.password.required = false;
    data.schema.password.title = "Change password";
    data.schema.password.description = "Change your password by typing a new one into the form below";

    var roles = ["none", "admin"];
    Object.keys(iris.modules.auth.globals.roles).forEach(function (role) {

      if (role !== "anonymous" && role !== "authenticated") {
        roles.push(role)
      }

    })

    data.schema.roles.items = {
      type: "string",
      enum: roles
    };

  }

  thisHook.pass(data);

});

iris.modules.user.registerHook("hook_form_render__createEntity", 1, function (thisHook, data) {

  if (thisHook.context.params[1] === "user") {

    var roles = ["none", "admin"];
    Object.keys(iris.modules.auth.globals.roles).forEach(function (role) {

      if (role !== "anonymous" && role !== "authenticated") {
        roles.push(role)
      }

    })

    data.schema.roles.items = {
      type: "string",
      enum: roles
    };

  }

  thisHook.pass(data);

});

// When creating user, change the author to the entity ID

iris.modules.user.registerHook("hook_entity_created_user", 0, function (thisHook, data) {

  var conditions = {
    eid: data.eid
  };

  var update = {
    entityAuthor: data.eid
  };

  iris.dbCollections["user"].update(conditions, update, function (err, doc) {

    thisHook.pass(doc);

  });

});

// Check if websocket connection has authentication cookies

iris.modules.user.registerHook("hook_socket_connect", 0, function (thisHook, data) {

  function parse_cookies(_cookies) {
    var cookies = {};

    _cookies && _cookies.split(';').forEach(function (cookie) {
      var parts = cookie.split('=');
      cookies[parts[0].trim()] = (parts[1] || '').trim();
    });

    return cookies;
  }


  var cookies = parse_cookies(thisHook.context.socket.handshake.headers.cookie);

  if (cookies && cookies.userid && cookies.token) {

    // Check access token and userid are valid

    if (iris.modules.auth.globals.checkAccessToken(cookies.userid, cookies.token)) {

      iris.socketLogin(cookies.userid, cookies.token, thisHook.context.socket);

    } else {
      thisHook.pass(data);
    }

  } else {

    thisHook.pass(data)
  }

});

// Username + password to token

iris.app.post("/api/login", function (req, res) {

  if (req.body.username && req.body.password) {

    iris.modules.user.globals.login(req.body, null, function (userid, token) {

      if (!userid) {

        res.status(403).send("Not valid credentials");

      } else {

        res.send({
          userid: userid,
          token: token
        });

      }

    })

  } else {

    res.status(400).send("Must send username and password");

  }

});

iris.route.get("/admin/users", {
  "menu": [{
    menuName: "admin_toolbar",
    parent: null,
    title: "Users"
  }]
}, function (req, res) {

  var menu = iris.modules.menu.globals.getBaseLinks(req.url);

  iris.modules.frontend.globals.parseTemplateFile(["baselinks"], ['admin_wrapper'], {
    menu: menu,
  }, req.authPass, req).then(function (success) {

    res.send(success);

  })

})

iris.route.get("/admin/users/list", {
  "menu": [{
    menuName: "admin_toolbar",
    parent: "/admin/users",
    title: "User list"
  }]
}, function (req, res) {

  if (iris.modules.entityUI) {

    res.redirect("/admin/entitylist/user");

  } else {
    iris.modules.frontend.globals.displayErrorPage(404, req, res);
  }

});
