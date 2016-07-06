# client-state

Manage event-emitting clients using a state machine.

# Install

`npm install client-state`

# Description

The goal is to provide a Finite State Machine that reflects various states of availability for a given endpoint or service (which I will call a `client`, such as a Redis database. 

An instance of this module's interface emits events corresponding to events in the `client`.

For example, assume that a `client` emits the following events:

- `connect` (a connection has been established)
- `ready` (the connection is ready to receive commands)
- `reconnecting` 
- `end` (a connection has been lost)
- `error` (some sort of error with the connection has occurred)
- `warning` (some non-critical warning has been emitted by the client)

If you pass this `client` to `client-state`:

```
let cs = require('client-state');
let stateM = cs(someclient);
```

You can query the current state of the client like so:

```
stateM.state() // `ready`, for example
```

You can listen for state changes (again, reflecting events emitted by `client`)

```
stateM.on('ready', data => {
    // See below for breakdown of what `data` is
});
```

# Configuring FSM transitions

The events given above are the default events. You can probably use this set for most remote client implementations. 

If your target client supports the same concepts but not the same naming (likely), you can pass an event map to do translations.

For example, if your db client emits `connected` rather than `connect` and `closed` rather than `end`, add the following to your config:

```
let cs = require('client-state');
let stateM = cs(someclient, {
    eventMap : {
        'connected' : 'connect',
        'closed' : 'end'
    }
});
```

If you would like to change the default FSM event model, you will need to define an FSM transition table. This is the default transition table:

```
[
    { name: '_start', from: ['none'], to: 'start' },
    { name: '_connect', from: ['end', 'start', 'reconnecting', 'error', 'warning'], to: 'connect' },
    { name: '_ready', from: ['connect'], to: 'ready' },
    { name: '_reconnecting', from: ['connect', 'ready', 'error', 'warning', 'end'], to: 'reconnecting' },
    { name: '_end', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning'], to: 'end' },
    { name: '_error', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning', 'end'], to: 'error' },
    { name: '_warning', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning', 'end'], to: 'warning' }
]
```

The FSM for `client-state` is implemented using [`javascript-state-machine`](https://github.com/jakesgordon/javascript-state-machine). Consult [that repo's documentation](https://github.com/jakesgordon/javascript-state-machine#usage) for information on how to define a transition table.

To pass a new transition table:

```
let cs = require('client-state');
let stateM = cs(someclient, {
    transitions : [ ...your transition table ]
});
```

# Transition handlers

In addition to listening for transition events, you may also add handlers to run when entering, or leaving, a state.

For example, if you would like to run a handler whenever the `ready` state is entered:

```
let cs = require('client-state');
let stateM = cs(someclient, {
    ready : data => {
        // See below for description of #data
    },
});
```

Or when `ready` is left using the `leave` prefix (NOTE: *not* camel-cased):

```
let cs = require('client-state');
let stateM = cs(someclient, {
    leaveready : data => {
        // See below for description of #data
    },
});
```

You can listen for *all* `leave` and `enter` states with `leavestate` and `enterstate`:

```
let cs = require('client-state');
let stateM = cs(someclient, {
    enterstate : data => {
        // See below for description of #data
    },
    leavestate : data => {
        // See below for description of #data
    }
});
```

# Context

# Example

The [`redis`](https://github.com/NodeRedis/node_redis) module emits all of the above events.