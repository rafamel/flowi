'use strict';
const test = require('tape-async');
const Joi = require('joi');
const { Flow, KeyFlow, ValidationError } = require('../lib');

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

test('1. KeyFlow() and new KeyFlow() should both work', (t) => {
    const id = ij();

    let err;
    try { KeyFlow(); } catch (e) { err = e; }

    t.equal(err, undefined, id());
    t.deepEqual(KeyFlow(), new KeyFlow(), id());

    t.end();
});

test('2. KeyFlow() and keyflow.and() take (only) allowed types', (t) => {

    let err1;
    try {
        KeyFlow().and({
            a: Joi.string(),
            b: Flow(Joi.string()),
            c: () => { return; },
            d: KeyFlow({
                e: Joi.string()
            })
        }).and(Joi.object()).and(KeyFlow(Joi.object()));
    } catch (e) { err1 = e; }
    t.equal(err1, undefined, 'Should take valid types');

    let err2;
    try {
        KeyFlow().and({
            c: {
                i: Joi.string
            }
        })
    } catch (e) { err2 = e; }
    t.not(err2, undefined, 'Should not take objects inside keys');

    let err3;
    try {
        KeyFlow({
            a: 'string'
        })
    } catch (e) { err3 = e; }
    t.not(err3, undefined, 'Should not take non-validations');

    t.end();
});

test('3. Keyflow, Validate, Pass/Not pass', (t) => {
    const id = ij();

    let val = KeyFlow({
        a: Joi.string().max(6),
        b: Flow(Joi.number().min(4)),
        c: (x) => {
            if (typeof x !== 'boolean') {
                return { error: new ValidationError('C is not a Boolean') };
            }
        }
    })

    {   id(1);
        const toVal = { a: '1234', b: 6, c: true };
        const { a, b, c } = toVal;
        const res = val.validate(toVal);

        t.deepEqual(res.value, { a: a, b: b, c: c }, id());
        t.equal(res.error, null, id());
    }
    {   id(2);
        const toVal = { a: '1234567' };
        const res = val.validate(toVal);
        t.deepEqual(res.value, { a: '1234567' }, id());
        t.not(res.error, null, id());
    }
    {   id(3);
        const toVal = { b: 2 };
        const res = val.validate(toVal);

        t.deepEqual(res.value, { b: 2 }, id());
        t.not(res.error, null, id());
    }
    {   id(4);
        const toVal = { c: 'true' };
        const res = val.validate(toVal);

        t.deepEqual(res.value, { c: 'true' }, id());
        t.not(res.error, null, id());
    }
    {   id(5);
        const toVal = { a: 'string', b: 6, c: true };
        const { a, b, c } = toVal;
        const val2 = KeyFlow(val).and(Joi.object({ c: Joi.any() }).requiredKeys(['c']));
        const res = val2.validate(toVal);

        t.deepEqual(res.value, { a: a, b: b, c: c }, id());
        t.equal(res.error, null, id());
    }
    {   id(6);
        const toVal = { a: 'string', b: 6, c: true };
        const { a, b, c } = toVal;
        const val2 = KeyFlow(val).and(Joi.object({ d: Joi.any() }).requiredKeys(['d']));
        const res = val2.validate(toVal);

        t.deepEqual(res.value, { a: a, b: b, c: c }, id());
        t.not(res.error, null, id());
    }

    t.end();
});

test('4. flow.validate(), Function', (t) => {
    const id = ij();

    {   id(1, 'Empty return function validation returns value and null error')
        const val = KeyFlow(x => { return; } );
        t.equal(val.validate({}).error, null, id());
        t.deepEqual(val.validate({}).value, {}, id());
    }
    {   id(2, 'Error to Validation error')
        const val2 = KeyFlow(x => { return { error: new Error()}; } );
        t.equal(val2.validate({}).error instanceof ValidationError, true, id());
    }

    t.end();
});

test('5. flow.validate(), Concatenation', (t) => {
    const id = ij();
    const val = KeyFlow({
        a: Joi.string().max(6)
    }).and({
        b: Joi.number().min(2)
    });

    t.equal(val.validate({ a: '123456', b: 2 }).error, null, id());
    t.not(val.validate({ a: '123456', b: 1 }).error, null, id());

    t.end();
});


test('6. Private keyflow._knownKeys()', (t) => {
    const val = KeyFlow({
        a: Joi.string(),
        b: Joi.number(),
        c: Joi.object({
            d: Joi.string(),
            e: Joi.number()
        })
    }).and(KeyFlow(KeyFlow({
        f: Joi.string(),
        g: Joi.number(),
        h: KeyFlow(Joi.object({
            i: Joi.string(),
            j: Joi.number()
        }))
    }))).and(Joi.object({
        k: Joi.string(),
        l: Joi.string(),
        m: Joi.object({
            n: Joi.string(),
            o: Joi.number()
        })
    })).and(KeyFlow(Joi.object({
        p: Joi.string(),
        q: Joi.string(),
        r: Joi.object({
            s: Joi.string(),
            t: Joi.number()
        })
    }))).and(x => { return; });

    const res = ['a', 'b', 'c', 'f', 'g', 'h', 'k', 'l', 'm', 'p', 'q', 'r'];
    t.deepEqual(val._knownKeys().sort(), res);
    t.end();
});


test('7. keyflow.validate() unknown', (t) => {
    const id = ij();
    const val = KeyFlow({ a: Joi.number() }).and({ b: Joi.number() });

    {   id(1);
        const res = val.validate({ a: 1, b: 2, c: 3, d: 4 });
        t.deepEqual(res.value, { a: 1, b: 2, c: 3, d: 4 }, id());
        t.equal(res.error, null, id());
    }
    {   id(2);
        const res = val.validate({ a: 1, b: 2, c: 3, d: 4 }, { unknown: 'strip' });
        t.deepEqual(res.value, { a: 1, b: 2 }, id());
        t.equal(res.error, null, id());
    }
    {   id(3);
        const res = val.validate({ a: 1, b: 2, c: 3, d: 4 }, { unknown: 'disallow' });
        t.deepEqual(res.value, { a: 1, b: 2, c: 3, d: 4 }, id());
        t.not(res.error, null, id());
    }

    t.end();
});

test('8. flow.validate(), Label, Key, & Error', (t) => {
    const id = ij();
    const getErr = (err) => {
        if (!err) return;
        else return err.message.split(' ')[0];
    };

    const val = KeyFlow({
        a: Flow(Joi.number().min(10)).label('labelA').and(Joi.number().max(15)),
        b: Joi.number().max(10).label('labelB'),
        d: Flow(Flow(Joi.number().min(5)))
    }).and({
        a: Flow(Flow(Joi.number().max(12))),
        b: Joi.number().min(5)
    }).and({
        c: Joi.number().min(10)
    }).labels({ a: 'labelA2', b: 'labelB2', c: 'labelC' })

    {   id(1)
        const res = val.validate({ a: 16 });

        t.equal(getErr(res.error), 'labelA', id());
        t.equal(res.error.label, 'labelA', id());
        t.equal(res.error.key, 'a', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(2)
        const res = val.validate({ a: 13 });

        t.equal(getErr(res.error), 'labelA2', id());
        t.equal(res.error.label, 'labelA2', id());
        t.equal(res.error.key, 'a', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(3)
        const res = val.validate({ b: 11 });

        t.equal(getErr(res.error), 'labelB', id());
        t.equal(res.error.label, 'labelB', id());
        t.equal(res.error.key, 'b', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(4)
        const res = val.validate({ b: 4 });

        t.equal(getErr(res.error), 'labelB2', id());
        t.equal(res.error.label, 'labelB2', id());
        t.equal(res.error.key, 'b', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(5)
        const res = val.validate({ c: 5 });

        t.equal(getErr(res.error), 'labelC', id());
        t.equal(res.error.label, 'labelC', id());
        t.equal(res.error.key, 'c', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(6)
        const res = val.validate({ d: 4 });

        t.equal(getErr(res.error), 'd', id());
        t.equal(res.error.label, undefined, id());
        t.equal(res.error.key, 'd', id());
        t.equal(res.error.isExplicit, false, id());
    }
    {   id(7)
        // Inheritance
        const val2 = KeyFlow(val).and({ c: Joi.number().max(20) });
        const res = val2.validate({ c: 21 });

        t.equal(getErr(res.error), 'labelC', id());
        t.equal(res.error.label, 'labelC', id());
        t.equal(res.error.key, 'c', id());
        t.equal(res.error.isExplicit, false, id());
    }

    t.end();
});

test('9. keyflow.validate(), Error message', (t) => {
    const id = ij();

    let val = KeyFlow(
        KeyFlow({
            a: Flow(Joi.number().max(5), 'Error A'),
            b: Joi.number().max(5)
        }, 'Some message').and({ c: Joi.number().max(5) }),
        'Outer message'
    );

    let res = val.validate({ a: 6 });
    t.equal(res.error.message, 'Error A', id());

    res = val.validate({ b: 6 });
    t.equal(res.error.message, 'Some message', id());

    res = val.validate({ c: 6 });
    t.equal(res.error.message, 'Outer message', id());

    t.end();
});

test('10. keyflow.validate(), keyflow.convert()', (t) => {
    const id = ij();

    const val = KeyFlow(obj => {
        return { value: { a: 'hello' }, error: null };
    }).and({
        a: Joi.string().uppercase()
    });

    {   id(1);
        const res = val.validate({ a: 'ABCD' });

        t.equal(res.value.a, 'ABCD', id());
        t.equal(res.error, null, id());
    }
    {   id(2);
        const res = val.convert().validate({ a: 'ABCD' });

        t.equal(res.value.a, 'HELLO', id());
        t.equal(res.error, null, id());
    }

    t.end();
});

test('11. keyflow.require()', (t) => {
    const id = ij();

    {   id(1);
        const val = KeyFlow().require(['a', 'b', 'c']);

        t.not(val.validate({}).error, null, id());
        t.equal(val.validate({ a: 1, b: 2, c: 3 }).error, null, id());
    }
    {   id(2);
        const val = KeyFlow().require(['a']);

        t.equal(val.validate({}).error.message, 'a is required', id());
        val.labels({ a: 'labelA' });
        t.equal(val.validate({}).error.message, 'labelA is required', id());
    }
    {   id(3);
        const val = KeyFlow().require(['a'], 'Message');
        t.equal(val.validate({}).error.message, 'Message', id());
    }

    t.end();
});

test('12. keyflow.forbid()', (t) => {
    const id = ij();

    {   id(1);
        const val = KeyFlow().forbid(['a', 'b', 'c']);

        t.equal(val.validate({ d: 1 }).error, null, id());
        t.equal(val.validate({ b: 2 }).error.message, 'b is forbidden', id());
    }
    {   id(2);
        const val = KeyFlow().forbid(['a', 'b', 'c']);

        t.equal(val.validate({}).error, null, id());
        t.equal(val.validate({ b: 2 }).error.message, 'b is forbidden', id());
        val.labels({ b: 'labelB' });
        t.equal(val.validate({ b: 2 }).error.message, 'labelB is forbidden', id());
    }
    {   id(3);
        const val = KeyFlow({
            a: Joi.number().min(10)
        }).forbid(['a'], 'Message');

        t.equal(val.validate({ a: 1 }).error.message, 'Message', id());
    }

    t.end();
});
