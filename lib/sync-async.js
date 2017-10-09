'use strict';
const isPromise = require('is-promise');

module.exports = function (ans, cb) {
    if (!isPromise(ans)) {
        return cb(ans);
    }
    return new Promise((resolve, reject) => {
        ans.then(res => {
            resolve(cb(res));
        }).catch(err => { reject(err); });
    });
};
