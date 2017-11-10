'use strict';
const Joi = require('joi');
const Flow = require('./flow');
const KeyFlow = require('./keyflow');
const ValidationError = require('./validation-error');

const proxyHandler = {
    apply(Target, thisArg, args) {
        return new Target(...args);
    }
};

module.exports = {
    Joi,
    Flow: new Proxy(Flow, proxyHandler),
    KeyFlow: new Proxy(KeyFlow, proxyHandler),
    ValidationError: ValidationError
};
