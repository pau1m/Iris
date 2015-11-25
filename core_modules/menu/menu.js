C.registerModule("menu");

CM.menu.registerHook("hook_menu_view", 0, function (thisHook, menuName) {

  if (CM.auth.globals.checkPermissions(["can view any menu"], thisHook.authPass)) {

    thisHook.finish(true, menuName);

  } else {

    thisHook.finish(false, menuName);

  }

});

CM.menu.registerHook("hook_frontend_template_parse", 0, function (thisHook, data) {

  var variables = data.variables;

  CM.frontend.globals.parseBlock("menu", data.html, function (menu, next) {

    var menuName = menu[0];

    C.hook("hook_menu_view", thisHook.authPass, null, menuName).then(function (canView) {

      C.dbCollections.menu.findOne({
        'title': menuName
      }, function (err, doc) {

        if (!err && doc) {

          CM.frontend.globals.parseTemplateFile(["menu", menuName], null, {menu: doc}, thisHook.authPass).then(function (html) {

            next(html);

          }, function (fail) {

            next("<!-- No menu template -->");

          })

        } else {

          next("<!-- Menu does not exist -->");

        }

      });

    }, function (fail) {

      next("<!-- No permission to view this -->");

    });

  }).then(function (html) {

    data.html = html;

    thisHook.finish(true, data);

  }, function (fail) {

    thisHook.finish(true, data);

  });

});

var waitingMenuItems = [];

CM.menu.globals.registerMenuItem = function (menuName, path, title) {

  waitingMenuItems.push({
    menuName: menuName,
    path: path,
    title: title
  });

};

process.on("dbReady", function () {

  var promises = [];

  waitingMenuItems.forEach(function (element, index) {

    promises.push(C.promise(function (data, yes, no) {

      C.dbCollections.menu.findOne({
        'title': element.menuName
      }, function (err, doc) {

        if (doc) {

          // Item already exists

          if (doc.menulink.some(function (currentValue, index) {

              return currentValue.path === element.path;

            })) {

            // Path already present - don't need to do anything

            waitingMenuItems.splice(index, 1);
            yes(data);
            return false;

          }

          // Update menu to place this link in it

          C.dbCollections.menu.update({
            "title": element.menuName
          }, {
            "$addToSet": {
              "menulink": {
                "title": element.title,
                "path": element.path
              }
            }
          }, {
            "upsert": true
          }, function (err, data) {

          });

          waitingMenuItems.splice(index, 1);
          yes(data);

        } else {

          // Create a new menu

          var entity = new C.dbCollections.menu({
            title: element.menuName,
            entityAuthor: "system",
            entityType: "menu",
            menulink: [{
              title: element.title,
              path: element.path
            }]
          });

          entity.save(function (err, doc) {

            if (err) {
              C.log("error", err)
            }

            waitingMenuItems.splice(index, 1);
            yes(data);

          });

        }

      });

    }));

  });

  C.promiseChain(promises, {}, function () {});

});

// Menu schema

//{
//  "schema": {
//    "properties": {
//      "animal": {
//        "$ref": "#/definitions/menuitem"
//      }
//    },
//    "definitions": {
//      "menuitem": {
//        "type": "object",
//        "properties": {
//          "path": {
//            "title": "Path",
//            "type": "text"
//          },
//          "children": {
//            "title": "Children",
//            "type": "array",
//            "items": {
//              "$ref": "#/definitions/menuitem"
//            },
//            "default": []
//          }
//        }
//      }
//    }
//  }
//}
