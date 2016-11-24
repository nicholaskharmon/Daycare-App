var express = require('express');
var http = require('http');
var path = require('path');
var mime = require('mime');
//var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var fs = require('fs');
//var fstools = require('fs-tools');
var formidable = require('formidable');

var index = require('./routes/index');
var users = require('./routes/users');
var restapi = require('./routes/restapi');
var verifyuser = require('./routes/verifyuser');
var sendSMS = require('./routes/sendSMS');
var signup = require('./routes/signup');
var saveProfile = require('./routes/saveProfile');
var debug = require('debug')('reveal-server:server');

//for Facebook Login
var passport          =     require('passport');
var util              =     require('util');
var FacebookStrategy  =     require('passport-facebook').Strategy;
var session           =     require('express-session');
//--------------

var app = express();
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}

var port = normalizePort(process.env.PORT || '8005');
//var port = normalizePort(process.env.PORT || '80');

app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);


var io = require('socket.io').listen(server);


// for facebook login
// Passport session setup.
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(obj, done) {
    done(null, obj);
});
// Use the FacebookStrategy within Passport.
passport.use(new FacebookStrategy({
        clientID    : '1843633225883368',
        clientSecret: 'b400c3647c06b6d35ee2ee79d282c631',
        callbackURL : 'http://localhost:8005/auth/facebook/callback',    // 8005 : port that server listening
        profileFields: ['id', 'displayName', 'email']
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function (req, res) {
            //Check whether the User exists or not using profile.id
            //Further DB code.
            console.log(profile);
            var eaddress = profile.emails[0].value;
            var sql = 'select  from users where user_email=';
            mysql.query('select user_id cnt from users where user_email=?', [eaddress], function(err, rows){
                if(err) console.error('err', err);
                console.log('rows',rows);

                if(rows.length > 0) {
                    session.user_id = rows[0].user_id;
                }else{
                    session.user_id = '-1';
                }
            })
           // return done(null, profile);
        });
    }
));
//-------------------

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// for facebook login (11.10)
app.use(session({ secret: 'todayandfuture', key: 'sid',saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/facebook', passport.authenticate('facebook',{scope:'email'}));
app.get('/auth/facebook/callback',
    // need attension !!!
    // successRedirect : case of facebook login success
    // failureRedirect : case of facebook login failure
    passport.authenticate('facebook', {successRedirect:'/dashboard', failureRedirect: '/' }),
    function(req, res) {
        console.log(session.user_id);
        res.redirect('/');
    });
app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login')
}

//-----------------------

app.use('/', index);
app.use('/users', users);
app.use('/api', restapi);
// when press button<login>, check user information
app.post('/verifyuser', verifyuser.verify);
// when user answer is right, send SMS
app.post('/sendSMS', sendSMS.changePWD);

app.get('/selectPhoto', function(req, res){
    res.render('selectPhoto', { title: 'DayCare' });
});

app.post('/uploadPhoto', function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/uploads');
    form.keepExtensions = true;
    form.maxFieldsSize = 2 * 1024 * 1024;

    // parse a file upload
    form.parse(req, function(err, fields, files) {
        //res.writeHead(200, {'content-type': 'text/plain'});
        //res.write('Upload received :\n');
        //res.end(util.inspect({fields: fields, files: files}));
    });
    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = path.basename(this.openedFiles[0].path);
        req.session.photopath = temp_path;
        /* The file name of the uploaded file */
        var file_name = this.openedFiles[0].name;
        var cid = req.session.child_id;

        if(cid) {   // when uploading completed, changed imgsrc of DB according child_id
            var sql = "update childs set imgsrc='" + temp_path + "' where child_id='" + cid + "'";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    throw err;
                }
            })
        }
    });
    return res.redirect('/profile');
})

app.post('/saveProfile', function(req, res) {
    console.log(req);
    var cname = req.body.cname;
    var birthday = req.body.birthday;
    var address = req.body.address;
    var weight = req.body.weight;
    var cheight = req.body.cheight;
    var allergy = req.body.allergy;
    var medication = req.body.medication;
    var sibling = req.body.sibling;
    var cid = req.session.child_id;
    var uid = req.session.user_id;
    var imgpath = req.session.photopath;

    // parse the incoming request containing the form data
    //form.parse(req);

    var sql = "select * from childs where child_id='" + cid + "'";

    global.mysql.query(sql, function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        //res.json(rows);

        var cnt = rows.length;

        if (cnt > 0) {// update data
            // if can not find user, show message
            var sql = "update childs set child_name='" + cname + "', ";
            sql += " birthday='" + birthday + "', address='" + address + "',";
            sql += " weight='" + weight + "', height='" + cheight + "',";
            sql += " allergies='" + allergy + "', ";

            if (medication == 'on') {  sql += " medication='1', "; }
            else                    {  sql += " medication='0', "; }

            if (sibling == 'on') {  sql += " sibling='1' "; }
            else                 {  sql += " sibling='0' "; }

            sql += " where child_id='" + cid + "'";

            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    throw err;
                }
            });
            return res.redirect('/profile');
        }
        else {
            // if correct account, register user and redirect to next page
            var sql = "insert into childs (child_name,birthday,address,weight,height,allergies,medication,sibling,imgsrc) ";
            sql += " values('" + cname + "','" + birthday + "','" + address + "',";
            sql += "'" + weight + "','" + cheight + "','" + allergy + "',";
            if (medication == 'on') {
                sql += "'1',";
            } else {
                sql += "'0',";
            }
            if (sibling == 'on') {
                sql += "'1',";
            } else {
                sql += "'0',";
            }
            sql += "'" + imgpath + "')";

            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    //return res.redirect('/change_pwd_error');
                    //throw err;
                } else {
                    sql = "select child_id from childs where child_name='" + cname + "' and birthday='" + birthday + "' and address='" + address + "'";
                    global.mysql.query(sql, function (err, rows) {
                        if (err) {
                            console.error(err);
                        } else {
                            var ncid = rows[0].child_id;
                            sql = "update users set child_id='" + ncid + "' where user_id='" + uid + "'";
                            global.mysql.query(sql, function (err, rows) {
                                if (err) {
                                    console.error(err);
                                }
                            })
                        }
                    })
                    return res.redirect('/profile');
                }
            })
        }
    })
});

// when user answer is right, register user
app.post('/saveuser', signup.saveUser);

// when press button<signup>, show page<signup>
app.get('/profile', function(req, res){
    var nm = req.session.nickname;
    var grd = req.session.grade;
    var chid = req.session.child_id;
    global.mysql.query("select * from childs where child_id='" + chid + "'", function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        console.log(rows);
        res.render('profile', { cdata : rows, nname: nm, grade : grd });

    })
});
// when press button<signup>, show page<signup>
app.get('/signup', function(req, res){
    res.render('signup', { title: 'DayCare' });
});
// when wrong user information, show page<passsword error>
app.get('/passerror', function(req, res){
  var shd = "E-mail address or Password is incorrect.";
  var smsg = "Please Input correct value and retry.";
  var surl = "/";
  var sbtnname = "Return to Login Page";
  res.render('errorMsg', { title:'DayCare', hd:shd, msg:smsg, url:surl, btnname:sbtnname });
});
// when wrong user information, show page<passsword error>
app.get('/change_pwd_error', function(req, res){
    var shd = "e-mail address, user name or phonenumber is incorrect.";
    var smsg = "Please Input correct value and retry. ";
    smsg += "If you have not account yet, SignUP please.";
    var surl = "/";
    var sbtnname = "Return to Login Page";
    res.render('errorMsg', { title:'Daycare',hd:shd, msg:smsg, url:surl, btnname:sbtnname });
});
// when wrong user information, show page<passsword error>
app.get('/signup_error', function(req, res){
  var shd = "Data is duplicated or network problem.";
  var smsg = "Please Input correct data and retry. ";
  smsg += "If you have not account yet, SignUP please.";
  var surl = "/";
  var sbtnname = "Return to Login Page";
  res.render('errorMsg', { title:'Daycare',hd:shd, msg:smsg, url:surl, btnname:sbtnname });
});

// when press button<forgot pasword?>, show page<passsword recover>
app.get('/recoverpwd', function(req, res){
    res.render('recoverpwd', { title: 'DayCare' });
});

// when go Dashboard
app.get('/dashboard', function(req, res){
    var nickname = req.session.nickname;
    var grade  = req.session.grade;

    console.log(nickname+"  "+grade);

    res.render('dashboard', { title: 'DayCare', nname: nickname, grade: grade });
});

// when click calendar in dashboard
app.get('/calendar', function(req, res){
    var nm = req.session.nickname;
    var grd = req.session.grade;

    res.render('calendar', { nname: nm, grade: grd });
});

// when click calendar in dashboard
app.get('/event-setting', function(req, res){
    res.render('event_setting');
});

// when click onmyway in dashboard
app.get('/map', function(req, res){
    var nickname = req.session.nickname;
    var grade  = req.session.grade;
    // when parent pressed <on my way>, push notification to owner and assists.
    if (grade == 3){

    }

    res.render('location-sharing',{nname: nickname});
});

// when click calendar in dashboard
app.post('/save-event', function(req, res){
    console.log(req);
    var edate = req.body.edate;
    var etime = req.body.etime;
    var econtent = req.body.econtent;

    if(edate == '' || etime == '' || econtent == '') {
        var smsg = 'Event data was not saved. Retry later.';
        res.render('errorMsg', { title:'Daycare',hd:'Data Saving Error', msg:smsg, url:'/calendar', btnname:'To Calendar' });

        return false;
    }

    econtent = econtent.replace(/'/gi, "`");

    var sql = "insert into events (mdate, mtime, event) values('"+edate+"','"+etime+"','"+econtent+"')";

    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            var smsg = 'Event data was not saved. Retry later.';
            res.render('errorMsg', { title:'Daycare',hd:'Data Saving Error', msg:smsg, url:'/calendar', btnname:'To Calendar' });
        }
        res.render('calendar');
    })
});

app.get('/chatting/',function(req,res){
    var cid = req.session.child_id;
    var uid = req.session.user_id;
    var grade = req.session.grade;
    var nickname = req.session.nickname;
    var roomname;

    if(nickname== undefined){
        var shd = "Not Signed in yet.";
        var smsg = "Please SignIn.";
        var surl = "/";
        var sbtnname = "Return to Login Page";
        res.render('errorMsg', { title:'DayCare', hd:shd, msg:smsg, url:surl, btnname:sbtnname });
        return;
    }

    if(grade == '3'){ // parents
        if(cid == '0'){ // when no profile
            var smsg = "Please enter profile and register Information of your child.";
            res.render('errorMsg', { title:'Daycare',hd:"No Child Information", msg:smsg, url:"/dashboard", btnname:"To Dashboard" });
        }else{          // when exist profile
            var sql = "select child_name from childs where child_id='" + cid + "'";
            global.mysql.query(sql, function(err, rows){
                if (err) {
                    console.error(err);
                    throw err;
                }

                var childname = rows[0].child_name;
                console.log('room name is : Staff   nickname=' + nickname);

                roomname = childname + ' Family';

                res.render('chatting',{room:'Staff', nname : nickname});
            })
        }
    } else {
        roomname = 'Staffs';
        console.log('room name is : staff   nickname='+nickname);
        res.render('chatting',{room: 'Staff', nname: nickname});
    }
});

// ---------------- start of group chatting server ----------------------

var count = 0;
var rooms = [];

io.sockets.on('connection',function(socket){
    console.log('a user connected');

    // when moving position
    socket.on('location', function (data) {
        io.sockets.in('map').emit('location', data);
    });

    // when push notification
    socket.on('notify', function (data) {
        io.sockets.in('map').emit('notify', data);
    });

    socket.on('get-event', function(data){
        var first = data.firstday, last = data.lastday, nickname = data.to;
        var sdate = "", stime = "", sevent = "";

        var sql = "select mdate, mtime, event from events where mdate between '" + first + "' and '" + last + "' order by mdate";
        global.mysql.query(sql, function(err, rows){
            if (err) {
                console.error(err);
                throw err;
            }
            if(rows.length > 0){
                var socket_id = rooms['events'].socket_ids[nickname];
                if (socket_id != undefined) {
                    for(i=0; i < rows.length; i++){
                        var ss = new Date("" + rows[i].mdate);
                        var n = ss.getFullYear() + "-" + (ss.getMonth()+1)+"-"+ss.getDate();
                        data.date = n;
                        data.time = rows[i].mtime;
                        data.event= rows[i].event;
                        io.to(socket_id).emit('broadcast_msg', data);
                    }// if
                }
            }
        })
    })

    socket.on('joinroom',function(data) {
        if (data.nickname == '' || data.nickname == undefined) return;
        socket.join(data.room);

        var room = data.room;
        //var nickname = 'guest-'+count;
        var nickname = data.nickname;

        socket.room = room;
        socket.nickname = nickname;

        socket.emit('changename', {nickname: nickname});

        // Create Room
        if (rooms[room] == undefined || rooms.length == 0) {
            console.log('room create :' + room);
            rooms[room] = new Object();
            rooms[room].socket_ids = new Object();
        }
        // Store current user's nickname and socket.id to MAP
        rooms[room].socket_ids[nickname] = socket.id;

        // broad cast join message
        if (room == 'Staff'){
            data = {msg: nickname + ' entered in room ' + room + '.\n'};
           io.sockets.in(room).emit('broadcast_msg', data);
        }

        // broadcast changed user list in the room
        io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
        count++;
    });

    socket.on('changename',function(data){
        var room = socket.room;
        var nickname = data.nickname;
        var pre_nick = socket.nickname;
        if (pre_nick != undefined) {
            delete rooms[room].socket_ids[pre_nick];
        }
        rooms[room].socket_ids[nickname] = socket.id;

        socket.nickname = nickname;
        data = {msg: pre_nick + ' change nickname to ' + nickname};
        io.sockets.in(room).emit('broadcast_msg', data);
        io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
    });

    socket.on('disconnect',function(data){
        var room = socket.room;

        if(room != undefined && rooms[room] != undefined){

            var nickname = socket.nickname;
            console.log('nickname ' + nickname + ' has been disconnected\n');
            // broad cast <out room> message
            if (nickname != undefined) {
                if (rooms[room].socket_ids != undefined
                    && rooms[room].socket_ids[nickname] != undefined)
                    delete rooms[room].socket_ids[nickname];
            }// if
            if(room == 'Staff'){
                data = {msg: nickname + ' was out.\n'};
                io.sockets.in(room).emit('broadcast_msg', data);
                io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
            }

        }
    });

    socket.on('select_during', function(data){//{during: $('#during').val()});
        var during = data.during;
        var room = data.room;
        var nickname = data.nickname;
        var bdate = new Date(), edate = new Date();

        if(during == "1week"){
            bdate.setDate(bdate.getDate()-7);
            edate = new Date();
        }else if(during=="2week"){
            bdate.setDate(bdate.getDate()-14);
            edate.setDate(edate.getDate()-8);
        }else if(during=="3week"){
            bdate.setDate(bdate.getDate()-21);
            edate.setDate(edate.getDate()-15);
        }else{
            bdate.setDate(bdate.getDate()-30);
            edate.setDate(edate.getDate()-22);
        }
        var bstr = "";
        var estr = "";
        bstr = bdate.getFullYear() + "-" + (bdate.getMonth()+1) + "-" + bdate.getDate();
        estr = edate.getFullYear() + "-" + (edate.getMonth()+1) + "-" + edate.getDate();

        var sql = "select msg from message where room='" + room +"' and (mdate between '" + bstr + "' and '" + estr + "') order by id";

        global.mysql.query(sql, function(err, rows){
            if (rows.length > 0){
                data.msg = "Messages( " + bstr + " ~ " + estr + " )";
                var socket_id = rooms[room].socket_ids[nickname];
                if (socket_id != undefined) {
                    io.to(socket_id).emit('broadcast_msg', data);
                    for(i=0; i < rows.length; i++){
                            data.msg = rows[i].msg;
                            io.to(socket_id).emit('broadcast_msg', data);
                    }// if
                }
            }
        })
    })

    socket.on('send_msg',function(data){
        var room = socket.room;
        var nickname = socket.nickname;

        if(nickname != undefined && room != undefined ) {
            console.log('in send msg room is ' + room);

            data.msg = nickname + ' : ' + data.msg;
            if (data.to == 'ALL') socket.broadcast.to(room).emit('broadcast_msg', data); // send to other clients except self
            else {
                // whisper
                var socket_id = rooms[room].socket_ids[data.to];
                if (socket_id != undefined) {

                    data.msg = data.to + ':' + data.msg;
                    io.to(socket_id).emit('broadcast_msg', data);
                }// if
            }
            var d = new Date();
            var sdate = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
            var stime = d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();

            // save msg into DB
            var sql = "insert into message (sender, reciever, mdate, mtime, msg, room)";
            sql += " values('" + nickname + "','" + data.to + "','";
            sql += sdate + "','" + stime + "','" + data.msg + "','" + room + "')";

            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                }
            })
            socket.emit('broadcast_msg', data);
        }
    })
});    //

// ---------------- end of group chatting server -------------------------

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
