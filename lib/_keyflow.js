'use strict';
const Joi = require('joi');
const Flow = require('./flow');
const ValidationError = require('./validation-error');

class KeyFlow {
    constructor(validation, msgDefault) {
        // super(validation, msgDefault);
        this._labels = {};
    }
    and(validation, msgDefault) {
        return this._and(validation, msgDefault);
    }
    labels(labelsObj) {
        let { error } = Joi.validate(labelsObj, Joi.object().pattern(/.*/, Joi.string()));
        if (error) throw Error('Labels didn\'t receive a valid object with strings.');

        for (let key of Object.keys(labelsObj)) {
            this._labels[key] = labelsObj[key];
        }
        return this;
    }
    require(stringArray) {
        let { error } = Joi.validate(stringArray, Joi.array().items(Joi.string()));
        if (error) throw Error('Require didn\'t receive a valid array of strings.');

        const obj = {};
        stringArray.forEach(key => { obj[key] = Joi.any().required(); });
        this._and(obj, undefined, true);
        return this;
    }
    forbid(stringArray) {
        let { error } = Joi.validate(stringArray, Joi.array().items(Joi.string()));
        if (error) throw Error('Forbid didn\'t receive a valid array of strings.');
        this._and((obj) => {
            for (let str of stringArray) {
                if (Object.prototype.hasOwnProperty.call(obj, str)) {
                    let label;
                    let message = `${str} is not allowed`;
                    if (this._labels.hasOwnProperty(str)) {
                        label = this._labels[str];
                        message = `${label} is not allowed`;
                    }
                    return new ValidationError(message, { note: message, label: label });
                }
            }
        }, undefined, true);
        return this;
    }
    validate(obj) {
        const stack = this.priorityStack.concat(this.stack);
        for (let item of stack) {
            let err;
            const { validation, message } = item;
            if (typeof validation === 'object') {
                if (validation.isJoi) err = this._validateJoy(obj, validation, message);
                if (validation.isFlowi) {
                    err = validation.validate(obj);
                    if (message & err && !err.isExplicit) err.message = message;
                } else err = this._runSchema(obj, validation, message);
            } else if (typeof validation === 'function') {
                err = validation(obj);
                if (err) {
                    if (!(err instanceof Error)) {
                        throw new Error('No valid Error object was returned by a custom function.');
                    }
                    if (message) err = this._toFlowiError(err, message);
                }
            } else throw new Error('No valid Joi or Flowi validation, object, or function was provided.');
            if (err) return err;
        }
    }
    assert(obj) {
        const err = this.validate(obj);
        if (err) throw err;
    }
    async validateAsync(obj) {
        try {
            const stack = this.priorityStack.concat(this.stack);
            for (let item of stack) {
                const { validation, message } = item;
                let err;
                if (typeof validation === 'object') {
                    if (validation.isJoi) err = this._validateJoy(obj, validation, message);
                    if (validation.isFlowi) {
                        err = await validation.validate(obj);
                        if (message & err && !err.isExplicit) err.message = message;
                    } else err = this._runSchema(obj, validation, message);
                } else if (typeof validation === 'function') {
                    err = await validation(obj);
                    if (err) {
                        if (!(err instanceof Error)) {
                            throw new Error('No valid Error object was returned by a custom function.');
                        }
                        if (message) err = this._toFlowiError(err, message);
                    }
                } else throw new Error('No valid Joi or Flowi validation, object, or function was provided.');
                if (err) return err;
            }
        } catch (err) { throw err; };
    }
    async assertAsync(obj) {
        try {
            const err = await this.validateAsync(obj);
            if (err) throw err;
        } catch (err) { throw err; };
    }

    // Private
    _validateJoy(obj, validation, message) {
        const { error } = Joi.validate(obj, validation);
        if (error) {
            if (message) return this._toFlowiError(error, message);

            // eslint-disable-next-line
            const match = error.message.match(/\"[^\"]+\"/);
            if (!match) return this._toFlowiError(error);

            const key = match[0].slice(1, -1);
            if (!this._labels.hasOwnProperty(key)) return this._toFlowiError(error);

            const msgMatch = error.message.match(/\[[^\]]+\]/);
            if (msgMatch) error.message = msgMatch[0].slice(1, -1);
            error.message = error.message.replace(key, this._labels[key]);
            return this._toFlowiError(error, undefined, this._labels[key]);
        }
    }
    _runSchema(obj, schema, message) {
        for (let key of Object.keys(schema)) {
            let validation = schema[key];
            let err;
            if (validation.isFlowi) {
                err = (validation._label)
                    ? validation.validate(obj[key])
                    : validation.label(this._labels[key] || key).validate(obj[key]);
            } else if (validation.isJoi) {
                let incomingLabel = validation._flags.label;
                if (!incomingLabel && this._labels.hasOwnProperty(key)) {
                    incomingLabel = this._labels[key];
                    validation = validation.label(incomingLabel);
                } else validation = validation.label(key);
                const { error } = Joi.validate(obj[key], validation);
                if (error) err = this._toFlowiError(error, message, incomingLabel);
            } else {
                throw new Error(`No valid validation was provided for key ${key}`);
            }
            if (err) return err;
        }
    }
    _toFlowiError(err, message, label) {
        err = new ValidationError(
            (message || err.message.replace('"', '').replace('"', '')),
            { note: (err.message || err), isExplicit: Boolean(message), label: label }
        );
        return err;
    }
}

module.exports = KeyFlow;
