'use strict';
const isPromise = require('is-promise');
const syncAsync = require('./sync-async');
const Joi = require('joi');
const ValidationError = require('./validation-error');

class Flow {
    constructor(validation, message) {
        this.isFlowi = true;
        this.stack = [];
        this._convert = false;
        this._label = undefined;

        this.and(validation, message);
    }
    label(label) {
        this._label = label;
        return this;
    }
    convert() {
        this._convert = true;
        return this;
    }
    and(validation, message) {
        if (message && typeof message !== 'string') {
            throw new Error('Message wasn\'t a string.');
        }
        if (!validation) return this;
        if (!(validation.isJoi || validation.isFlowi
            || typeof validation === 'function')) {
            throw new Error('No valid Joi, Flowi validation, or function was provided.');
        }

        this.stack.push({ validation: validation, message: message });
        if (validation.isFlowi) {
            this.label(validation._label);
        }
        return this;
    }
    validate(toValidate, options = {}) {
        options.noAsync = true;
        return this._validate(toValidate, options);
    }
    attempt(toValidate, options = {}) {
        options.noAsync = true;
        return this._attempt(toValidate, options);
    }
    async validateAsync(toValidate, options) {
        return this._validate(toValidate, options);
    }
    async attemptAsync(toValidate, options) {
        return this._attempt(toValidate, options);
    }

    // Private
    _attempt(...args) {
        const ans = this._validate(...args);
        if (isPromise(ans)) {
            return new Promise((resolve, reject) => {
                ans
                    .then(({ error, value }) => {
                        if (error) reject(error);
                        else resolve(value);
                    })
                    .catch((err) => reject(err));
            });
        } else {
            if (ans.error) throw ans.error;
            return ans.value;
        }
    }
    _validate(toValidate, options = {}) {
        const ans = this._recursiveValidation(toValidate, this.stack);

        if (options.noAsync && isPromise(ans)) {
            throw new Error('Use the Async validation functions when using any async function');
        }
        return ans;
    }
    _recursiveValidation(toValidate, stack) {
        if (stack.length < 1) {
            return {
                error: null,
                value: toValidate
            };
        }

        const { validation, message } = stack[0];

        // Joi
        if (validation.isJoi) {
            const label = validation._flags.label || this._label;
            let { error, value } = Joi.validate(toValidate, validation, {
                convert: this._convert,
                allowUnknown: true,
                language: {
                    key: `${ label || 'Value' } `
                }
            });
            if (!error) {
                return this._recursiveValidation(value, stack.slice(1));
            }
            return {
                error: new ValidationError((message || error.message), {
                    note: error.message,
                    isExplicit: Boolean(message),
                    label: label
                }),
                value: value
            };
        }

        // Flowi
        if (validation.isFlowi) {
            let ans = validation._validate(toValidate);
            return syncAsync(ans, res => {
                if (!res.error) {
                    return this._recursiveValidation(res.value, stack.slice(1));
                }

                if (!res.error.label && this._label) res.error.label = this._label;

                if (message && !res.error.isExplicit) {
                    res.error.message = message;
                    res.error.isExplicit = true;
                } else if (res.error.label) {
                    res.error.message = res.error.message.replace(
                        'Value',
                        res.error.label
                    );
                }
                return res;
            });
        }

        // Function
        if (typeof validation === 'function') {
            let ans = validation(toValidate);
            return syncAsync(ans, (res = {}) => {
                if (res.value === undefined || !this._convert) {
                    res.value = toValidate;
                }

                if (!res.error) {
                    return this._recursiveValidation(res.value, stack.slice(1));
                }

                if (res.error.isFlowi) {
                    if (message && !res.error.isExplicit) {
                        res.error.note = res.error.message;
                        res.error.message = message;
                        res.error.isExplicit = true;
                    }
                } else {
                    if (!(res.error instanceof Error)) {
                        res.error = new Error(String(res.error));
                    }

                    res.error = new ValidationError(
                        (message || res.error.message),
                        {
                            note: res.error.message,
                            isExplicit: Boolean(message),
                            label: this._label
                        }
                    );
                }

                return { error: res.error, value: res.value };
            });
        }

        throw new Error('One of the validations was not a valid object or function.');
    }
}

module.exports = Flow;
