# Synchronization

Currently, the synchronization strategy OTT uses is fairly simple, and does not handle non-primitive, non-object types very well (particularly arrays, maps, sets). However, there's a couple of things to keep in mind in order to understand what is going on in the code.

For each room, there is one room state (represented by the type `RoomState`). However, to prevent leaking of sensitive info, and optimize network traffic, there are 2 different types of room state that are actively maintained by rooms: `RoomStateStorable`, and `RoomStateSyncable`. Storable room state is stored in redis for restoration upon server restart. Syncable state is safe to be transmitted to clients. Not all room state is persisted in the database.
