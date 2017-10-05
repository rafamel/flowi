'use strict';
const isPromise = require('is-promise');
const Joi = require('joi');
const ValidationError = require('./validation-error');

class Flow {
    constructor(validation, message) {
        this.isFlowi = true;
        this.stack = [];
        this._label = undefined;

        this.and(validation, message);
    }
    label(label) {
        this._label = label;
        return this;
    }
    convert(on = true) {
        if (on) this._convert = true;
        else this._convert = false;
        return this;
    }
    and(validation, message) {
        this._and(validation, message);
        return this;
    }
    validate(toValidate, options) {
        return this._validate(toValidate, { noAsync: true }, options);
    }
    attempt(toValidate, options) {
        return this._attempt(toValidate, { noAsync: true }, options);
    }
    async validateAsync(toValidate, options) {
        return this._validate(toValidate, { noAsync: false }, options);
    }
    async attemptAsync(toValidate, options) {
        return this._attempt(toValidate, { noAsync: false }, options);
    }

    // Private
    _and(validation, message) {
        if (message && typeof message !== 'string') {
            throw new Error('Message wasn\'t a string.');
        }
        if (!validation) return this;

        this._checkInput(validation);
        this.stack.push({ validation: validation, message: message });

        if (validation.isFlowi) {
            this.label(validation._label);
        }
    }
    _checkInput(validation) {
        if (validation.isJoi || validation.isFlowi
            || typeof validation === 'function') {
            return;
        }
        throw new Error('No valid Joi, Flowi validation, or function was provided.');
    }
    _attempt(toValidate, config, options) {
        const ans = this._validate(toValidate, config, options);
        if (isPromise(ans)) {
            return new Promise((resolve, reject) => {
                ans.then(({ error, value }) => {
                    if (error) reject(error);
                    else resolve(value);
                })
                .catch((err) => reject(error));
            });
        } else {
            if (ans.error) throw ans.error;
            return ans.value;
        }
    }
    _validate(toValidate, { noAsync, fallbackConvert }) {
        const ans = this._recursiveValidation(
            toValidate,
            this.stack,
            {
                fallbackConvert: fallbackConvert,
                fallbackCb: null
            }
        );
        if (noAsync && isPromise(ans)) {
            throw new Error('Use the Async validation functions when using any async function');
        }
        return ans;
    }
    _recursiveValidation(toValidate, stack, config) {
        const checkValidation = (ans, helper) => {
            const cb = ({ error, value } = {}) => {
                if (error) {
                    return {
                        error: ((helper) ? helper(error) : error),
                        value: ((!convert || value == undefined)
                            ? toValidate : value)
                    };
                }
                return this._recursiveValidation(
                    ((!convert || value == undefined)
                        ? toValidate : value),
                    stack.slice(1),
                    config
                );
            };

            if (!isPromise(ans)) {
                return cb(ans);
            }
            return new Promise((resolve, reject) => {
                ans.then(res => {
                    resolve(cb(res));
                }).catch(error => { reject(error); });
            });
        };

        if (stack.length < 1) return {
            error: null,
            value: toValidate
        };
        const { validation, message } = stack.slice(0,1)[0];
        const { fallbackCb, fallbackConvert } = config;
        let convert = Boolean(
            (this._convert === undefined)
            ? fallbackConvert
            : this._convert
        );

        // Joi
        if (validation.isJoi) {
            return checkValidation(
                this._validateJoi(toValidate,
                    validation, message, convert)
            );
        }

        // Flowi
        if (validation.isFlowi) {
            let helper = (error) => {
                if (!error) return null;

                if (!error.label && this._label) error.label = this._label;

                if (message && !error.isExplicit) {
                    error.message = message;
                    error.isExplicit = true;
                } else if (error.label) {
                    error.message = error.message.replace(
                        'Value',
                        error.label
                    )
                }
                return error;
            };
            return checkValidation(
                validation._validate(
                    toValidate,
                    { fallbackConvert: fallbackConvert }
                ),
                helper
            );
        }

        // Function
        if (typeof validation === 'function') {
            let helper = (error) => {
                if (!error) return null;
                return this._toFlowiError(error, message, this._key);
            };
            return checkValidation(
                validation(toValidate),
                helper
            );
        }

        // Fallback
        if (fallbackCb) {
            return checkValidation(
                fallbackCb(toValidate, message, validation, convert)
            );
        }

        throw new Error('One of the validations was not a Joi or Flowi validation, or function.');
    }
    _validateJoi(toValidate, validation, message, convert) {
        let label;
        if (validation._flags.label) {
            label = validation._flags.label;
        } else if (this._label) {
            label = this._label;
            validation = validation.label(this._label);
        } else {
            validation = validation.label('Value');
        }
        let { error, value } = Joi.validate(toValidate, validation, {
            convert: convert,
            allowUnknown: true,
            language: {
                key: '{{!label}} '
            }
        });
        return {
            error: (
                (error)
                ? new ValidationError((message || error.message), {
                    note: error.message,
                    isExplicit: Boolean(message),
                    label: label,
                    key: this._key
                })
                : null
            ),
            value: value
        };
    }
    _toFlowiError(err, message, key, label) {
        if (err.isFlowi && err.label) label = err.label;
        if (!(err instanceof Error)) {
            err = new Error(String(err));
        }
        return new ValidationError(
            (message || err.message),
            {
                note: (err.message || String(err)),
                isExplicit: Boolean(message),
                label: label,
                key: key
            }
        );
    }
}

module.exports = Flow;
