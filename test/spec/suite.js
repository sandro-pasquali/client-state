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
            password: 'thiscausesawarning'
        });

        let stateM = state(client, {
            ready: data => {

                // Note that this will throw an error, and that is expected.
                // See #stateError handler
                //
                x=y

                scratch.readyHandler = true;

                return {
                    baz : 'boop'
                }
            },
            enterstate : data => {
                var e = data.event;
                scratch.evLog.push(e.from, e.to);
                debug(`Enter event -> ${e.name} : ${e.from} -> ${e.to} > ${e.msg}`);
            },
            leavestate : data => {
                var e = data.event;
                scratch.evLog.push(e.from, e.to);
                debug(`Leave event -> ${e.name} : ${e.from} -> ${e.to} > ${e.msg}`);
            }
        }, {
            foo: 'isbar'
        });

        // Will catch errors occurring in state handlers (above)
        //
        stateM.on('stateError', errObj => {
            debug(`Caught FSM error: ${errObj.message}`)
            test.pass('Correctly catching handler errors');
        });

        stateM.on('leaveconnect', data => {
            scratch.connectLeft = true;
        })

        stateM.on('warning', data => {

            test.equal(stateM.context(), data.context, 'State machine correctly sending updated context');
            test.equal(stateM.state(), 'warning', 'State machine in correct `warning` state');

            test.equal(scratch.connectLeft, true, '#leaveconnect fired');

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

            resolve();
        })
    });

    P.timeout(1000)
    .catch(Promise.TimeoutError, err => {
        P[1](`Timed out. Probably did not reach 'warning' state.\n Scratch: ${JSON.stringify(scratch)}`);
    })
    .catch(err => chalk.bgRed.black(err.message));

    return P;
};