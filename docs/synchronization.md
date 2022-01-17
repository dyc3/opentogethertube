# Synchronization

Currently, the synchronization strategy OTT uses is fairly simple, and does not handle non-primitive, non-object types very well (particularly arrays, maps, sets). However, there's a couple of things to keep in mind in order to understand what is going on in the code.

For each room, there is one room state (represented by the type `RoomState`). However, to prevent leaking of sensitive info, and optimize network traffic, there are 2 different types of room state that are actively maintained by rooms: `RoomStateStorable`, and `RoomStateSyncable`. Storable room state is stored in redis for restoration upon server restart. Syncable state is safe to be transmitted to clients. Not all room state is persisted in the database.

When a Node loads a room, it places the newly created room state in memory, and replicates appropriate state to redis (`RoomStateStorable`). If the room state already exists in redis, creating a new room state will fail, (with the exception of restoring all rooms upon first startup). When a Node receives a message from a client, the client manager passes the message along to the room manager via redis pubsub.

# Multi-Node Configurations

*Currently not possible. This section describes a design that is yet to be completely fleshed out and fully implemented.*

Multi-Node Configurations are where multiple instances of the server being run. A Node is simply an instance of the OTT server. They can be run on the same machine, or on different machines.

## Rooms

For simplicity of room state management, only one Node is allowed to manage the state of a room. If a client connects to a Node that does not manage the room its connecting to, the Node transparently forwards requests to the Node that manages the room via redis pubsub. Since all room requests go through redis pubsub anyway, not much additional effort is required to do this.

When a room is created, the Node that happens to receive the request becomes responsible for managing the room. No attempts to transfer rooms to other free Nodes are made.

## Node Startup

When a Node starts up, it loads all room states from redis. The purpose of this is to allow for the Node to restart without interrupting people's watching sessions. This works fine for single Node configurations, but special care must be taken for multi-Node configurations.

- If multiple Nodes start up at the same time, Nodes need to negotiate which Node is responsible for a room. *Preferably in a stateless manner.*
