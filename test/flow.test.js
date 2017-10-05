'use strict';
const test = require('tape-async');
const Joi = require('joi');
const { Flow, ValidationError } = require('../lib');

const ij = () => {
    let c = { i: 0, j: 0};
    return (j, msg) => {
        if (Number.isInteger(j)) c = { i: 0, j: j, msg: msg};
        else {
            c.i += 1;
            const ans = ((c.j === 0)
                ? [`[${c.i}]`, `Test ${c.i}`]
                : [`[${c.j}, ${c.i}]`, `Block ${c.j}, Test ${c.i}`]);
            return ((!c.msg)
                ? `${ans[0]} ${ans[1]}`
                : `${ans[0]} ${c.msg} (${ans[1]})`);
        }
    };
};

test('1. Flow() and new Flow() should both work', (t) => {
    const id = ij();

    {   id(1, 'Flow() shouldn\'t error out');
        let err;
        try { Flow(); } catch (e) { err = e; }
        t.equal(err, undefined, id());
    }
    {   id(2);
        t.deepEqual(Flow(), new Flow(), id());
    }

    t.end();
});

test('2. Flow() and flow.and() take (only) allowed types', (t) => {
    const id = ij();

    const shouldNotThrow = [
        Joi.string(),
        (x) => { return { error: null }; },
        Flow()
    ];
    const shouldThrow = [
        'String',
        5,
        [2, 3, 3],
        { key: 4 }
    ];

    {   id(1, 'Flow()');
        shouldNotThrow.forEach(validation => {
            const res = Flow(validation);
            t.equal(res.error, undefined, id());
        });
    }
    {   id(2, 'flow.and()');
        shouldNotThrow.forEach(validation => {
            const res = Flow().and(validation);
            t.equal(res.error, undefined, id('Flow.and()'));
        });
    }
    {   id(3, 'Flow()');
        shouldThrow.forEach(validation => {
            let errOut
            try { Flow(validation); } catch (err) { errOut = err };
            t.equal(errOut instanceof ValidationError, false, id());
        });
    }
    {   id(4, 'flow.and()');
        shouldThrow.forEach(validation => {
            let errOut
            try { Flow.and(validation); } catch (err) { errOut = err };
            t.equal(errOut instanceof ValidationError, false, id());
        });
    }

    t.end();
});

test('3. flow.and() adds validations', (t) => {
    const id = ij();

    const arr = [
        Joi.string(),
        (x) => { return { error: null }; },
        Flow()
    ];
    const flowEl = Flow(arr[0]).and(arr[1]).and(arr[2]);

    t.deepEqual(flowEl.stack[0].validation, arr[0], id());
    t.deepEqual(flowEl.stack[1].validation, arr[1], id());
    t.deepEqual(flowEl.stack[2].validation, arr[2], id());
    t.end();
});

test('4. Flow, Validate & Attempt, Basic Pass/Not pass', (t) => {
    const vals = [
        { validation: Flow(Joi.string()),
            name: 'Joi' },
        { validation: Flow(Flow(Flow(Joi.string()))),
            name: 'Joi on Flow' },
        { validation: Flow(x => {
                if (typeof x === 'string') return { error: null, value: x};
                return { error: new ValidationError(), value: x };
            }),
            name: 'Function' },
    ];

    let now = 'flow.validate()';
    vals.forEach(({ validation: val, name }) => {
        const noErrors = val.validate('some');
        const itErrors = val.validate(5);
        t.equal(noErrors.value, 'some', `${now}, ${name}, Pass, Should have value`);
        t.equal(noErrors.error, null, `${now}, ${name}, Pass, Should have null error`);
        t.equal(itErrors.value, 5, `${now}, ${name}, Not Pass, Should have value`);
        t.not(itErrors.error, null, `${now}, ${name}, Not pass, error should not be null`);
        t.equal(itErrors.error instanceof ValidationError, true, `${now}, ${name}, Not pass, error should be ValidationError`);
    });

    now = 'flow.attempt()';
    vals.forEach(({ validation: val, name }) => {
        let noErrors, itErrors;
        try { noErrors = val.attempt('some'); }
        catch (err) { noErrors = err }
        try { itErrors = val.attempt(5); }
        catch (err) { itErrors = err }

        t.equal(noErrors, 'some', name + ', Pass');
        t.equal(itErrors instanceof ValidationError, true, name + ', Not pass, error should be ValidationError');
    });

    t.end();
});

test('5. flow.validate(), Function', (t) => {
    const id = ij();

    {   id(1, 'Empty return function');
        const val = Flow(x => { return; } );
        t.equal(val.validate(0).error, null, id());
        t.equal(val.validate(0).value, 0, id());
    }
    {   id(2, 'Error to Validation error');
        const val = Flow(x => { return { error: new Error()}; } );
        t.equal(val.validate(0).error instanceof ValidationError, true, id());
    }

    t.end();
});

test('6. flow.validate(), Concatenation', (t) => {
    const id = ij();

    const val = Flow()
        .and(Joi.string().min(4))
        .and(x => {
            if (x.length > 6) return { error: new Error() };
        })
        .and(
            Joi.string().lowercase()
        );

    t.equal(val.validate(5).error instanceof ValidationError, true, id());
    t.equal(val.validate('123').error instanceof ValidationError, true, id());
    t.equal(val.validate('1234567').error instanceof ValidationError, true, id());
    t.equal(val.validate('ASDFG').error instanceof ValidationError, true, id());
    t.equal(!val.validate('asdfg').error, true, id());

    t.end();
});

test('7. flow.validate(), Label & Error', (t) => {
    const id = ij();

    const getErr = (err) => {
        if (!err) return;
        else return err.message.split(' ')[0];
    };

    let val = Flow(Joi.string().label('User')).and(Joi.string().max(5));

    {   id(1) // Block #
        // Inherit labels from Joi object
        const res = val.validate(5);

        t.equal(getErr(res.error), 'User', id());
        t.equal(res.error.label, 'User', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(2) // Block #
        const res = val.validate('123456')

        t.not(getErr(res.error), 'User', id());
        t.equal(res.error.label, undefined, id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(3) // Block #
        // Not inherit label from inner Joi object to new Flow validation from Flow object
        const val2 = Flow(val).and(Joi.string().max(6));
        const res = val2.validate('12345678');

        t.not(getErr(res.error), 'User', id());
        t.equal(res.error.label, undefined, id());
        t.equal(res.error.isExplicit, false, id());
    }

    val = Flow(Joi.string().label('User')).label('Pass');
    {   id(4) // Block #
        // Inner Joi object label has precedence over outer Flow label
        const res = val.validate(5);

        t.equal(getErr(res.error), 'User', id());
        t.equal(res.error.label, 'User', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(5) // Block #
        // Inherit flow label on new Flow validation from Flow object
        const val2 = Flow(val).and(Joi.string().max(6));
        const res = val2.validate('12345678');

        t.equal(getErr(res.error), 'Pass', id());
        t.equal(res.error.label, 'Pass', id());
        t.equal(res.error.isExplicit, false, id());
    }

    val = Flow(Flow(Flow(Joi.number().min(5)))).label('Outer');
    {   id(6) // Block #
        // Outer label to inner error
        const res = val.validate(4);

        t.equal(getErr(res.error), 'Outer', id());
        t.equal(res.error.label, 'Outer', id());
        t.equal(res.error.isExplicit, false, id());
    }

    t.end();
});

test('8. flow.validate(), Label, Error, Error message', (t) => {
    const id = ij();

    let val = Flow(Joi.string().label('User'), 'Some error');

    {   id(1);
        const msg = 'Base error message';
        const res = val.validate(5).error;

        t.equal(res.message, 'Some error', id(msg));
        t.equal(res.label, 'User', id(msg));
        t.equal(res.isExplicit, true, id(msg));
    }

    val = Flow(val).and(Joi.string().max(2));

    {   id(2);
        const msg = 'Inherits error message';
        const res = val.validate(5).error;

        t.equal(res.message, 'Some error', id(msg));
        t.equal(res.label, 'User', id(msg));
        t.equal(res.isExplicit, true, id(msg));
    }
    {   id(3);
        const msg = 'Msg not inherited for separate validation, not inherited label from joi';
        const res = val.validate('1234').error;

        t.not(res.message, 'Some error', id(msg));
        t.not(res.label, 'User', id(msg));
        t.equal(res.isExplicit, false, id(msg));
    }

    val = Flow(Flow(Joi.string(), 'Some error').label('User'))
    .and(Joi.string().max(2));

    {   id(4);
        const msg = 'Msg not inherited for separate validation, inherited label from flow';
        const res = val.validate('1234').error;
        t.not(res.message, 'Some error', id(msg));
        t.equal(res.label, 'User', id(msg));
        t.equal(res.isExplicit, false, id(msg));

    }

    val = Flow(Flow(Flow(Joi.string(), 'Some error').label('User'))
    .and(Joi.string().max(2)), 'Other error');

    {   id(5);
        const res = val.validate(5).error;
        t.equal(res.message, 'Some error', id());
        t.equal(res.label, 'User', id());
        t.equal(res.isExplicit, true, id());
    }
    {   id(6);
        const res = val.validate('1234').error;
        t.equal(res.message, 'Other error', id());
        t.equal(res.label, 'User', id());
        t.equal(res.isExplicit, true, id());
    }

    t.end();
});

test('9. flow.validate(), flow.convert()', (t) => {
    const id = ij();

    {   id(1, 'Joi convert, pass');
        const test = Flow(Joi.string().lowercase()).convert().validate('AAA');

        t.equal(test.value, 'aaa', id());
        t.equal(test.error, null, id());
    }
    {   id(2, 'Joi convert, not pass');
        const test = Flow(Joi.string().lowercase().min(6)).convert().validate('AAA');

        t.equal(test.value, 'aaa', id());
        t.not(test.error, null, id());
    }
    {
        id(3, 'Joi not convert, not pass');
        const test = Flow(Joi.string().lowercase()).validate('AAA');

        t.equal(test.value, 'AAA', id());
        t.not(test.error, null, id());
    }
    {   id(4, 'Function convert, not pass');
        const test = Flow((x) => { return { error: Error(), value: 25}; }).convert().validate('AAA');

        t.equal(test.value, 25, id());
    }
    {   id(5, 'Function not convert, not pass');
        const test = Flow((x) => { return { error: Error(), value: 25}; }).validate('AAA');

        t.equal(test.value, 'AAA', id());
    }
    {   id(6, 'Concatenation convert');
        const test = Flow()
            .and(Joi.string().lowercase())
            .and(x => { return { error: null, value: x.toUpperCase().slice(3) }; })
            .and(Joi.string().trim().max(2))
            .convert()
            .validate(' AAAA ');

        t.equal(test.value, 'AA', id());
        t.equal(test.error, null, id());
    }
    {   id(7, 'Concatenation, Mixed convert (1)')
        const test = Flow()
            .and(Flow(Joi.string().lowercase()).convert(false))
            .convert()
            .validate(' AAAA ');

        t.not(test.error, null, id());
    }
    {   id(8, 'Concatenation, Mixed convert (2)');
        const test = Flow()
            .and(Flow(Joi.string().lowercase()).convert(true))
            .convert(false)
            .validate(' AAAA ');
        t.equal(test.error, null, id());
    }
    {   id(9, 'Concatenation, Mixed convert (3)');
        const test = Flow()
            .and(Flow(Joi.string().lowercase()).convert(true))
            .and(Joi.string().trim())
            .validate(' AAAA ');

        t.not(test.error, null, id());
    }

    t.end();
});

test('10. Async Flow', async (t) => {
    const id = ij();

    {   id(1, 'Sync doesn\'t take async functions');
        let err;
        try { Flow().and(async (x) => { return; }).validate(12) }
        catch (e) { err = e; }

        t.equal(err.message, 'Use the Async validation functions when using any async function', id());
    }
    {   id(2, 'flow.validateAsync(), empty return');
        const val = Flow()
            .and(async (x) => { return; })
            .and(Joi.string().max(2))
        const ans1 = await val.validateAsync('12');
        const ans2 = await val.validateAsync('1234');

        t.equal(ans1.error, null, id());
        t.equal(ans1.value, '12', id());
        t.not(ans2.error, null, id());
        t.equal(ans2.value, '1234', id());
    }
    {   id(3, 'flow.validateAsync(), value change, no convert');
        const val = Flow()
            .and(async (x) => { return { value: '555' }; })
            .and(Joi.string().max(2))
        const ans = await val.validateAsync('12');

        t.equal(ans.error, null, id());
        t.equal(ans.value, '12', id());
    }
    {   id(4, 'flow.validateAsync(), value change, convert');
        const val = Flow()
            .and(async (x) => { return { value: '555' }; })
            .and(Joi.string().max(2))
            .convert()
        const ans = await val.validateAsync('12');
        t.not(ans.error, null, id());
        t.equal(ans.value, '555', id());
    }

    t.end();
});
