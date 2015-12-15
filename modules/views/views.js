C.registerModule("views");

var fs = require("fs");

process.on("dbReady", function () {

  // Create a view block type for each entity

  Object.keys(C.dbCollections).forEach(function (entityType) {

    var fields = [];

    Object.keys(C.dbCollections[entityType].schema.tree).forEach(function (fieldName) {

      // Only push in string and number fields

      var field = C.dbCollections[entityType].schema.tree[fieldName];

      if (field.type === String || field.type === Number) {

        fields.push(fieldName);

      }

    });

    CM.blocks.globals.registerBlockType('View-of-' + entityType);

    CM.views.registerHook("hook_form_render_blockForm_View-of-" + entityType, 0, function (thisHook, data) {

      if (thisHook.const.params[1] && CM.blocks.globals.blocks["View-of-" + entityType] && CM.blocks.globals.blocks["View-of-" + entityType][thisHook.const.params[1]]) {

        var existingView = CM.blocks.globals.blocks["View-of-" + entityType][thisHook.const.params[1]];

        data.value = existingView;

      }

      // Add in fields

      var form = {
        "limit": {
          "type": "number",
          "title": "Limit",
          "default": 0
        },
        "conditions": {
          "type": "array",
          "items": {
            "type": "object",
            "title": "Conditions",
            "properties": {
              "field": {
                "type": "string",
                "title": "Field to check",
                "enum": fields
              },
              "comparison": {
                "type": "string",
                "title": "Operator",
                "enum": ["IS", "IN", "CONTAINS"]
              },
              "compare": {
                "type": "string",
                "title": "Value to check for",
                "description": "This value can be altered dynamically later on"
              },
            }
          }
        },
        "fields": {
          "type": "array",
          "items": {
            "type": "object",
            "title": "Field",
            "properties": {
              "field": {
                "type": "string",
                "title": "Entity field",
                "enum": fields
              },
              "wrapper": {
                "type": "string",
                "title": "HTML wrapper element",
                "enum": ["div", "span", "h1", "h2", "h3"]
              },
              "allowhtml": {
                "type": "boolean",
                "title": "Allow HTML?"
              },
              "class": {
                "type": "string",
                "title": "Classes",
                "description": "Space-separated"
              }
            }
          }
        }
      }

      Object.keys(form).forEach(function (formField) {

        data.schema[formField] = form[formField];

      })

      thisHook.finish(true, data);

    })

  });

})

// Render blocks

CM.views.registerHook("hook_block_render", 0, function (thisHook, data) {

  if (thisHook.const.type.split("-")[0] === "View") {

    var config = thisHook.const.config;

    var fetch = {
      entities: [thisHook.const.type.replace("View-of-", "")],
      queries: config.conditions,
      limit: config.limit
    }
    
    C.hook("hook_entity_fetch", thisHook.authPass, null, {
      queryList: [fetch]
    }).then(function (result) {

        var output = [];

        if (!result || !result.length) {

          thisHook.finish(true, "<!-- No results for " + thisHook.const.type + " " + thisHook.const.id + "-->");
          return false;

        }

        result.forEach(function (fetched) {

          // Loop over all fields and add variable

          var viewOutput = {};

          config.fields.forEach(function (field, index) {

            viewOutput[field.field] = {};

            // Add all settings provided in the view

            Object.keys(config.fields[index]).forEach(function (fieldSetting) {

              viewOutput[field.field][fieldSetting] = config.fields[index][fieldSetting];

            })

            if (fetched[field.field]) {

              viewOutput[field.field].value = fetched[field.field];

            }

          })

          output.push(viewOutput);

        });

        CM.frontend.globals.parseTemplateFile(["views", thisHook.const.type], null, {
          view: output
        }, thisHook.authPass).then(function (success) {

          thisHook.finish(true, success);

        }, function (fail) {

          thisHook.finish(true, fail);

        })

      },
      function (fail) {

        thisHook.finish(true, fail);

      });

  } else {

    thisHook.finish(true, data);

  }

});
