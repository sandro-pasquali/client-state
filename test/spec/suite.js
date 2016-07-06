"use strict";

let Promise = require('bluebird');
let chalk = require('chalk')
let util = require('util');
let _ = require('lodash');
let debug = require('debug')('redisFSM');
let state = require('../../lib');

module.exports = function(test, Promise) {

    let scratch = {
        evLog: []
    };

    let P = new Promise(resolve => {

        // This is expected to throw a warning. See below.
        //
        let client = require('redis-hook')({
            //url: 'http://foo.bar',
            password: 'thiscausesawarning'
        })

        let stateM = state(client, {
            ready: data => {

                // Note that this will throw an error, and that is expected.
                // See tests in on('warning') below, checking #stateError.
                //
                x=y

                scratch.readyHandler = true;
            },
            enterstate : data => {
                var e = data.event;
                scratch.evLog.push(e.from, e.to);
                debug(`Enter event -> ${JSON.stringify(data)}`);
            },
            leavestate : data => {
                var e = data.event;
                scratch.evLog.push(e.from, e.to);
                debug(`Leave event -> ${JSON.stringify(data)}`);
            },

            context : {
                foo: 'isbar'
            }
        });

        stateM.on('error', e => {
            debug(`CLIENT ERROR ${JSON.stringify(e)}`)
        });

        stateM.on('stateError', e => {
            debug(`State Error: ${JSON.stringify(e)}`);
            scratch.stateError = e.event.msg;
        })

        stateM.on('leaveconnect', data => {
            scratch.connectLeft = true;
        })

        stateM.on('warning', data => {

            test.equal(stateM.context(), data.context, 'instance.context() correctly returning context');
            test.equal(stateM.state(), 'warning', 'State machine in correct `warning` state');
            test.equal(scratch.connectLeft, true, '#leaveconnect fired');
            test.equal(scratch.stateError, 'y is not defined', 'Correctly catching handler errors');
            test.equal(data.event.msg, 'Warning: Redis server does not require a password, but a password was supplied.', 'Correctly warned about unnecessary #password');

            test.deepEqual(scratch.evLog, [
                'none', 'start', // leave
                'none', 'start', // enter
                'start', 'connect', // leave
                'start', 'connect', // enter
                'connect', 'ready', // leave
                'connect', 'ready', // enter
                'ready', 'warning' // leave, and currently in `warning`
            ], 'Expected event path was seen');

            client.end();

            resolve();
        })
    })

    .then(() => new Promise(resolve => {

        // Different log for this section
        //
        scratch.evLog = [];
        scratch.stateErrors = [];

        let stateM = state(require('redis-hook')({}), {

            connect : data => {

                return {
                    bleep : 'boop'
                }
            },
            ready: data => {

                // Create two state errors:
                // 1. Inappropriate state change request
                // 2. Attempt to modify immutable context (test that context is immutable)
                // See 'ready' hander, below.
                //
                stateM.start();
                data.context.blat = 'bleet';
            },
            enterstate : data => {
                var e = data.event;
                scratch.evLog.push(e.from, e.to);
                debug(`Enter event -> ${JSON.stringify(data)}`);
            },
            leavestate : data => {
                var e = data.event;
                scratch.evLog.push(e.from, e.to);
                debug(`Leave event -> ${JSON.stringify(data)}`);
            },

            context: {
                beep: 'bop'
            }
        });

        stateM.on('ready', data => {

            test.deepEqual(scratch.stateErrors, [ 'event _start inappropriate in current state ready',
                'Can\'t add property blat, object is not extensible' ], 'Correctly catching bad transition errors and context mutation errors');
            test.deepEqual(data.context, { bleep: 'boop', beep: 'bop'}, 'State change handlers correctly updating context');

            resolve();
        });

        stateM.on('stateError', e => {
            debug(`State Error: ${JSON.stringify(e)}`);
            scratch.stateErrors.push(e.event.msg);
        });

        stateM.on('error', e => {
            debug(`CLIENT ERROR ${JSON.stringify(e)}`);
        });

        /*
         // This is expected to throw a warning. See below.
         //

         */
    }));






    P.timeout(1000)
    .catch(Promise.TimeoutError, err => {
        P[1](`Timed out. Probably did not reach end state.\n Scratch: ${JSON.stringify(scratch)}`);
    })
    .catch(err => chalk.bgRed.black(err.message));

    return P;
};

//            test.deepEqual(data.context, { foo: 'isbar', baz: 'boop' }, 'State handlers correctly modifying context');
