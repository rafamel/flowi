'use strict';
const Flow = require('./flow');
const KeyFlow = require('./keyflow');
const ValidationError = require('./validation-error');

const proxyHandler = {
    apply(target, thisArg, args) {
      return new target(...args);
    }
};

module.exports = {
    Flow: new Proxy(Flow, proxyHandler),
    KeyFlow: new Proxy(KeyFlow, proxyHandler),
    ValidationError: ValidationError
};

