'use strict';
const { Joi, Flow, KeyFlow, ValidationError } = require('../lib');

const id = (n) => `[${ String(n) }] `;

describe(`- KeyFlow() and new KeyFlow() should both work`, () => {
    test(id(1) + `KeyFlow() shouldn't error out`, () => {
        expect(() => { KeyFlow(); }).not.toThrowError();
    });
    test(id(2) + `KeyFlow() and new KeyFlow() should be deep equal`, () => {
        expect(KeyFlow()).toEqual(new KeyFlow());
    });
});

describe(`- KeyFlow() and keyflow.and() take (only) allowed types`, () => {
    test(id(1) + `Should take valid types`, () => {
        const error = () => {
            KeyFlow()
                .and({
                    a: Joi.string(),
                    b: Flow(Joi.string()),
                    c: () => { },
                    d: KeyFlow({
                        e: Joi.string()
                    })
                })
                .and(Joi.object())
                .and(KeyFlow(Joi.object()));
        };

        expect(error).not.toThrowError();
    });
    test(id(2) + `Should not take objects inside keys`, () => {
        const error = () => {
            KeyFlow().and({
                c: {
                    i: Joi.string
                }
            });
        };

        expect(error).toThrowError();
    });
    test(id(3) + `Should not take non-validations`, () => {
        const error = () => {
            KeyFlow({
                a: 'string'
            });
        };

        expect(error).toThrowError();
    });
});

describe(`- keyflow.validate()`, () => {
    test(id(1) + `Doesn't error out with an empty stack`, () => {
        const error = () => { KeyFlow().validate({ a: 1, b: 2 }); };

        expect(error).not.toThrowError();
    });

    describe(`- Basic Pass/Not pass`, () => {
        const val = KeyFlow({
            a: Joi.string().max(6),
            b: Flow(Joi.number().min(4)),
            c: (x) => {
                if (typeof x !== 'boolean') {
                    return { error: new ValidationError('C is not a Boolean') };
                }
            }
        });

        test(id(1), () => {
            const toVal = { a: '1234', b: 6, c: true };
            const { a, b, c } = toVal;
            const res = val.validate(toVal);

            expect(res.value).toEqual({ a: a, b: b, c: c });
            expect(res.error).toBe(null);
        });
        test(id(2), () => {
            const toVal = { a: '1234567' };
            const res = val.validate(toVal);

            expect(res.value).toEqual({ a: '1234567' });
            expect(res.error).toBeInstanceOf(ValidationError);
        });
        test(id(3), () => {
            const toVal = { b: 2 };
            const res = val.validate(toVal);

            expect(res.value).toEqual({ b: 2 });
            expect(res.error).toBeInstanceOf(ValidationError);
        });
        test(id(4), () => {
            const toVal = { c: 'true' };
            const res = val.validate(toVal);

            expect(res.value).toEqual({ c: 'true' });
            expect(res.error).toBeInstanceOf(ValidationError);
        });
        test(id(5), () => {
            const toVal = { a: 'string', b: 6, c: true };
            const { a, b, c } = toVal;
            const res = KeyFlow()
                .and(val)
                .and(Joi.object({ c: Joi.any() }).requiredKeys(['c']))
                .validate(toVal);

            expect(res.value).toEqual({ a: a, b: b, c: c });
            expect(res.error).toBe(null);
        });
        test(id(6), () => {
            const toVal = { a: 'string', b: 6, c: true };
            const { a, b, c } = toVal;
            const res = KeyFlow()
                .and(val)
                .and(Joi.object({ d: Joi.any() }).requiredKeys(['d']))
                .validate(toVal);

            expect(res.value).toEqual({ a: a, b: b, c: c });
            expect(res.error).toBeInstanceOf(ValidationError);
        });
    });

    describe(`- Functions`, () => {
        test(id(1) + `Empty return function validation returns value and null error`, () => {
            const res = KeyFlow(x => { })
                .validate({});

            expect(res.error).toBe(null);
            expect(res.value).toEqual({});
        });
        test(id(2) + `Error to Validation error`, () => {
            const res = KeyFlow(x => { return { error: new Error() }; }).validate({});

            expect(res.error).toBeInstanceOf(ValidationError);
        });
    });
});

describe(`- Concatenation`, () => {
    test(id(1), () => {
        const val = KeyFlow({
            a: Joi.string().max(6)
        }).and({
            b: Joi.number().min(2)
        });

        expect(val.validate({ a: '123456', b: 2 }).error).toBe(null);
        expect(val.validate({ a: '123456', b: 1 }).error).toBeInstanceOf(ValidationError);
    });
});

describe(`- keyflow.keys and keyflow._knownKeys`, () => {
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
    }))).and(x => { });

    test(id(1) + `Basic test`, () => {
        const res = ['a', 'b', 'c', 'f', 'g', 'h', 'k', 'l', 'm', 'p', 'q', 'r'];

        expect(val._knownKeys.sort()).toEqual(res);
        expect(val.keys.sort()).toEqual(res);
    });
    test(id(2) + `keyflow.use()`, () => {
        val.use(['a', 'b', 'c']);
        expect(val.keys.sort()).toEqual(['a', 'b', 'c']);
    });
});

describe(`- keyflow.validate() strip`, () => {
    const val = KeyFlow({ a: Joi.number() }).and({ b: Joi.number() });

    test(id(1) + `Doesn't strip when not passing a strip value`, () => {
        const res = val.validate({ a: 1, b: 2, c: 3, d: 4 });

        expect(res.value).toEqual({ a: 1, b: 2, c: 3, d: 4 });
        expect(res.error).toBe(null);
    });
    test(id(2) + `Doesn't strip when not passing strip: false`, () => {
        const res = val.validate({ a: 1, b: 2, c: 3, d: 4 }, { strip: false });

        expect(res.value).toEqual({ a: 1, b: 2, c: 3, d: 4 });
        expect(res.error).toBe(null);
    });
    test(id(3) + `Strips when not passing strip: true`, () => {
        const res = val.validate({ a: 1, b: 2, c: 3, d: 4 }, { strip: true });

        expect(res.value).toEqual({ a: 1, b: 2 });
        expect(res.error).toBe(null);
    });
});

describe(`- Label, Key, & Error`, () => {
    describe(`- Label & Key`, () => {
        const msgLabel = (err) => err.message.split(' ')[0];
        const val = KeyFlow({
            a: Flow(Joi.number().min(10)).label('labelA').and(Joi.number().max(15)),
            b: Joi.number().max(10).label('labelB'),
            d: Flow(Flow(Joi.number().min(5)))
        }).and({
            a: Flow(Flow(Joi.number().max(12))),
            b: Joi.number().min(5)
        }).and({
            c: Joi.number().min(10)
        }).labels({ a: 'labelA2', b: 'labelB2', c: 'labelC' });

        test(id(1), () => {
            const error = val.validate({ a: 16 }).error;

            expect(msgLabel(error)).toBe('labelA');
            expect(error.label).toBe('labelA');
            expect(error.key).toBe('a');
            expect(error.isExplicit).toBe(false);
        });
        test(id(2), () => {
            const error = val.validate({ a: 13 }).error;

            expect(msgLabel(error)).toBe('labelA2');
            expect(error.label).toBe('labelA2');
            expect(error.key).toBe('a');
            expect(error.isExplicit).toBe(false);
        });
        test(id(3), () => {
            const error = val.validate({ b: 11 }).error;

            expect(msgLabel(error)).toBe('labelB');
            expect(error.label).toBe('labelB');
            expect(error.key).toBe('b');
            expect(error.isExplicit).toBe(false);
        });
        test(id(4), () => {
            const error = val.validate({ b: 4 }).error;

            expect(msgLabel(error)).toBe('labelB2');
            expect(error.label).toBe('labelB2');
            expect(error.key).toBe('b');
            expect(error.isExplicit).toBe(false);
        });
        test(id(5), () => {
            const error = val.validate({ c: 5 }).error;

            expect(msgLabel(error)).toBe('labelC');
            expect(error.label).toBe('labelC');
            expect(error.key).toBe('c');
            expect(error.isExplicit).toBe(false);
        });
        test(id(6), () => {
            const error = val.validate({ d: 4 }).error;

            expect(msgLabel(error)).toBe('d');
            expect(error.label).toBe(undefined);
            expect(error.key).toBe('d');
            expect(error.isExplicit).toBe(false);
        });
        test(id(7) + `Inheritance`, () => {
            const error = KeyFlow()
                .and(val)
                .and({ c: Joi.number().max(20) })
                .validate({ c: 21 })
                .error;

            expect(msgLabel(error)).toBe('labelC');
            expect(error.label).toBe('labelC');
            expect(error.key).toBe('c');
            expect(error.isExplicit).toBe(false);
        });
    });

    describe(`- Error Message`, () => {
        const val = KeyFlow(
            KeyFlow({
                a: Flow(Joi.number().max(5), 'Error A'),
                b: Joi.number().max(5)
            }, 'Some message').and({ c: Joi.number().max(5) }),
            'Outer message'
        );

        test(id(1), () => {
            expect(val.validate({ a: 6 }).error.message).toBe('Error A');
        });
        test(id(2), () => {
            expect(val.validate({ b: 6 }).error.message).toBe('Some message');
        });
        test(id(3), () => {
            expect(val.validate({ c: 6 }).error.message).toBe('Outer message');
        });
    });
});

describe(`- keyflow.convert()`, () => {
    test(id(1), () => {
        const res = KeyFlow()
            .and({
                a: Flow(Joi.string().uppercase()).convert()
            })
            .validate({ a: 'abcd' });

        expect(res.value.a).toBe('ABCD');
        expect(res.error).toBe(null);
    });
    test(id(2), () => {
        const res = KeyFlow()
            .and(obj => {
                return { value: { a: 'hello' }, error: null };
            }).and({
                a: Joi.string().uppercase()
            })
            .validate({ a: 'ABCD' });

        expect(res.value.a).toBe('ABCD');
        expect(res.error).toBe(null);
    });
    test(id(3), () => {
        const res = KeyFlow()
            .and(obj => {
                return { value: { a: 'hello' }, error: null };
            })
            .and({
                a: Flow(Joi.string().uppercase()).convert()
            })
            .convert()
            .validate({ a: 'ABCD' });

        expect(res.value.a).toBe('HELLO');
        expect(res.error).toBe(null);
    });
    test(id(4), () => {
        const res = KeyFlow()
            .and(obj => {
                return { value: { a: 'hello' }, error: null };
            })
            .and({
                a: Joi.string().uppercase()
            })
            .convert()
            .validate({ a: 'ABCD' });

        expect(res.value.a).toBe('HELLO');
        expect(res.error).toBe(null);
    });
    test(id(5), () => {
        const res = KeyFlow()
            .and(KeyFlow({
                a: Joi.string().uppercase()
            }))
            .convert()
            .validate({ a: 'abcd' });

        expect(res.value.a).toBe('abcd');
        expect(res.error).toBeInstanceOf(ValidationError);
    });
    test(id(6), () => {
        const res = KeyFlow()
            .and(KeyFlow({
                a: Joi.string().uppercase()
            }).convert())
            .validate({ a: 'abcd' });

        expect(res.value.a).toBe('ABCD');
        expect(res.error).toBe(null);
    });
});

describe(`- Require & Forbid`, () => {
    describe(`- keyflow.require()`, () => {
        test(id(1), () => {
            const val = KeyFlow().require(['a', 'b', 'c']);

            expect(val.validate({}).error).toBeInstanceOf(ValidationError);
            expect(val.validate({ a: 1, b: 2, c: 3 }).error).toBe(null);
        });
        test(id(2), () => {
            const val = KeyFlow().require(['a']);
            expect(val.validate({}).error.message).toBe('a is required');

            val.labels({ a: 'labelA' });
            expect(val.validate({}).error.message).toBe('labelA is required');
        });
        test(id(3), () => {
            const val = KeyFlow({ a: Joi.number(), b: Joi.number() }).require();
            expect(val.validate({ b: 1 }).error).toBeInstanceOf(ValidationError);

            val.require(false);
            expect(val.validate({}).error).toBe(null);
        });
    });

    describe(`- keyflow.forbid()`, () => {
        test(id(1), () => {
            const val = KeyFlow().forbid(['a', 'b', 'c']);

            expect(val.validate({ d: 1 }).error).toBe(null);
            expect(val.validate({}).error).toBe(null);
            expect(val.validate({ b: 2 }).error.message).toBe('b is forbidden');

            val.labels({ b: 'labelB' });
            expect(val.validate({ b: 2 }).error.message).toBe('labelB is forbidden');
        });
        test(id(2), () => {
            const val = KeyFlow({ a: Joi.number() }).forbid();

            expect(val.validate({ b: 1 }).error).toBeInstanceOf(ValidationError);

            val.forbid(false);
            expect(val.validate({ b: 1 }).error).toBe(null);
        });
    });
});

describe(`- keyflow.use()`, () => {
    const val = KeyFlow(
        KeyFlow({
            a: Joi.number().max(5),
            b: Joi.number().max(5),
            c: Joi.number().max(5),
            d: Joi.number().max(5)
        }).labels({ c: 'labelC' }).use(['a', 'b'])
    );
    const valForbidden = KeyFlow(val).forbid();

    test(id(1), () => {
        expect(val.validate({ a: 1, b: 2, c: 6 }).error).toBe(null);
    });
    test(id(2), () => {
        const error = valForbidden.validate({ c: 1 }).error;

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('labelC is forbidden');
        expect(error.label).toBe('labelC');
        expect(error.isExplicit).toBe(false);
    });
    test(id(3), () => {
        const error = valForbidden.validate({ d: 1 }).error;

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('d is forbidden');
        expect(error.label).toBe(undefined);
        expect(error.isExplicit).toBe(false);
    });
});
