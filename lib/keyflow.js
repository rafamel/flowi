'use strict';
const isPromise = require('is-promise');
const Joi = require('joi');
const Flow = require('./flow');
const ValidationError = require('./validation-error');

class KeyFlow extends Flow {
    constructor(validation, msgDefault) {
        super(validation, msgDefault);
        this.priorityStack = [];
        if (!this._labels) this._labels = {};
    }
    label() { return; }
    labels(labelsObj) {
        let { error } = Joi.validate(labelsObj, Joi.object().pattern(/.*/, Joi.string()));
        if (error) throw Error('Labels didn\'t receive a valid object with strings.');

        for (let key of Object.keys(labelsObj)) {
            this._labels[key] = labelsObj[key];
        }
        return this;
    }
    and(validation, msgDefault) {
        this._and(validation, msgDefault);
        if (validation && validation.isFlowi) {
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
    _checkInput(validation, allowObj = true) {
        if (validation.isJoi || validation.isFlowi
            || typeof validation === 'function') {
            return;
        }
        if (allowObj && typeof validation === 'object') {
            for (let key of Object.keys(validation)) {
                this._checkInput(validation[key], false);
            }
            return;
        }
        throw new Error('No valid Joi, Flowi validation, or function was provided.');
    }
    _knownKeys() {
        let knownKeys = [];
        for (let { validation } of this.stack) {
            if (validation instanceof KeyFlow) {
                knownKeys = knownKeys.concat(validation._knownKeys());
            } else if (validation.isJoi) {
                if (validation.hasOwnProperty('_inner')
                    && validation._inner.hasOwnProperty('children')) {
                    for (let item of validation._inner.children) {
                        if (item.key) knownKeys.push(item.key);
                    }
                }
            } else if (!validation.isFlowi
                && typeof validation === 'object') {
                knownKeys = knownKeys.concat(Object.keys(validation));
            }
        }
        return knownKeys;
    }
    _validate(
        toValidate,
        { noAsync, fallbackConvert },
        { unknown } = {}
    ) {
        if (unknown === 'disallow') {
            let knownKeys = this._knownKeys();
            for (let key of Object.keys(toValidate)) {
                if (knownKeys.indexOf(key) === -1) return {
                    error: new ValidationError(
                        `Unknown key ${key}`
                    ),
                    value: toValidate
                }
            }
        } else if (unknown === 'strip') {
            let knownKeys = this._knownKeys();
            let newToValidate = {};
            for (let key of Object.keys(toValidate)) {
                if (knownKeys.indexOf(key) !== -1) {
                    newToValidate[key] = toValidate[key];
                }
            }
            toValidate = newToValidate;
        }

        const fallbackCb = (toValidate, message, schema, convert) => {
            if (!(typeof schema === 'object')) {
                throw new Error('One of the validations was not a Joi or Flowi validation, object, or function.');
            }
            return this._recursiveSchemaValidation(
                toValidate,
                message,
                schema,
                Object.keys(schema),
                convert
            );
        }
        const ans = this._recursiveValidation(
            toValidate,
            this.priorityStack.concat(this.stack),
            {
                fallbackConvert: fallbackConvert,
                fallbackCb: fallbackCb
            }
        );
        if (noAsync && isPromise(ans)) {
            throw new Error('Use the Async validation functions when using any async function');
        }
        return ans;
    }
    _recursiveSchemaValidation(toValidateObj, message, schema, stack, convert) {
        if (stack.length < 1) return {
            error: null,
            value: toValidateObj
        };

        const schemaKey = stack.slice(0,1)[0];
        const toValidate = toValidateObj[schemaKey];

        if (!toValidate) return this._recursiveSchemaValidation(
            toValidateObj, message, schema, stack.slice(1), convert
        );

        let validation = schema[schemaKey];
        if (!validation.isFlowi) validation = new Flow(validation);


        const cb = ({ error, value }) => {
            if (convert && value !== undefined) {
                toValidateObj[schemaKey] = value;
            } else {
                // In case element was mutated
                toValidateObj[schemaKey] = toValidate;
            }

            if (error) {
                if (!error.key) error.key = schemaKey;
                else error.key = `${schemaKey}[${error.key}]`;
                if (!error.label && this._labels.hasOwnProperty(schemaKey)) {
                    error.label = this._labels[schemaKey];
                }
                if (message && !error.isExplicit) {
                    error.message = message;
                    error.isExplicit = true;
                } else {
                    error.message = error.message.replace(
                        'Value',
                        error.label || error.key
                    );
                }
                return { error: error, value: toValidateObj };
            }

            return this._recursiveSchemaValidation(
                toValidateObj, message, schema, stack.slice(1), convert
            );
        };

        let ans = validation._validate(
            toValidate,
            { fallbackConvert: convert }
        );
        if (!isPromise(ans)) {
            return cb(ans);
        }
        return new Promise((resolve, reject) => {
            ans.then(res => {
                resolve(cb(res));
            }).catch(error => { reject(error); });
        });
    }
}

module.exports = KeyFlow;
