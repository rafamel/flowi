# Flowi

[![Version](https://img.shields.io/github/package-json/v/rafamel/flowi.svg)](https://github.com/rafamel/flowi)
[![Build Status](https://travis-ci.org/rafamel/flowi.svg)](https://travis-ci.org/rafamel/flowi)
[![Coverage](https://img.shields.io/coveralls/rafamel/flowi.svg)](https://coveralls.io/github/rafamel/flowi)
[![Dependencies](https://david-dm.org/rafamel/flowi/status.svg)](https://david-dm.org/rafamel/flowi)
[![Vulnerabilities](https://snyk.io/test/npm/flowi/badge.svg)](https://snyk.io/test/npm/flowi)
[![Issues](https://img.shields.io/github/issues/rafamel/flowi.svg)](https://github.com/rafamel/flowi/issues)
[![License](https://img.shields.io/github/license/rafamel/flowi.svg)](https://github.com/rafamel/flowi/blob/master/LICENSE)

**Concatenate `Joi` validations, or custom function validations, for the same object or object key. Personalize the output error message for each of those validations.**

*Flowi* was initially built to validate requests on Express and expose only *explicit* error messages to the user directly from the server when each validation fails. Check [`ValidationError`](#validationerror) to know more.

## Install

[`npm install flowi`](https://www.npmjs.com/package/flowi)

## Usage

- Use `KeyFlow` to define the validations for objects and their keys
- Use `Flow` for all other types (strings, numbers, booleans...)

[*Check `Joi` documentation first*](https://github.com/hapijs/joi/blob/v11.1.1/API.md)

### Flow

```javascript
const { Joi, Flow } = require('flowi');

const toValidate = 'example string to validate';

const validation = Flow(validation, message);
const { value, error } = validation.validate(toValidate);
// or
const validation = new Flow(validation, message);
const { value, error } = validation.validate(toValidate);
```

#### `Flow(validation, message)`

Create a new `flow` object by `Flow(validation, message)` or `new Flow(validation, message)`.

- `validation`: Another `flow` validation, `joi` validation object, or [custom function](#custom-function). If it is a `flow` object and it has a label, the new object will inherit that label.
- `message` (optional): Message to display if validation fails. Will display `Joi` default otherwise. If there's an inner `flow` validation with a message inside, the inner one will have priority.

```javascript
// Joi validation
const aValidation = Flow(Joi.string().max(6).label('Password'));
// Flow validation
const bValidation = Flow(aValidation, 'A message');
// Custom function
const cValidation = Flow(x => {
    if (x === 1) return { error: new Error('Some Error')}
    return;
}, 'Other message');

// Label inheritance: `dValidation` will also have label `Password`
const dValidation = Flow(aValidation);

// Message precedence: This below would show `Message 1`
// if the validation fails
const eValidation = Flow(
    Flow(Joi.string().max(5), 'Message 1'),
    'Message 2'
);
```

#### `flow.and(validation, message)`

Append a new validation to a `flow` oject. Takes the same arguments as [`Flow()`](#flowvalidation-message).

```javascript
// Concatenating validations with different error messages
const validation = Flow(
        Joi.string().max(6),
        'Cannot have more than 6 characters.'
    )
    // The one below, when failing, will show the default Joi error
    .and(Joi.string().min(2))
    .and(
        Joi.string().uppercase(),
        'All letters must be uppercase.'
    );
```

#### `flow.label(label)`

- `label`: Label to use on the error message if the validation fails.

```javascript
const validationForUsername = Flow(Joi.string().max(6))
    .and(Joi.string().min(2))
    .label('Username');
```

#### `flow.convert()`

When `.convert()` is applied to a `flow` object, it will cast types and convert, when possible, instead of failing the validation. It has inner to outer precedence, meaning if an inner `flow` object has conversion active, it will convert for all its validations regardless of the outer `flow` conversion setting; and if an inner `flow` doesn't have conversion active, it won't convert even if the outer `flow` does.

```javascript
// This will effectively trim the string if it isn't
const aValidation = Flow(Joi.string().trim()).convert();
// This will trim the string but won't convert
// to uppercase (as it only applies to `aValidation`),
// so it will fail if the string is not all in uppercase
const bValidation = Flow(aValidation).and(Joi.string().uppercase());
// This will not convert to uppercase the string either, as the
// Flow object the Joi validation belongs to doesn't have
// conversion active (inner to outer precendence).
const cValidation = Flow(Flow(Joi.string().uppercase())).convert()
```

#### `flow.validate(toValidate)`

- `toValidate`: Object to apply the validation to.

Returns a an object with two keys:

- `value`: The original `toValidate` object, or casted/converted when `flow.convert()` is active.
- `error`: A [`ValidationError`](#validationerror), if any ocurred, otherwise `null`.

#### `flow.attempt(toValidate)`

Same as [`flow.validate()`](#flowvalidatetovalidate), but it will return the `value` if the validation is successful, or throw the `error` if any occurs.

#### `flow.validateAsync(toValidate)` & `flow.attemptAsync(toValidate)`

Same as [`flow.validate()`](#flowvalidatetovalidate) and [`flow.attempt()`](#flowattempttovalidate), but will return a promise. Their usage is a must if any async/promise-returning function was fed into a `flow` object as a [custom function](#custom-function);

### KeyFlow

```javascript
const { Joi, Flow, KeyFlow } = require('flowi');

const toValidate = {
    username: 'ThisIsAnUser',
    password: 'MyPassword'
};

const validation = KeyFlow(validation, message);
const { value, error } = validation.validate(toValidate);
// or
const validation = new KeyFlow(validation, message);
const { value, error } = validation.validate(toValidate);
```

#### `KeyFlow(validation, message)`

Create a new `flow` object by `KeyFlow(validation, message)` or `new KeyFlow(validation, message)`.

- `validation`: Another `keyflow` or `flow` validation, `joi` validation object, [custom function](#custom-function), or schema validations. If it is a `keyflow` object and it has labels, the new object will inherit the labels - it will, however, not inherit labels pertaining to `flow` objects within a schema of the `keyflow` object.
- `message` (Optional): Message to display if validation fails. Will display `Joi` default otherwise. If there's an inner `flow` or `keyflow` validation with a message inside, the inner one will have priority.

#### `keyflow.and(validation, message)`

Append a new validation to a `keyflow` oject. Takes the same arguments as [`Keyflow()`](#keyflowvalidation-message).

```javascript
const aValidation =
    // Adding a schema
    KeyFlow(
        {
            username: Joi.string().min(5).max(10),
            password: Flow(
                Joi.string().min(10).max(30),
                'Password should be 10 to 30 characters long'
            ),
            email: Flow(
                Joi.string().email(),
                'Email should be valid'
            )
        },
        'This will only show if a key has no message, as it\'s the case for "username"'
    )
    // Adding a Joi validation
    .and(Joi.object().with('username', 'password'))
    // Adding a custom function
    .and(obj => {
        if (obj.username === 'thisIsTaken') {
            return { error: new Error() };
        }
    }, 'Username is taken');

// Adding a `keyflow` validation.
// In doing so, we preserve the previous one (`aValidation`)
// which can be useful to create a general validation that we
// want to use as base for different cases without mutating the
// original one (as we would if we did `aValidation.and()`).
const bValidation = Flow(aValidation)
    // This new `keyflow.and()` will only apply for `bValidation`,
    // but won't be added to `aValidation`
    .and({
        name: Joi.string().min(3).max(20)
    });
```

#### `keyflow.labels(labels)`

- `labels`: Object with the labels for each key.

```javascript
const aValidation = KeyFlow({
    username: Joi.string().min(5).max(10),
    password: Joi.string().min(10).max(30),
    email: Joi.string().email()
}).labels({ username: 'User', password: 'Password', email: 'email' });

// `bValidation` will inherit the labels of `aValidation`,
// even for new validations on the same keys
const bValidation = KeyFlow(aValidation).and({
    // Will also inherit the label `Username` for the error message
    username: Joi.string().trim()
});
```

#### `keyflow.use(keys)`

- `keys`: An array of keys (as strings) to use. It will strip all other keys from the incoming object. It will also have an effect over [`keyflow.require()`](#keyflowrequirekeys) and [`keyflow.forbid()`](#keyflowforbidkeys).

```javascript
const validation = Keyflow({
    username: Joi.string().min(5).max(10),
    password: Joi.string().min(10).max(30),
    email: Joi.string().email()
}).use(['username', 'password']);
```

#### `keyflow.require(keys)`

- `keys` (optional): It can be:
    - An array of keys (as strings) to require.
    - `undefined`, or a boolean. If `undefined` or `true`, it will require all known keys; if `false`, it will not. Known keys are those defined by [`keyflow.use()`](#keyflowusekeys) or all of those that appear in any schema fed to [`Keyflow()`](#keyflowvalidation-message) or [`keyflow.and()`](#keyflowandvalidation-message), including those within a `Joi.object()` or inside inner `keyflow`s.

```javascript
// Keys 'username' and 'password' are required
const validation = Keyflow({
    username: Joi.string().min(5).max(10),
    password: Joi.string().min(10).max(30),
    email: Joi.string().email()
}).require(['username', 'password']);
// All known keys are now required
validation.require();
```

#### `keyflow.forbid(keys)`

- `keys` (optional): It can be:
    - An array of keys (as strings) to forbid.
    - `undefined`, or a boolean. If `undefined` or `true`, it will forbid all unknown keys; if `false`, it will not. Known keys are those defined by [`keyflow.use()`](#keyflowusekeys) or all of those that appear in any schema fed to [`Keyflow()`](#keyflowvalidation-message) or [`keyflow.and()`](#keyflowandvalidation-message), including those within a `Joi.object()` or inside inner `keyflow`s.

```javascript
// Key 'name' is forbidden
const validation = Keyflow({
    username: Joi.string().min(5).max(10),
    password: Joi.string().min(10).max(30),
    email: Joi.string().email()
}).forbid(['name']);
// All unknown keys are now forbidden
validation.forbid();
```

#### `keyflow.convert()`

Same as [`flow.convert()`](#flowconvert). It has inner to outer precedence, meaning if an inner `flow` or `keyflow` object has conversion active, it will convert for the validations of that object regardless of the outer setting. Therefore, `convert()` for a `keyflow` object will only make a difference for direct inner *Joi* and [*custom function*](#custom-function) validations, but not for other inner `flow` or `keyflow` validations unless they are `convert()`ed themselves.

#### `keyflow.validate(toValidate, options)`

- `toValidate`: Object to apply the validation to.
- `options` (Optional): With keys:
    - `strip`: Boolean. If `true`, all unknown keys will not be on the returned object (within the `value` key); `false` by default. If [`keyflow.use()`](#keyflowusekeys) was used, it will strip all other keys from the object regardless of whether the `strip` option here is `false`;

Returns a an object with two keys, `value` and `error`, in the same fashion as [`flow.validate()`](#flowvalidatetovalidate).

```javascript
const validation = KeyFlow({
    username: Joi.string().min(5).max(10)
});

// This would return `{ value: { password: 'abc' }, error: null }`
// as it's ignoring the unknown value `password`
validation.validate({ password: 'abc' });

// This would return `{ value: { username: 'cde' }, error: null }`
// as it's stripping the unknown value `password`
validation.validate(
    { password: 'abc', username: 'cde' },
    { strip: true }
);
```

#### `keyflow.attempt(toValidate, options)`

Same as [`keyflow.validate()`](#keyflowvalidatetovalidate-options), but it will return the `value` if the validation is successful, or throw the `error` if any occurs.

#### `keyflow.validateAsync(toValidate, options)` & `keyflow.attemptAsync(toValidate, options)`

Same as [`keyflow.validate()`](#keyflowvalidatetovalidate-options) and [`keyflow.attempt()`](#keyflowattempttovalidate-options), but will return a promise. Their usage is a must if any async/promise-returning function was fed into any of the inner validations as a [custom function](#custom-function);

### ValidationError

#### Properties

A `ValidationError` will have properties:

- `isFlowi`: Always `true`.
- `isExplicit`: `true` if the message was explicitly defined (not  generated by Joi) through a `flow` or `keyflow` object; `false` otherwise. You could use this to, for example, make only explicit messages public.
- `label`: `undefined` if the label wasn't explicitly set. This can be useful if, for example, you just want to expose `ValidationError` messages if they are explicit or are not but have a label set.
- `key`: The key the error comes from if it was part of a `keyflow` schema.
- `note`: Original `Joi` message or inner `Flowi` message, if it exists, that may have been overriden by labels or explicit `flow` or `keyflow` messages.
- `status`: `400` by default. If you're using *Express* and *Flowi* customs validations it can come in handy.

#### `new ValidationError(message, properties)`

- `message`: Error message.
- `properties` (optional): Object with keys:
    - `isExplicit`: `false` by default.
    - `label`: `undefined` by default.
    - `key`: `undefined` by default.
    - `note`: Same as `message` by default.

You can return a `ValidationError` in your [custom function](#custom-function). If you choose to throw an explicit message, don't forget to set `isExplicit` to true so it doesn't get overriden by other messages.

```javascript
const { Flow, ValidationError } = require('flowi');

const validation = Flow(x => {
    if (x === 'hello') {
        return {
            error: new ValidationError(
                `'hello' is a forbidden value`,
                { isExplicit: true }
            )
        };
    }
});
```

### Custom function

You can create your own validations for `flow` and `keyflow`.

- If the validation didn't pass, you must return an object with a non empty `error` key. This can be a common `Error` (which will be converted to a [`ValidationError`](#validationerror) under the hood), or a `ValidationError` itself. `aValidation` and `bValidation` below would be equivalent:

```javascript
const aValidation = Flow(x => {
    return { error: new Error() };
}, 'This is an error');

const bValidation = Flow(x => {
    return {
        error: new ValidationError(
            'This is an error',
            { isExplicit: true }
        )
    };
});
```

- If the validation passed, you can return:
    - `undefined`
    - An object with a `null` `error` key. These would be equivalent:

```javascript
const aValidation = Flow(x => {
    return;
});
const bValidation = Flow(x => {
    return {
        error: null
    };
});
```

You can always also return the value and, if you choose to, mutate it. In such case, [`flow.convert()`](#flowconvert) or [`keyflow.convert()`](#keyflowconvert) must be active (otherwise the new value will be ignored).

```javascript
// We only activate `convert` for this validation,
// so it doesn't apply to any other
const mutation = Flow(x => {
    return {
        error: null,
        value: x+10;
    };
}).convert();

const validation = Flow()
    .and(Joi.number().min(5))
    .and(mutation)
    .and(Joi.number().min(15));

validation.validate(6); // In this case this validation would pass.
```

Remember that, regardless of whether `convert()` is active, if you use a custom function on a `keyflow` object, you could mutate the object to validate by mistake, instead of correctly returning a new object via `value`.

```javascript
const validation = KeyFlow(obj => {
    // Here we are mutating the object and it won't matter
    // whether `convert()` is active. Subsequent validations
    // will receive an object with an `username` key
    // with value `MyUsername`
    obj.username = 'MyUsername';
});
```

Async functions are also allowed, just remember to use `validateAsync()` or `attemptAsync()`.

```javascript
const validation = KeyFlow(async obj => {
    if (await usernameExistsAsync(obj.username)) {
        return {
            value: obj,
            error: new ValidationError(
                'Username already exists',
                { isExplicit: true }
            )
        };
    }
    if (await emailExistsAsync(obj.email)) {
        return {
            value: obj,
            error: new ValidationError(
                'Email already exists',
                { isExplicit: true }
            )
        };
    }
});
```
