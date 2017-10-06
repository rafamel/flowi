# Flowi

[![Version](https://img.shields.io/github/package-json/v/rafamel/flowi.svg)]()
[![Build Status](https://img.shields.io/travis/rafamel/flowi.svg)](https://travis-ci.org/rafamel/flowi)
[![Dependencies](https://img.shields.io/david/rafamel/flowi.svg)]()
[![Issues](https://img.shields.io/github/issues/rafamel/flowi.svg)]()
[![License](https://img.shields.io/github/license/rafamel/flowi.svg)](https://github.com/rafamel/flowi/blob/master/LICENSE)

**Concatenate `Joi` validations, or custom function validations, for the same object or object key. Personalize the output error message for each of those validations.**`

*Flowi* was initially built to validate requests on Express and expose only *explicit* error messages to the user directly from the server when each validation fails.

## Install

[`npm install flowi`](https://www.npmjs.com/package/flowi)

## Usage

- Use `KeyFlow` to define the validations for objects and their keys
- Use `Flow` for all other types (strings, numbers, booleans...)

[*Check `Joi` documentation first*](https://github.com/hapijs/joi/blob/v11.1.1/API.md)

## Flow

### Usage

```javascript
const Joi = require('joi');
const { Flow } = require('flowi');

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

When `.convert()` is applied to a `flow` object, it will cast types and convert, when possible, instead of failing the validation.

```javascript
// This will effectively trim the string if it isn't
const aValidation = Flow(Joi.string().trim()).convert();
// This will trim the string but won't convert 
// to uppercase (as it only applies to `aValidation`),
// so it will fail if the string is not all in uppercase
const bValidation = Flow(aValidation).and(Joi.string().uppercase());
```

#### `flow.validate(toValidate)`

- `toValidate`: Object to apply the validation to.

Returns a an object with two keys:
- `value`: The original `toValidate` object, or casted/converted when `flow.convert()` is active.
- `error`: A [`ValidationError`](#validationerror), if any ocurred, otherwise `null`.

#### `flow.attempt(toValidate)`

Same as `flow.validate()`, but it will return the `value` if the validation is successful, or throw the `error` if any occurs.

#### `flow.validateAsync(toValidate)` & `flow.attemptAsync(toValidate)`

Same as `flow.validate()` and `flow.attempt()`, but will return a promise. Their usage it's a must if any async/promise-returning function was fed into a `flow` object as a [custom function](#custom-function);

## KeyFlow

### Usage

```javascript
const Joi = require('joi');
const { Flow, KeyFlow } = require('flowi');

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

- `validation`: Another `keyflow` or `flow` validation, `joi` validation object, [custom function](#custom-function), or schema validations. If it is a `keyflow` object and it has labels, the new object will inherit the labels.
- `message` (Optional): Message to display if validation fails. Will display `Joi` default otherwise. If there's an inner `flow` or `keyflow` validation with a message inside, the inner one will have priority.

#### `keyflow.and(validation, message)`

Append a new validation to a `keyflow` oject. Takes the same arguments as `Keyflow()`.

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
// original one (as we would via `keyflow.and()` to it directly).
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

#### `keyflow.require(keys, message)`

- `keys`: An array of keys to require.
- `message` (optional): A message to show if any of the required keys are not present.

```javascript
const validation = Keyflow({
    username: Joi.string().min(5).max(10),
    password: Joi.string().min(10).max(30),
    email: Joi.string().email()
}).require(['username', 'password']);
```

#### `keyflow.forbid(keys, message)`

- `keys`: An array of keys to forbid.
- `message` (optional): A message to show if any of the forbidden keys are present.

```javascript
const validation = Keyflow({
    username: Joi.string().min(5).max(10),
    password: Joi.string().min(10).max(30),
    email: Joi.string().email()
}).forbid(['name']);
```

#### `keyflow.convert()`

Same as `flow.convert()`. It has inner to outer precedence, meaning if an inner `flow` or `keyflow` object as conversion active, it will convert for the validations of that object - but not for the rest.

```javascript
// This will effectively trim the string if it isn't
const aValidation = Flow(Joi.string().trim()).convert();
// This will trim the string but won't convert 
// to uppercase (as it only applies to `aValidation`),
// so it will fail if the string is not all in uppercase
const bValidation = Flow(aValidation).and(Joi.string().uppercase());
```

#### `keyflow.validate(toValidate, options)`

- `toValidate`: Object to apply the validation to.
- `options` (Optional): With keys:
    - `unknown`: Determines what to do for unknown keys. Valid values are `'disallow'` and `'strip'`. By default, it ignores them. Known keys are all of those that appear in any schema fed to `Keyflow()` or `keyflow.and()`, including those within a `Joi.object()` or inside inner `keyflow`s.

Returns a an object with two keys, `value` and `error`, in the same fashion as [`flow.validate()`](flowvalidatetovalidate).

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
    { unknown: 'strip' }
); 

// This would return an object with a ValidationError in its 
//`error` key, as unknown values (`password`) are not allowed
validation.validate({ password: 'abc' }, { unknown: 'disallow' }); 
```

#### `keyflow.attempt(toValidate, options)`

Same as `keyflow.validate()`, but it will return the `value` if the validation is successful, or throw the `error` if any occurs.

#### `keyflow.validateAsync(toValidate, options)` & `keyflow.attemptAsync(toValidate, options)`

Same as `keyflow.validate()` and `keyflow.attempt()`, but will return a promise. Their usage it's a must if any async/promise-returning function was fed into any of the inner validations as a [custom function](#custom-function);

## ValidationError

### Properties

A `ValidationError` will have properties:

- `isFlowi`: Always `true`.
- `isExplicit`: `true` if the message was explicitly defined (not  generated by Joi) through a `flow` or `keyflow` object; `false` otherwise. You could use this to, for example, make only explicit messages public.
- `label`: `undefined` if the label wasn't explicitly set. This can be useful if, for example, you just want to expose `ValidationError` messages if they are explicit or are not but have a label set.
- `key`: The key the error comes from if it was part of a `keyflow` schema.
- `note`: Original `Joi` message or inner `Flowi` message, if it exists, that may have been overriden by labels or explicit `flow` or `keyflow` messages.

### `new ValidationError(message, properties)`

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

## Custom function

You can create your own validations for `flow` and `keyflow`.

- If the validation didn't pass, you must return an object with a non empty `error` key. This can be a common `Error` (which will be converted to a [`ValidationError`](#validationerror) under the hood), or a `ValidationError` itself. These would be equivalent:

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

You can always also return the value and, if we chose to, mutate it. In such case, `flow.convert()` or `keyflow.convert()` must be active (otherwise the mutated value will be ignored).

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

Remember that, regardless of whether `convert()` is active, if you use a custom function on a `keyflow` validation, you could mutate the object by mistake, instead of correctly returning a new object via `value`.

```javascript
const validation = KeyFlow(obj => {
    // Here we are mutating the object and it won't
    // wether `convert()` is active. Subsequent validations
    // will receive an object with an `username` key 
    // with value `MyUsername`
    obj.username = 'MyUsername';
});
```

Async functions are also allowed (just remember to use `validateAsync()` or `attemptAsync()`).

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
