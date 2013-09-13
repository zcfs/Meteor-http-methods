/*

GET /note
GET /note/:id
POST /note
PUT /note/:id
DELETE /note/:id

*/
HTTP = Package.http && Package.http.HTTP || {};

var url = Npm.require('url');

// Primary local test scope
_methodHTTP = {};

_methodHTTP.methodHandlers = {};
_methodHTTP.methodTree = {};

_methodHTTP.nameFollowsConventions = function(name) {
  // Check that name is string, not a falsy or empty
  return name && name === '' + name && name !== '';
};


_methodHTTP.getNameList = function(name) {
  // Remove leading and trailing slashes and make command array
  name = name && name.replace(/^\//g, '') || ''; // /^\/|\/$/g
  return name && name.split('/') || [];
};

// Merge two arrays one containing keys and one values
_methodHTTP.createObject = function(keys, values) {
  var result = {};
  if (keys && values) {
    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = values[i] || '';
    }
  }
  return result;
};

_methodHTTP.addToMethodTree = function(methodName) {
  var list = _methodHTTP.getNameList(methodName);
  var name = '/';
  // Contains the list of params names
  var params = [];
  var currentMethodTree = _methodHTTP.methodTree;

  for (var i = 0; i < list.length; i++) {
    var lastListItem = (i === list.length - 1);

    // get the key name
    var key = list[i];
    // Check if it expects a value
    if (key[0] === ':') {
      // This is a value
      params.push(key.slice(1));
      key = ':value';
    }
    name += key + '/';

    // Set the key into the method tree
    if (typeof currentMethodTree[key] === 'undefined') {
      currentMethodTree[key] = {};
    }

    // Dig deeper
    currentMethodTree = currentMethodTree[key];

  }

  if (_.isEmpty(currentMethodTree[':ref'])) {
    currentMethodTree[':ref'] = {
      name: name,
      params: params
    };
  }

  return currentMethodTree[':ref'];
};

// This method should be optimized for speed since its called on allmost every
// http call to the server so we return null as soon as we know its not a method
_methodHTTP.getMethod = function(name) {
  // Check if the
  if (!_methodHTTP.nameFollowsConventions(name)) {
    return null;
  }
  var list = _methodHTTP.getNameList(name);
  // Check if we got a correct list
  if (!list || !list.length) {
    return null;
  }
  // Set current refernce in the _methodHTTP.methodTree
  var currentMethodTree = _methodHTTP.methodTree;
  // Buffer for values to hand on later
  var values = [];
  // Iterate over the method name and check if its found in the method tree
  for (var i = 0; i < list.length; i++) {
    // get the key name
    var key = list[i];
    // We expect to find the key or :value if not we break 
    if (typeof currentMethodTree[key] !== 'undefined' ||
            typeof currentMethodTree[':value'] !== 'undefined') {
      // We got a result now check if its a value
      if (typeof currentMethodTree[key] === 'undefined') {
        // Push the value
        values.push(key);
        // Set the key to :value to dig deeper
        key = ':value';
      }

    } else {
      // Break - method call not found
      return null;
    }

    // Dig deeper
    currentMethodTree = currentMethodTree[key];
  } 

  // Extract reference pointer
  var reference = currentMethodTree && currentMethodTree[':ref'];
  if (typeof reference !== 'undefined') {
    return {
      name: reference.name,
      params: _methodHTTP.createObject(reference.params, values)
    };
  } else {
    // Did not get any reference to the method
    return null;
  }
};

// Public interface for adding server-side http methods - if setting a method to
// 'false' it would actually remove the method (can be used to unpublish a method)
HTTP.methods = function(newMethods) {
  _.each(newMethods, function(func, name) {
    if (_methodHTTP.nameFollowsConventions(name)) {
      // Check if we got a function
      if (typeof func === 'function') {
        var method = _methodHTTP.addToMethodTree(name);
        // The func is good
        if (typeof _methodHTTP.methodHandlers[method.name] !== 'undefined') {
          if (_methodHTTP.methodHandlers[method.name] === false) {
            // If the method is set to false then unpublish
            delete _methodHTTP.methodHandlers[method.name];
            // Delete the reference in the _methodHTTP.methodTree
            delete method.name;
            delete method.params;
          } else {
            // We should not allow overwriting - following Meteor.methods
            throw new Error('HTTP method "' + name + '" is allready registred');
          }
        } else {
          // Registre the method
          _methodHTTP.methodHandlers[method.name] = func;
        }
      } else {
        // We do require a function as a function to execute later
        throw new Error('HTTP.methods failed: ' + name + ' is not a function');
      }
    } else {
      // We have to follow the naming spec defined in nameFollowsConventions
      throw new Error('HTTP.method "' + name + '" invalid naming of method');
    }
  });
};

var sendError = function(res, code, message) {
  res.writeHead(code);
  res.end(message);
};

// This handler collects the header data into either an object (if json) or the
// raw data. The data is passed to the callback
var requestHandler = function(req, res, callback) {
  if (typeof callback !== 'function') {
    return null;
  }

  var body = '';

  // Extract the body
  req.on('data', function(data) {
    body += data;
    if (body.length > 1e6) {
      body = '';
      // Flood attack or faulty client
      sendError(res, 413, 'Flood attack or faulty client');
      req.connection.destroy();
    }
  });

  // When message is ready to be passed on
  req.on('end', function() {
    if (res.finished) {
      return;
    }
    // Convert the body into json and extract the data object
    var result = {};
    try {
      if (body !== '') {
        result = EJSON.parse(body);
      }
    } catch(err) {
      // Could not parse so we return the raw data
      result = body;
    }

    try {
      callback(result);
    } catch(err) {
      sendError(res, 500, 'Error in requestHandler callback, Error: ' + (err.stack || err.message) );
    }
  });

};

// Handle the actual connection
WebApp.connectHandlers.use(function(req, res, next) {

  // Check to se if this is a http method call
  var method = _methodHTTP.getMethod(req._parsedUrl.pathname);

  // If method is null then it wasn't and we pass the request along
  if (method === null) {
    return next();
  }

  requestHandler(req, res, function(data) {
    var methodReference = method.name;

    // If methodsHandler not found or somehow the methodshandler is not a
    // function then return a 404
    if (!_methodHTTP.methodHandlers[methodReference] || typeof _methodHTTP.methodHandlers[methodReference] !== 'function') {
      sendError(res, 404, 'Error HTTP method handler "' + methodReference + '" is not a function');
      return;
    }

    // Set fiber scope
    var fiberScope = {
      // Pointers to Request / Response
      req: req,
      res: res,
      // Request / Response helpers
      statusCode: 200,
      contentType: 'text/html',
      method: req.method,
      // Arguments
      data: data,
      query: req.query,
      params: method.params,
      // Method reference
      reference: methodReference,
      callback: _methodHTTP.methodHandlers[methodReference]
    };

    // Helper functions this scope
    Fiber = Npm.require('fibers');
    runServerMethod = Fiber(function(self) {
      // We fetch methods data from methodsHandler, the handler uses the this.addItem()
      // function to populate the methods, this way we have better check control and
      // better error handling + messages

      // The scope for the user callback
      var thisScope = {
        // The user whos id and token was used to run this method, if set/found
        userId: null,
        // The id of the data
        _id: null,
        // Set the query params ?token=1&id=2 -> { token: 1, id: 2 }
        query: self.query,
        // Set params /foo/:name/test/:id -> { name: '', id: '' }
        params: self.params,
        // Method GET, PUT, POST, DELETE
        method: self.method,
        // Set the userId
        setUserId: function(id) {
          this.userId = id;
        },
        // We dont simulate / run this on the client at the moment
        isSimulation: false,
        // Run the next method in a new fiber - This is default at the moment
        unblock: function() {},
        // Set the content type in header, defaults to text/html?
        setContentType: function(type) {
          self.contentType = type;
        },
        setStatusCode: function(code) {
          self.statusCode = code;
        }
      };

      // Check authentication
      var userToken = self.query.token;
      var userId = self.query.id;

      // Check if we are handed strings
      try {
        userToken && check(userToken, String);
        userId && check(userId, String);
      } catch(err) {
        sendError(res, 404, 'Error user token and id not of type strings, Error: ' + (err.stack || err.message));
        return;
      }

      // Set the this.userId
      if (userId && userToken) {
        // Look up user to check if user exists and is loggedin via token
        var user = Meteor.users.findOne({ _id: userId, 'services.resume.loginTokens.token': userToken });

        // Set the userId in the scope
        thisScope.userId = user && user._id;
      }

      var result;
      // Get a result back to send to the client
      try {
        result = self.callback.apply(thisScope, [self.data]) || '';
      } catch(err) {
        sendError(res, 503, 'Error in method "' + self.reference + '", Error: ' + (err.stack || err.message) );
        return;
      }

      // If OK / 200 then Return the result
      if (self.statusCode === 200) {
        var resultBuffer = new Buffer(result);

        self.res.setHeader('Content-Type', self.contentType);
        self.res.setHeader('Content-Length', resultBuffer.length);
        self.res.end(resultBuffer);
      } else {
        // Allow user to alter the status code and send a message
        sendError(res, self.statusCode, result);
      }


    });
    // Run http methods handler
    try {
      runServerMethod.run(fiberScope);
    } catch(err) {
      sendError(res, 500, 'Error running the server http method handler, Error: ' + (err.stack || err.message));
    }

  }); // EO Request handler


});