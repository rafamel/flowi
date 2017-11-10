'use strict';

class ValidationError extends Error {
    constructor(message, { note, isExplicit, label, key, status } = {}) {
        super(message);
        this.isFlowi = true;
        this.isExplicit = isExplicit || false;
        this.note = note || message;
        this.label = label;
        this.key = key;
        this.status = status || 400;
    }
}

module.exports = ValidationError;
