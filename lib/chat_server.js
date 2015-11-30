var socketio= require('socket.io');
var io;
var guestNumber= 1;
var nickNames= {};
var namesUsed= [];
var currentRoom= {};

exports.listen= function(server){
  io= socketio.listen(server);
  io.set('loglevel',1);
  io.sockets.on('connection',function(socket) {
    guestNumber= assignGuestName(socket,guestNumber,nickNames,namesUsed);
    joinRoom(socket,'Lobby');
    handleMessageBroadcasting(socket,nickNames);
    handleNameChangeAttempts(socket,nickNames, namesUsed);
    handleRoomJoining(socket);
    socket.on('rooms',function(){
      socket.emit('rooms',io.sockets.manager.rooms);
    });
    socket.on('who', function(){
      var room = currentRoom[socket.id];
      usersInRoomAlg(socket, room);
    });
    handleClientDisconnection(socket,nickNames, namesUsed);
  });
};

function assignGuestName(socket,guestNumber, nickNames,namesUsed) {
  var name= 'Guest'+ guestNumber;
  nickNames[socket.id]= name;
  socket.emit('nameResult',{
    success:true,
    name:name
  });
  namesUsed.push(name);
  return guestNumber+ 1;
}

function usersInRoomAlg(socket, room){
  var usersInRoom = io.sockets.clients(room);
  if (usersInRoom.length > 1) {
    var usersInRoomSummary = 'Users currently in ' + room + ': ';
    for (var index in usersInRoom) {
      var userSocketId = usersInRoom[index].id;
      usersInRoomSummary += nickNames[userSocketId];
      usersInRoomSummary += ', ';
    }
    usersInRoomSummary = usersInRoomSummary.slice(0, -2);
    usersInRoomSummary += '.';
    socket.emit('message', {text: usersInRoomSummary});
  }
}

function joinRoom(socket, room) {
  socket.join(room);
  currentRoom[socket.id] = room;
  socket.emit('joinResult', {room: room});
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + ' has joined ' + room + '.'
  });
  usersInRoomAlg(socket, room);
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  socket.on('nameAttempt', function(name) {
    if (name.indexOf('Guest') == 0) {
      socket.emit('nameResult', {
      success: false,
      message: 'Names cannot begin with "Guest".'
    });
    } else {
    if (namesUsed.indexOf(name) == -1) {
      var previousName = nickNames[socket.id];
      var previousNameIndex = namesUsed.indexOf(previousName);
      namesUsed.push(name);
      nickNames[socket.id] = name;
      delete namesUsed[previousNameIndex];
      socket.emit('nameResult', {
        success: true,
        name: name
      });
      socket.broadcast.to(currentRoom[socket.id]).emit('message', {
        text: previousName + ' is now known as ' + name + '.'
      });
    } else {
    socket.emit('nameResult', {
      success: false,
      message: 'That name is already in use.'
    });
      }
    }
  });
}

function handleMessageBroadcasting(socket) {
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    });
  });
}

function handleRoomJoining(socket) {
  socket.on('join', function(room) {
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket, room.newRoom);
  });
}

function handleClientDisconnection(socket) {
  //console.log('someone is leaving');
  socket.on('disconnect', function() {
    socket.broadcast.to(currentRoom[socket.id]).emit('message', {
      text: nickNames[socket.id] + ' has disconnected.'
    });

    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    //delete namesUsed[nameIndex];
    delete nickNames[socket.id];
    namesUsed.splice(nameIndex, 1);
  });
}
