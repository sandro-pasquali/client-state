'use strict';

let util = require('util');
let EventEmitter = require('events');
let StateMachine = require('./StateMachine');
let Immutable = require('seamless-immutable');
let _ = require('lodash');

// name = event; to = state
//
let transitions = [
    { name: '_start', from: ['none'], to: 'start' },
    { name: '_connect', from: ['end', 'start', 'reconnecting', 'error', 'warning'], to: 'connect' },
    { name: '_ready', from: ['connect', 'ready', 'warning'], to: 'ready' },
    { name: '_reconnecting', from: ['connect', 'ready', 'error', 'warning'], to: 'reconnecting' },
    { name: '_end', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning'], to: 'end' },
    { name: '_error', from: ['connect', 'start', 'reconnecting', 'end', 'ready', 'warning'], to: 'error' },
    { name: '_warning', from: ['connect', 'start', 'reconnecting', 'end', 'ready', 'warning'], to: 'warning' }
];

function Controller(api, context) {

    EventEmitter.call(this);

    let fsm = StateMachine.create({
        initial: {
            state: 'start',
            event: '_start'
        },
        events: transitions,

        callbacks : Object.keys(api).reduce((acc, stateName) => {

            let func = api[stateName];

            // These are listening for STATE changes (onSTATE)
            //
            acc[`on${stateName}`] = (ev, from, to, msg) => {

                // Handlers/listeners get this bundle.
                //
                let evData = {
                    event : {
                        name : ev,
                        from : from,
                        to: to,
                        msg : msg
                    },
                    context : context
                };

                // To handler. May receive an Object with updates.
                //
                let res = func(evData);

                // Update context and info bundle
                //
                context = context.merge(_.isPlainObject(res) ? res : {});

                evData.context = context;

                // To listeners
                //
                this.emit(stateName, evData);
            };

            return acc;

        }, {}),

        error : (eventName, from, to, args, errorCode, errorMessage) => {
            this.emit('stateError', {
                code : errorCode,
                message : errorMessage,
                from : from,
                to : to,
                eventName : eventName
            })
        }
    });

    // Api access allowing firing of fsm events.
    // Typically this will be done through Redis events (see export).
    //
    transitions.map(t => this[t.to] = fsm[`_${t.to}`].bind(fsm));

    // Custom interfaces
    //
    this.context = () => {
        return context;
    };

    this.state = () => {
        return fsm.current;
    };

    this.is = st => {
        return fsm.is(st);
    };
}

util.inherits(Controller, EventEmitter);

module.exports = function(client, api, context) {

    api = api || {};
    context = context || {};

    if (!_.isObject(api)) {
        throw new Error(`malformed api definition. Must be an Plain Object. Received: ${api}`);
    }

    if (!_.isObject(context)) {
        throw new Error(`malformed context definition. Must be an Plain Object. Received: ${context}`);
    }

    // Handlers/listeners never receive mutable content
    //
    context = Immutable(context);

    let base = transitions.map(t => t.to)
    .concat('leavestate','enterstate')
    .reduce((acc, m) => {
        acc[m] = () => {}; // shortcut for enterSTATE
        acc[`leave${m}`] = () => {};
        return acc;
    }, {});

    Object.assign(base, api);

    let c = new Controller(base, context);

    // Client events mapped to Controller events.
    //
    transitions.map(t => client.on(t.to, c[t.to]));

    return c;
};


