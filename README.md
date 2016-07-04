# stat

Manage Redis connections with a state machine

# install

`npm install stat`

# Usage

The goal is to provide a Finite State Machine that reflects various states of availability for a given endpoint or service (which I will call a `client`, such as a Redis database. 

An instance of this module's interface emits events corresponding to events in the `client`.

For example, the [`redis`](https://github.com/NodeRedis/node_redis) module emits the following events:

- connect (a connection has been established)
- ready (the connection is ready to receive commands)
- reconnecting 
- end (a connection has been lost)
- error (some sort of error with the connection has occurred)
- warning (some non-critical warning has been emitted by the client)


Additionally, it allows this state machine to maintain an internal context (a plain JavaScript object).



```

let client = require('redis-hook')({});

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
        
    { name: '_connect', from: ['end', 'start', 'reconnecting', 'error', 'warning'], to: 'connect' },
    { name: '_ready', from: ['connect', 'ready', 'warning'], to: 'ready' },
    { name: '_reconnecting', from: ['connect', 'ready', 'error', 'warning'], to: 'reconnecting' },
    { name: '_end', from: ['connect', 'start', 'reconnecting', 'error', 'ready', 'warning'], to: 'end' },
    { name: '_error', from: ['connect', 'start', 'reconnecting', 'end', 'ready', 'warning'], to: 'error' },
    { name: '_warning', from: ['connect', 'start', 'reconnecting', 'end', 'ready', 'warning'], to: 'warning' }
```