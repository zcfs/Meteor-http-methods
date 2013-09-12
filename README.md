HTTP.methods
============

This package add the abillity to add `HTTP` server methods to your project. It's a server-side package only *- no client simulations added.*

##Usage
HTTP.methods can be added
```js
  HTTP.methods({
    'list': function() {
      return '<b>Default content type is text/html</b>';
    }
  });
```

##Methods scope
The methods scope contains different kinds of inputs. We can also get user details if logged in.


* `this.userId` The user whos id and token was used to run this method, if set/found
* `this.method` - `GET`, `POST`, `PUT`, `DELETE`
* `this.query` - query params `?token=1&id=2` -> { token: 1, id: 2 }
* `this.params` - Set params /foo/:name/test/:id -> { name: '', id: '' }
* `this.setUserId(id)` - Option for setting the `this.userId`
* `this.isSimulation` - Allways false on the server
* `this.unblock` - Not implemented
* `this.setContentType('text/html')` - Set the content type in header, defaults to text/html
* `this.setStatusCode(200)` - Set the status code in response header

##Passing data via header
From the client:
```js
  HTTP.call('POST', '/list/', {
    data: { foo: 'bar' }
  }, function(err, result) {
    console.log('Content: ' + result.content + ' === "Hello"');
  });
```

HTTP Server method:
```js
  HTTP.methods({
    'list': function(data) {
      if (data.foo === 'bar') {
        /* data i passed via the header is parsed by EJSON.parse if
        not able then it returns the raw data instead */
      }
      return 'Hello';
    }
  });
```

##Authentication
The client needs the user `_id` and `access_token` to login in HTTP methods. *One could create a HTTP login/logout method for allowing pure external access*

Client
```js
  HTTP.call('POST', '/hello/', {
    params: {
      id: Meteor.userId(),
      token: Accounts && Accounts._storedLoginToken()
    }
  }, function(err, result) {
    console.log('Got back: ' + result.content);
  });
```

Server
```js
  '/hello/': function(data) {
    if (this.userId) {
      var user = Meteor.users.findOne({ _id: this.userId });
      return 'Hello ' + (user && user.username || user && user.emails[0].address || 'user');
    } else {
      this.setStatusCode(401); // Unauthorized
    }
  }
```

##Parametres
The method name or url can be used to pass `params` values to the method.

Client
```js
  HTTP.call('POST', '/items/12/emails/5', function(err, result) {
    console.log('Got back: ' + result.content);
  });
```

```js
  HTTP.methods({
    '/items/:itemId/emails/:emailId': function() {
      // this.param.itemId === '12'
      // this.param.emailId === '5'
    }
  });
```
