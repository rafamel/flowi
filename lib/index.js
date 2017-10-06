'use strict';
const Flow = require('./flow');
const KeyFlow = require('./keyflow');
const ValidationError = require('./validation-error');

const proxyHandler = {
    apply(Target, thisArg, args) {
        return new Target(...args);
    }
};

module.exports = {
    Flow: new Proxy(Flow, proxyHandler),
    KeyFlow: new Proxy(KeyFlow, proxyHandler),
    ValidationError: ValidationError
};
