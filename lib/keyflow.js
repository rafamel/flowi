'use strict';
const isPromise = require('is-promise');
const syncAsync = require('./sync-async');
const Joi = require('joi');
const Flow = require('./flow');
const ValidationError = require('./validation-error');

class KeyFlow extends Flow {
    constructor(validation, msgDefault) {
        super(validation, msgDefault);
        this.priorityStack = [];
        if (!this._knownKeys) this._knownKeys = [];
        if (!this._labels) this._labels = {};

        delete this._label;
    }
    label() { throw new Error('KeyFlows can\'t be uniquely labelled. You might be looking for keyflow.labels()'); }
    labels(labelsObj) {
        let { error } = Joi.validate(labelsObj, Joi.object().pattern(/.*/, Joi.string()));
        if (error) throw Error('Labels didn\'t receive a valid object with strings.');

        for (let key of Object.keys(labelsObj)) {
            this._labels[key] = labelsObj[key];
        }
        return this;
    }
    and(validation, message) {
        if (message && typeof message !== 'string') {
            throw new Error('Message wasn\'t a string.');
        }
        if (!validation) return this;

        // Check valid input and determine if it's a schema
        const checkInput = (validation, allowObj = true) => {
            if (validation.isJoi || validation.isFlowi
                || typeof validation === 'function') {
                return false;
            }
            if (allowObj && typeof validation === 'object') {
                for (let key of Object.keys(validation)) {
                    checkInput(validation[key], false);
                }
                return true;
            }
            throw new Error('No valid Joi, Flowi validation, or function was provided.');
        };
        const isSchema = checkInput(validation);

        // Add known keys
        if (!this._knownKeys) this._knownKeys = [];
        if (validation instanceof KeyFlow) {
            this._knownKeys = this._knownKeys.concat(validation._knownKeys);
        } else if (validation.isJoi) {
            if (validation._inner && validation._inner.children) {
                for (let item of validation._inner.children) {
                    if (item.key) this._knownKeys.push(item.key);
                }
            }
        } else if (!validation.isFlowi
            && typeof validation === 'object') {
            this._knownKeys = this._knownKeys.concat(Object.keys(validation));
        }

        // Prepare as function for schemas
        if (isSchema) {
            let schema = validation;
            validation = (toValidate) => {
                return this._recursiveSchemaValidation(
                    toValidate, schema, Object.keys(schema)
                );
            };
        }

        // Add validation to stack
        this.stack.push({ validation: validation, message: message });
        if (validation instanceof KeyFlow) {
            if (!this._labels) this._labels = {};
            this.labels(validation._labels);
        }
        return this;
    }
    require(stringArray, msg) {
        let { error } = Joi.validate(stringArray, Joi.array().items(Joi.string()));
        if (error) throw Error('Require didn\'t receive a valid array of strings.');
        this.priorityStack.push({
            validation: (obj) => {
                for (let key of stringArray) {
                    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                        let label;
                        let note = `${key} is required`;
                        if (this._labels.hasOwnProperty(key)) {
                            label = this._labels[key];
                            note = `${label} is required`;
                        }
                        return {
                            error: new ValidationError(
                                msg || note,
                                {
                                    note: note,
                                    label: label,
                                    key: key
                                }
                            )
                        };
                    }
                }
            }
        });
        return this;
    }
    forbid(stringArray, msg) {
        let { error } = Joi.validate(stringArray, Joi.array().items(Joi.string()));
        if (error) throw Error('Forbid didn\'t receive a valid array of strings.');
        this.priorityStack.push({
            validation: (obj) => {
                for (let key of stringArray) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        let label;
                        let note = `${key} is forbidden`;
                        if (this._labels.hasOwnProperty(key)) {
                            label = this._labels[key];
                            note = `${label} is forbidden`;
                        }
                        return {
                            error: new ValidationError(
                                msg || note,
                                {
                                    note: note,
                                    label: label,
                                    key: key
                                }
                            )
                        };
                    }
                }
            }
        });
        return this;
    }
    _validate(toValidate, { noAsync, unknown } = {}) {
        if (unknown === 'disallow') {
            for (let key of Object.keys(toValidate)) {
                if (this._knownKeys.indexOf(key) === -1) {
                    return {
                        error: new ValidationError(
                            `Unknown key ${key}`
                        ),
                        value: toValidate
                    };
                }
            }
        } else if (unknown === 'strip') {
            let newToValidate = {};
            for (let key of Object.keys(toValidate)) {
                if (this._knownKeys.indexOf(key) !== -1) {
                    newToValidate[key] = toValidate[key];
                }
            }
            toValidate = newToValidate;
        }

        const ans = this._recursiveValidation(
            toValidate,
            this.priorityStack.concat(this.stack)
        );
        if (noAsync && isPromise(ans)) {
            throw new Error('Use the Async validation functions when using any async function');
        }
        return ans;
    }
    _recursiveSchemaValidation(toValidateObj, schema, stack) {
        if (stack.length < 1) {
            return {
                error: null,
                value: toValidateObj
            };
        }

        const schemaKey = stack[0];
        const toValidate = toValidateObj[schemaKey];

        if (!toValidate) {
            return this._recursiveSchemaValidation(
                toValidateObj, schema, stack.slice(1)
            );
        }

        let validation = schema[schemaKey];
        if (!validation.isFlowi) {
            validation = new Flow(validation);
            if (this._convert) validation = validation.convert();
        }

        let ans = validation._validate(toValidate);
        return syncAsync(ans, ({ error, value }) => {
            if (value !== undefined) toValidateObj[schemaKey] = value;
            if (error) {
                if (!error.key) error.key = schemaKey;
                else error.key = `${schemaKey}[${error.key}]`;
                if (!error.label && this._labels.hasOwnProperty(schemaKey)) {
                    error.label = this._labels[schemaKey];
                }
                if (!error.isExplicit) {
                    error.message = error.message.replace(
                        'Value',
                        error.label || error.key
                    );
                }
                return { error: error, value: toValidateObj };
            }

            return this._recursiveSchemaValidation(
                toValidateObj, schema, stack.slice(1)
            );
        });
    }
}

module.exports = KeyFlow;
