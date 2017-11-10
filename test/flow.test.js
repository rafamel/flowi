'use strict';
const { Joi, Flow, ValidationError } = require('../lib');

const id = (n) => `[${ String(n) }] `;

describe(`- Flow() and new Flow() should both work`, () => {
    test(id(1) + `Flow() shouldn't error out`, () => {
        expect(() => { Flow(); }).not.toThrowError();
    });
    test(id(2) + `Flow() and new Flow() should be deep equal`, () => {
        expect(Flow()).toEqual(new Flow());
    });
});

describe(`- Flow() and flow.and() take (only) allowed types`, () => {
    test(id(1) + `Should not throw`, () => {
        const shouldNotThrow = [
            Joi.string(),
            (x) => { return { error: null }; },
            Flow()
        ];
        shouldNotThrow.forEach(validation => {
            expect(Flow(validation).error).toBe(undefined);
            expect(Flow().and(validation).error).toBe(undefined);
        });
    });
    test(id(2) + `Should throw`, () => {
        const shouldThrow = [
            'String',
            5,
            [2, 3, 3],
            { key: 4 }
        ];
        shouldThrow.forEach(validation => {
            const vals = [
                () => { Flow(validation); },
                () => { Flow().and(validation); }
            ];
            vals.forEach(val => {
                expect(val).toThrowError('No valid Joi, Flowi validation, or function was provided.');
                expect(val).not.toThrowError(ValidationError);
            });
        });
    });
});

describe(`- flow.and()`, () => {
    test(id(1) + `adds validations`, () => {
        const arr = [
            Joi.string(),
            (x) => { return { error: null }; },
            Flow()
        ];
        const flowEl = Flow(arr[0]).and(arr[1]).and(arr[2]);

        expect(flowEl.stack[0].validation).toEqual(arr[0]);
        expect(flowEl.stack[1].validation).toEqual(arr[1]);
        expect(flowEl.stack[2].validation).toEqual(arr[2]);
    });
});

describe(`- flow.validate()`, () => {
    describe(`- Empty stack`, () => {
        test(id(1) + `doesn't error out`, () => {
            expect(() => { Flow().validate('string'); })
                .not.toThrowError();
        });
    });

    describe(`- Basic pass`, () => {
        const vals = [
            Flow(Joi.string()),
            Flow(Flow(Flow(Joi.string()))),
            Flow(x => {
                if (typeof x === 'string') return { error: null, value: x };
                return { error: new ValidationError(), value: x };
            })
        ];
        test(id(1) + `flow.validate()`, () => {
            vals.forEach((validation) => {
                const noErrors = validation.validate('some');
                const itErrors = validation.validate(5);
                expect(noErrors.value).toBe('some');
                expect(noErrors.error).toBe(null);
                expect(itErrors.value).toBe(5);
                expect(itErrors.error).toBeInstanceOf(ValidationError);
            });
        });
        test(id(2) + `flow.attempt()`, () => {
            vals.forEach((validation) => {
                const noErrors = () => { validation.attempt('some'); };
                const itErrors = () => { validation.attempt(5); };
                expect(noErrors).not.toThrowError();
                expect(itErrors).toThrowError(ValidationError);
            });
        });
    });

    describe(`- Functions`, () => {
        test(id(1) + `Empty return function`, () => {
            const val = Flow(x => { }).validate(0);

            expect(val.error).toBe(null);
            expect(val.value).toBe(0);
        });
        test(id(2) + `Error to Validation error`, () => {
            const val = Flow(x => { return { error: new Error() }; })
                .validate(0);

            expect(val.error).toBeInstanceOf(ValidationError);
        });
    });
});

describe(`- Concatenation`, () => {
    const val = Flow()
        .and(Joi.string().min(4))
        .and(x => {
            if (x.length > 6) return { error: new Error() };
        })
        .and(
            Joi.string().lowercase()
        );

    test(id(1) + `Returns error for invalid values`, () => {
        const values = [5, '123', '1234567', 'ASDFG'];
        values.forEach(value => {
            expect(val.validate(value).error).toBeInstanceOf(ValidationError);
        });
    });

    test(id(2) + `Returns error for valid value`, () => {
        expect(val.validate('asdfg').error).toBe(null);
    });
});

describe(`- Label & Error Message`, () => {
    describe(`- Label`, () => {
        const msgLabel = (err) => err.message.split(' ')[0];
        let val = Flow(Joi.string().label('User')).and(Joi.string().max(5));

        test(id(1) + `Inherit labels from Joi object`, () => {
            const error = val.validate(5).error;

            expect(msgLabel(error)).toBe('User');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(false);
        });
        test(id(2), () => {
            const error = val.validate('123456').error;

            expect(msgLabel(error)).not.toBe('User');
            expect(error.label).toBe(undefined);
            expect(error.isExplicit).toBe(false);
        });
        test(id(3), () => {
            const error = Flow(val)
                .and(Joi.string().max(6))
                .validate('12345678')
                .error;
            expect(msgLabel(error)).not.toBe('User');
            expect(msgLabel(error)).toBe('Value');
            expect(error.label).toBe(undefined);
            expect(error.isExplicit).toBe(false);
        });
        test(id(4) + `Inner Joi object label has precedence over outer Flow label`, () => {
            const error = val.validate(5).error;

            expect(msgLabel(error)).toBe('User');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(false);
        });
        test(id(5) + `Inherit flow label on new Flow validation from Flow object`, () => {
            const error = Flow()
                .and(Flow(Joi.string().label('User')).label('Pass'))
                .and(Joi.string().max(6))
                .validate('12345678')
                .error;

            expect(msgLabel(error)).toBe('Pass');
            expect(error.label).toBe('Pass');
            expect(error.isExplicit).toBe(false);
        });
        test(id(6) + `Outer label to inner error`, () => {
            const error = Flow()
                .and(Flow(Flow(Joi.number().min(5))))
                .label('Outer')
                .validate(4)
                .error;

            expect(msgLabel(error)).toBe('Outer');
            expect(error.label).toBe('Outer');
            expect(error.isExplicit).toBe(false);
        });
    });

    describe(`- Error Message precedence`, () => {
        const val = Flow(Joi.string().label('User'), 'Some error');
        const val2 = Flow(val).and(Joi.string().max(2));
        const val3 = Flow()
            .and(Flow()
                .and(Flow(Joi.string(), 'Some error').label('User'))
                .and(Joi.string().max(2)),
            'Other error');

        test(id(1) + `Base error message`, () => {
            const error = val.validate(5).error;

            expect(error.message).toBe('Some error');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(true);
        });
        test(id(2) + `Inherits error message`, () => {
            const error = val2.validate(5).error;

            expect(error.message).toBe('Some error');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(true);
        });
        test(id(3) + `Msg not inherited for separate validation, not inherited label from joi`, () => {
            const error = val2.validate('1234').error;

            expect(error.message).not.toBe('Some error');
            expect(error.label).not.toBe('User');
            expect(error.isExplicit).toBe(false);
        });
        test(id(4) + `Msg not inherited for separate validation, inherited label from flow`, () => {
            const error = Flow()
                .and(Flow(Joi.string(), 'Some error').label('User'))
                .and(Joi.string().max(2))
                .validate('1234')
                .error;

            expect(error.message).not.toBe('Some error');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(false);
        });
        test(id(5), () => {
            const error = val3.validate(5).error;

            expect(error.message).toBe('Some error');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(true);
        });
        test(id(6), () => {
            const error = val3.validate('1234').error;

            expect(error.message).toBe('Other error');
            expect(error.label).toBe('User');
            expect(error.isExplicit).toBe(true);
        });
    });
});

describe(`- flow.convert()`, () => {
    test(id(1) + `Joi convert, pass`, () => {
        const test = Flow(Joi.string().lowercase()).convert().validate('AAA');

        expect(test.value).toBe('aaa');
        expect(test.error).toBe(null);
    });
    test(id(2) + `Joi convert, not pass`, () => {
        const test = Flow(Joi.string().lowercase().min(6)).convert().validate('AAA');

        expect(test.value).toBe('aaa');
        expect(test.error).toBeInstanceOf(ValidationError);
    });
    test(id(3) + `Joi not convert, not pass`, () => {
        const test = Flow(Joi.string().lowercase()).validate('AAA');

        expect(test.value).toBe('AAA');
        expect(test.error).toBeInstanceOf(ValidationError);
    });
    test(id(4) + `Function convert, not pass`, () => {
        const test = Flow((x) => { return { error: Error(), value: 25 }; }).convert().validate('AAA');

        expect(test.value).toBe(25);
    });
    test(id(5) + `Function not convert, not pass`, () => {
        const test = Flow((x) => { return { error: Error(), value: 25 }; }).validate('AAA');

        expect(test.value).toBe('AAA');
    });
    test(id(6) + `Concatenation convert`, () => {
        const test = Flow()
            .and(Joi.string().lowercase())
            .and(x => { return { error: null, value: x.toUpperCase().slice(3) }; })
            .and(Joi.string().trim().max(2))
            .convert()
            .validate(' AAAA ');

        expect(test.value).toBe('AA');
        expect(test.error).toBe(null);
    });
    test(id(7) + `Concatenation, Failed structure`, () => {
        const test = Flow(Flow(Joi.string().lowercase()))
            .convert()
            .validate('AA');

        expect(test.error).toBeInstanceOf(ValidationError);
    });
    test(id(8) + `Concatenation, Mixed convert (1)`, () => {
        const test = Flow()
            .and(Flow(Joi.string().lowercase()))
            .convert()
            .validate(' AAAA ');

        expect(test.error).toBeInstanceOf(ValidationError);
    });
    test(id(9) + `Concatenation, Mixed convert (2)`, () => {
        const test = Flow()
            .and(Flow(Joi.string().lowercase()).convert())
            .and(Joi.string().regex(/^ aaaa $/))
            .validate(' AAAA ');

        expect(test.error).toBe(null);
    });
    test(id(10) + `Concatenation, Mixed convert (3)`, () => {
        const test = Flow()
            .and(Flow(Joi.string().lowercase()).convert())
            .and(Joi.string().trim())
            .validate(' AAAA ');

        expect(test.error).toBeInstanceOf(ValidationError);
    });
});

describe(`- Async Flow`, () => {
    test(id(1) + `Sync doesn't take async functions`, () => {
        const error = () => {
            return Flow()
                .and(async (x) => { })
                .validate(12);
        };

        expect(error).toThrowError();
        expect(error).not.toThrowError(ValidationError);
        expect(error).toThrowError('Use the Async validation functions when using any async function');
    });

    describe(`- flow.validateAsync()`, () => {
        describe(`- Empty return`, () => {
            const val = Flow()
                .and(async (x) => { })
                .and(Joi.string().max(2));

            test(id(1) + `Should error`, async () => {
                const res = await val.validateAsync('1234');

                expect(await res.error).toBeInstanceOf(ValidationError);
                expect(await res.value).toBe('1234');
            });
            test(id(2) + `Should not error`, async () => {
                const res = await val.validateAsync('12');

                expect(await res.error).toBe(null);
                expect(await res.value).toBe('12');
            });
        });

        describe(`- Value change`, () => {
            test(id(1) + `No convert`, async () => {
                const res = await Flow()
                    .and(async (x) => { return { value: '555' }; })
                    .and(Joi.string().max(2))
                    .validateAsync('12');

                expect(await res.error).toBe(null);
                expect(await res.value).toBe('12');
            });
            test(id(2) + `Convert`, async () => {
                const res = await Flow()
                    .and(async (x) => { return { value: '555' }; })
                    .and(Joi.string().max(2))
                    .convert()
                    .validateAsync('12');

                expect(await res.error).toBeInstanceOf(ValidationError);
                expect(await res.value).toBe('555');
            });
        });
    });
});
