
global.io.sockets.on('connection',function(socket){
    var room_id = '';
    socket.on('joinRoom',function(data){
        room_id = data;
        socket.join(room_id);
        console.log('JOIN ROOM LIST', global.io.sockets.adapter.rooms);
    });
    socket.on('leaveRoom',function(){
        socket.leave(room_id);
        console.log('OUT ROOM LIST', global.io.sockets.adapter.rooms);
    });

    socket.on('call_event',function(data){
        socket.broadcast.emit('call_event',data);
    });
    //
    //socket.on('notify_on',function(data){
    //  socket.broadcast.emit('notify_on_' + data.property_id,data);
    //});
});