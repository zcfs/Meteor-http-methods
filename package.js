Package.describe({
    summary: '\u001b[32mv0.0.1\n'+
         '\u001b[33m-----------------------------------------\n'+
         '\u001b[0m Adds HTTP.methods                        \n'+
         '\u001b[0m                                          \n'+
         '\u001b[33m-------------------------------------RaiX\n'
});

Package.on_use(function(api) {
  'use strict';
  api.use(['webapp', 'underscore', 'http', 'ejson'], 'server');

  api.imply && api.imply('http');

  api.export && api.export('_methodHTTP', { testOnly: true });

  api.add_files([
    'http.methods.server.api.js'], 'server');

});

Package.on_test(function (api) {
  api.use('http-methods', ['server']);
  api.use('test-helpers', 'server');
  api.use(['tinytest', 'underscore', 'ejson', 'ordered-dict',
           'random', 'deps']);

  api.add_files('http.methods.tests.js', 'server');
});