'use strict';
const isPromise = require('is-promise');
const syncAsync = require('./sync-async');
const Joi = require('joi');
const Flow = require('./flow');
const ValidationError = require('./validation-error');

class KeyFlow extends Flow {
    constructor(validation, msgDefault) {
        super(validation, msgDefault);
        if (!this._knownKeys) this._knownKeys = [];
        if (!this._labels) this._labels = {};
        this._define = {
            all: { require: false, forbid: false },
            require: [],
            forbid: [],
            use: []
        };
    }
    get keys() {
        return (this._define.use.length > 0) ? this._define.use : this._knownKeys;
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
    require(arrOrBool) {
        if (arrOrBool === undefined || typeof arrOrBool === 'boolean') {
            this._define.all.require = (arrOrBool === undefined) ? true : arrOrBool;
            return this;
        }
        this._define.all.require = false;
        return this._addDefine(arrOrBool, 'require()', 'require');
    }
    forbid(arrOrBool) {
        if (arrOrBool === undefined || typeof arrOrBool === 'boolean') {
            this._define.all.forbid = (arrOrBool === undefined) ? true : arrOrBool;
            return this;
        }
        this._define.all.forbid = false;
        return this._addDefine(arrOrBool, 'forbid()', 'forbid');
    }
    use(stringArray) {
        return this._addDefine(stringArray, 'use()', 'use');
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
            this._knownKeys = this._knownKeys.concat(validation.keys);
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
    _addDefine(stringArray, name, key) {
        let { error } = Joi.validate(stringArray, Joi.array().items(Joi.string()));
        if (error) throw Error(`keyflow.${name} didn't receive a valid array of strings.`);
        this._define[key] = stringArray;
        return this;
    }
    _validate(toValidate, { noAsync, strip } = {}) {
        // Strip
        if (strip || this._define.use.length > 0) {
            const keys = this.keys;
            let newToValidate = {};
            for (let key of Object.keys(toValidate)) {
                if (keys.indexOf(key) !== -1) {
                    newToValidate[key] = toValidate[key];
                }
            }
            toValidate = newToValidate;
        }

        // Forbid & Require
        const doForbidRequire = (key, msg) => {
            let label, note;
            if (this._labels.hasOwnProperty(key)) {
                label = this._labels[key];
                note = `${label} ${msg}`;
            } else note = `${key} ${msg}`;
            return {
                error: new ValidationError(
                    note,
                    {
                        note: note,
                        label: label,
                        key: key
                    }
                ),
                value: toValidate
            };
        };
        // Forbid
        if (this._define.all.forbid) {
            const keys = this.keys;
            for (let key of Object.keys(toValidate)) {
                if (keys.indexOf(key) === -1) {
                    return doForbidRequire(key, 'is forbidden');
                }
            }
        } else {
            for (let key of this._define.forbid) {
                if (Object.prototype.hasOwnProperty.call(toValidate, key)) {
                    return doForbidRequire(key, 'is forbidden');
                }
            }
        }
        // Require
        let toRequire = this._define.require;
        if (this._define.all.require) toRequire = this.keys;
        for (let key of toRequire) {
            if (!Object.prototype.hasOwnProperty.call(toValidate, key)) {
                return doForbidRequire(key, 'is required');
            }
        }

        const ans = this._recursiveValidation(toValidate, this.stack);
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
