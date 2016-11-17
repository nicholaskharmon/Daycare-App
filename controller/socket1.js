
    var count = 0;
    var rooms = [];

    app.get('/:room',function(req,res){
        console.log('room name is :'+req.params.room);
        res.render('index',{room:req.params.room});
    });

    io.sockets.on('connection',function(socket){

        socket.on('joinroom',function(data){
            socket.join(data.room);

            socket.set('room', data.room,function() {
                var room = data.room;
                var nickname = 'guest-'+count;
                socket.set('nickname',nickname,function(){
                    socket.emit('changename', {nickname: nickname});

                    // Create Room
                    if (rooms[room] == undefined) {
                        console.log('room create :' + room);
                        rooms[room] = new Object();
                        rooms[room].socket_ids = new Object();
                    }
                    // Store current user's nickname and socket.id to MAP
                    rooms[room].socket_ids[nickname] = socket.id

                    // broad cast join message
                    data = {msg: nickname + ' entered in.'};
                    io.sockets.in(room).emit('broadcast_msg', data);

                    // broadcast changed user list in the room
                    io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
                    count++;
                });
            });

        });

        socket.on('changename',function(data){
            socket.get('room',function(err,room){
                socket.get('nickname',function(err,pre_nick) {
                    var nickname = data.nickname;
                    // if user changes name get previous nickname from nicknames MAP
                    if (pre_nick != undefined) {
                        delete rooms[room].socket_ids[pre_nick];
                    }
                    rooms[room].socket_ids[nickname] = socket.id
                    socket.set('nickname',nickname,function() {
                        data = {msg: pre_nick + ' change nickname to ' + nickname};
                        io.sockets.in(room).emit('broadcast_msg', data);

                        // send changed user nickname lists to clients
                        io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
                    });
                });

            });
        });


        socket.on('disconnect',function(data){
            socket.get('room',function(err,room) {
                if(err) throw err;
                if(room != undefined
                    && rooms[room] != undefined){

                    socket.get('nickname',function(err,nickname) {
                        console.log('nickname ' + nickname + ' has been disconnected');
                        // broad cast <out room> message
                        if (nickname != undefined) {
                            if (rooms[room].socket_ids != undefined
                                && rooms[room].socket_ids[nickname] != undefined)
                                delete rooms[room].socket_ids[nickname];
                        }// if
                        data = {msg: nickname + 'was out.'};

                        io.sockets.in(room).emit('broadcast_msg', data);
                        io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
                    });
                }
            }); //get
        });

        socket.on('send_msg',function(data){
            socket.get('room',function(err,room) {
                socket.get('nickname',function(err,nickname) {
                    console.log('in send msg room is ' + room);
                    data.msg = nickname + ' : ' + data.msg;
                    if (data.to == 'ALL') socket.broadcast.to(room).emit('broadcast_msg', data); // send to other clients except self
                    else {
                        // whisper
                        socket_id = rooms[room].socket_ids[data.to];
                        if (socket_id != undefined) {

                            data.msg = 'Only to you :' + data.msg;
                            io.sockets.socket(socket_id).emit('broadcast_msg', data);
                        }// if
                    }
                    socket.emit('broadcast_msg', data);
                });
            });
        })
    });    //
