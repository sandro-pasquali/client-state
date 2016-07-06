'use strict';

let util = require('util');
let EventEmitter = require('events');
let StateMachine = require('./StateMachine');
let Immutable = require('seamless-immutable');
let _ = require('lodash');

function Controller(api, context, transitions) {

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
                // NOTE: Any errors in the handler will be broadcast
                // on the general 'error' channel.
                //
                try {
                    let res = func(evData);

                    // Update context and info bundle
                    //
                    context = context.merge(_.isPlainObject(res) ? res : {});

                    evData.context = context;

                    // To listeners
                    //
                    this.emit(stateName, evData);

                } catch(e) {

                    evData.event.msg = e.message;
                    evData.context = this.context();

                    this.emit('stateError', evData);
                    this.emit(stateName, evData);
                }
            };

            return acc;

        }, {}),

        error : (eventName, from, to, args, errorCode, errorMessage) => {
            this.emit('stateError', {
                event: {
                    msg : errorMessage,
                    from : from,
                    to : to,
                    name : eventName
                },
                context: this.context()
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

module.exports = function(client, api) {

    api = api || {};

    let context = api.context || {};

    // name = event; to = state
    //
    let transitions = api.transitions || [
        { name: '_start', from: ['none'], to: 'start' },
        { name: '_connect', from: ['end', 'start', 'reconnecting', 'error', 'warning'], to: 'connect' },
        { name: '_ready', from: ['connect'], to: 'ready' },
        { name: '_reconnecting', from: ['connect', 'ready', 'error', 'warning', 'end'], to: 'reconnecting' },
        { name: '_end', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning'], to: 'end' },
        { name: '_error', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning', 'end'], to: 'error' },
        { name: '_warning', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning', 'end'], to: 'warning' }
    ];

    // If none sent we're just identity mapping our transition table.
    //
    let eventMap = api.eventMap || transitions.reduce((acc, t) => {
        acc[t.to] = t.to;
        return acc;
    }, {});

    if(!_.isPlainObject(api)) {
        throw new Error(`Malformed #api definition. Must be an Plain Object. Received: ${api}`);
    }

    if(!_.isPlainObject(context)) {
        throw new Error(`Malformed #api.context definition. Must be an Plain Object. Received: ${api.context}`);
    }

    if(!_.isArray(transitions)) {
        throw new Error(`malformed #api.transitions definition. Must be undefined, or an Array. Received: ${api.transitions}`);
    }

    if(!_.isPlainObject(eventMap)) {
        throw new Error(`malformed #api.eventMap definition. Must be undefined, or a Plain Object. Received: ${api.eventMap}`);
    }

    // Reduce api to only state handlers
    //
    delete api.context;
    delete api.transitions;
    delete api.eventMap;

    // Handlers/listeners never receive mutable context
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

    let controller = new Controller(base, context, transitions);

    // Client events mapped to Controller events.
    // Note the #eventMap translation.
    //
    transitions.map(t => client.on(t.to, controller[eventMap[t.to]]));

    return controller;
};


