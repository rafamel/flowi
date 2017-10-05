'use strict';

class ValidationError extends Error {
    constructor(message, { note, isExplicit, label, key } = {}) {
        super(message);
        this.isFlowi = true;
        this.isExplicit = isExplicit || false;
        this.note = note || message;
        this.label = label;
        this.key = key;
    }
}

module.exports = ValidationError;
