# client-state

Manage event-emitting clients using a state machine.

# install

`npm install client-state`

# Usage

The goal is to provide a Finite State Machine that reflects various states of availability for a given endpoint or service (which I will call a `client`, such as a Redis database. 

An instance of this module's interface emits events corresponding to events in the `client`.

For example, assume that a `client` emits the following events:

- connect (a connection has been established)
- ready (the connection is ready to receive commands)
- reconnecting 
- end (a connection has been lost)
- error (some sort of error with the connection has occurred)
- warning (some non-critical warning has been emitted by the client)

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


The [`redis`](https://github.com/NodeRedis/node_redis) module emits all of the above events.