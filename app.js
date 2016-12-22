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
var crypto = require('crypto');

var index = require('./routes/index');
var users = require('./routes/users');
var restapi = require('./routes/restapi');
var verifyuser = require('./routes/verifyuser');
var sendSMS = require('./routes/sendSMS');
var signup = require('./routes/signup');
var saveProfile = require('./routes/saveProfile');
var debug = require('debug')('reveal-server:server');
var user = require('./routes/user');

//for Facebook Login
var passport          =     require('passport');
var FacebookStrategy  =     require('passport-facebook').Strategy;
var session           =     require('express-session');
//--------------

var app = express();

/*** Normalize a port into a number, string, or false. */
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

/*** Event listener for HTTP server "error" event. */
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

/*** Event listener for HTTP server "listening" event. */
function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}

var port = normalizePort(process.env.PORT || '8080');

app.set('port', port);

/************************
 * Create HTTP server.
 ******************************/
var server = http.createServer(app);

/*******************************
 * Listen on provided port, on all network interfaces.
 ***************************************/
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// start socket server
var io = require('socket.io').listen(server);

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

// for facebook login
// Passport session setup.
// after authentication, store user profile in session
passport.serializeUser(function(user, done) {
    console.log('serialize');
    console.log(user);
    done(null, user);
});

// after authentication, read user profile from session and store in req.user
passport.deserializeUser(function(user, done) {
    console.log('deserialize');
    console.log(user);
    done(null, user);
});

// Use the FacebookStrategy within Passport.
passport.use(new FacebookStrategy({
        clientID    : '1601310540178555',
        clientSecret: '6233dcc07f29e12b335f1a608c154b72',
        callbackURL : 'http://192.168.4.148:8080/auth/facebook/callback',    // 8080 : port that server listening
        //callbackURL : 'http://ec2-54-147-107-47.compute-1.amazonaws.com:8080/auth/facebook/callback',    // 8080 : port that server listening
        profileFields: ['id', 'displayName', 'email']
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function (req, res) {
            //Check whether the User exists or not using profile.id
            //Further DB code.
            console.log(profile);
            return done(null,{'email':profile.emails[0].value} );
        });
    }
));
//-------------------

// for facebook login (11.10)
app.use(session({ secret: 'todayandfuture'}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/facebook', passport.authenticate('facebook'));
// successRedirect : case of facebook login success
// failureRedirect : case of facebook login failure
app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {successRedirect:'/login_success', failureRedirect: '/login_fail' })
);

// when success in facebook login
app.get('/login_success', ensureAuthenticated, function(req, res){
    var eaddress = req.user.email;

    mysql.query('select user_id, nickname, grade from users where user_email=?', [eaddress], function(err, rows){
        if(err) console.error('err', err);
        console.log('rows',rows);

        if(rows.length > 0) {
            var uid = req.session.user_id = rows[0].user_id;
            var nickname = req.session.nickname = rows[0].nickname;
            var grade = req.session.grade = rows[0].grade;
            res.render('dashboard', { title: 'DayCare', nname: nickname, grade: grade, uid: uid});
        }else{
            console.log('facebook login success. unregistered email.');
            var smsg = eaddress + ' has not been registered. Please Sign up.';
            res.render('errorMsg', { title:'DayCare', hd:'', msg:smsg, url:'/', btnname:'To Login Page' });
        }
    })
});

// when facebook login fail
app.get('/login_fail', function(req, res){
    console.log('facebook login success. unregistered email.');
    var smsg = 'Facebook Login Fail. Return to Login Page.';
    res.render('errorMsg', { title:'DayCare', hd:'', msg:smsg, url:'/', btnname:'To Login Page' });
})

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    alert('Failure in Facebook Login. Return to Login.');
    res.redirect('/')
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

// File Upload API
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
            var sql = "update childs set imgsrc='/uploads/" + temp_path + "' where child_id='" + cid + "'";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    throw err;
                }
            })
        }
        return res.redirect('/profile?imgsrc=' + temp_path);
    });
})

// File Upload API in Messenger
app.post('/upload-msg-Photo', function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/uploads');
    form.keepExtensions = true;
    form.maxFieldsSize = 2 * 1024 * 1024;

    // parse a file upload
    form.parse(req, function(err, fields, files) {
    });
    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = path.basename(this.openedFiles[0].path);
        req.session.photopath = temp_path;
        /* The file name of the uploaded file */
        var file_name = this.openedFiles[0].name;
        var nm = req.session.nickname;
        var nd = new Date();
        var sd = nd.getFullYear() + "-" + (nd.getMonth()+1) + "-" + nd.getDate();
        var st = nd.getHours() + ":" + nd.getMinutes() + ":" + nd.getSeconds();

        if(nm) {   // when uploading completed, changed imgsrc of DB according child_id
            var sql = "insert into message (sender, mdate,mtime,imgsrc) value('"+nm+"','"+sd+"','"+st+"','/uploads/" + temp_path + "')";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    throw err;
                }
            })
        }

        res.json({sender:nm,
            mdate : sd,
            mtime : st,
            imgsrc : '/uploads/' + temp_path});
    });
})

// File Upload API in Report
app.post('/upload-report-Photo', function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/uploads');
    form.keepExtensions = true;
    form.maxFieldsSize = 2 * 1024 * 1024;

    // parse a file upload
    form.parse(req, function(err, fields, files) {
    });

    var comment = "";

    form.on('field',function(name,value){
        if(name == "comment"){ comment = value;};
        console.log('normal field / name = '+name+' , value = '+value);
    });

    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = path.basename(this.openedFiles[0].path);
        req.session.photopath = temp_path;
        /* The file name of the uploaded file */
//        var file_name = this.openedFiles[0].name;
        var nm = req.session.user_id;
        var nd = new Date();
        var sd = nd.getFullYear() + "-" + (nd.getMonth()+1) + "-" + nd.getDate();
        var st = nd.getHours() + ":" + nd.getMinutes() + ":" + nd.getSeconds();

        if(nm) {   // when uploading completed, changed imgsrc of DB according child_id
            var sql = "insert into report (cid,action_id,action_content,author, rdate,btime,imgsrc) " +
                "value('0','11','" + comment + "','" + nm+"','"+sd+"','"+st+"','/uploads/" + temp_path + "')";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    res.json({state : "False"});
                }
                res.json({
                    state : "success",
                    author: nm,
                    rdate : sd,
                    btime : st,
                    cid   : '0',
                    action_id: nm,
                    imgsrc: '/uploads/' + temp_path
                });
            })
        }
    });
})

// When saving Profile
app.post('/saveProfile', function(req, res) {
    console.log(req);
    var imgpath = req.body.imgpath;
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

            if (sibling == 'on') {  sql += " sibling='1', "; }
            else                 {  sql += " sibling='0', "; }
            sql += "'" + imgpath + "'";

            sql += " where child_id='" + cid + "'";

            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    //throw err;
                }
            });
            return res.redirect('/profile');
        }
        else {
            // if correct account, register user and redirect to next page
            var sql = "insert into childs (child_name,birthday,address,weight,height,allergies,medication,sibling,imgsrc) ";
            sql += " values('" + cname + "','" + birthday + "','" + address + "',";
            sql += "'" + weight + "','" + cheight + "','" + allergy + "',";
            if (medication == 'on') { sql += "'1',"; }
            else {                    sql += "'0',"; }

            if (sibling == 'on') { sql += "'1',"; }
            else {                 sql += "'0',"; }
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
                                }else{
                                    req.session.child_id = ncid;
                                    return res.redirect('/profile');
                                }
                            })
                        }
                    })
                }
            })
        }
    })
});

// when user answer is right, register user
app.post('/saveuser', signup.saveUser);

// when press button<profile>, show page<Profile>
app.get('/profile', function(req, res){
    var ipath = req.query.imgsrc;
    var nm = req.session.nickname;
    var grd = req.session.grade;
    var uid = req.session.user_id;

    global.mysql.query("select child_id from users where user_id='" + uid + "'", function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        console.log(rows);

        var chid = rows[0].child_id;
        global.mysql.query("select * from childs where child_id='" + chid + "'", function(err, rows) {
            if (err) {
                console.error(err);
                throw err;
            }
            console.log(rows);

            res.render('profile', { cdata : rows, nname: nm, grade : grd, imgpath : ipath });

        })
    })
});

// when press button <Add activity>
app.get("/add-activity", function(req, res){
    var userid = req.session.user_id;
    //res.render("report", {uid : userid});
    res.render("add_activity", {uid : userid});
})

// when press button <Report>
app.get("/report", function(req, res){
    var nname = req.session.nickname;

    if(req.session.grade == 3){
        res.render("child_report", {nm : nname});
    } else{
        res.render("admin_childlist", {nm : nname});
    }
})

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
    var uid = req.session.user_id;

    console.log("nicname=" + nickname+"  grade="+grade);

    res.render('dashboard', { title: 'DayCare', nname: nickname, grade: grade, uid: uid});
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
    //var grade  = req.session.grade;
    // when parent pressed <on my way>, push notification to owner and assists.

    res.render('location-sharing',{nname: nickname});
});

// when get childList
app.get('/getChildList', function(req, res){
    var uid = req.session.user_id;
    var grd = req.session.grade;

    if(grd == 3){
        sql = "SELECT cid, child_name, imgsrc FROM childs ,(SELECT child_id cid FROM users WHERE user_id='" +
            uid + "') AS b WHERE childs.child_id = cid order by cid";
        global.mysql.query(sql, function(err, rows){
            if(err){
                res.json({result : err});
            }

            res.json(rows);
        })
    }else{
        sql = "SELECT child_id cid, child_name, imgsrc FROM childs order by child_id";
        global.mysql.query(sql, function(err, rows){
            if(err){
                res.json({result : err});
            }

            res.json(rows);
        })
    }
})

// when get childData
app.get('/getChildData', function(req, res){
    var cids = req.query.cids;
    var cidlist = cids.split(',');
    var condition = " where ";
    for(var i=0; i < cidlist.length; i++){
        condition = condition + " child_id='" + cidlist[i] + "' or ";
    }
    condition = condition.substr(0, condition.length - 4);
    console.log(condition);
    var sql = "SELECT child_name cname, imgsrc FROM childs " + condition;
    global.mysql.query(sql, function(err, rows){
        if(err){
            res.json({result : err});
        }
        res.json(rows);
    })
})

// when call Action 1:note,2:naps,3:meal,4:diapers,5:bathroom,6:activity,7:medication,8:snapshots
app.get('/getAction', function(req, res){
    //"/getAction?action=" + action + "&cid=" + cid + "&stoday=" + stoday
    var action = req.query.action;
    var cid = req.query.cid;
    var stoday = req.query.stoday;

    var sql = "SELECT id,btime,etime,TIMESTAMPDIFF(MINUTE,btime,etime) during, author,action_content,action_note FROM report " +
        " WHERE cid='" + cid + "' AND action_id='" + action + "' AND rdate='" + stoday + "'";

    global.mysql.query(sql, function(err, rows){
        if(err){
            res.json({result : err});
        }else{
            res.json(rows);
        }

    })
})

// when search events with key
app.get('/search-event', function(req, res){
    var key = req.query.key;

    if(key == undefined || key == ""){
        res.json({result: 'Search key is empty.'});
        return;
    }

    var sql = "SELECT * FROM (SELECT c.*, d.`child_name` FROM " +
        "(SELECT b.user_id, b.`child_id`, b.`user_name`,a.`event`, a.`mdate`, a.`mtime`, a.`note` FROM EVENTS AS a " +
        " LEFT JOIN users AS b ON a.`user_id`=b.`user_id`) AS c " +
        " LEFT JOIN childs AS d ON d.`child_id`= c.`child_id`) AS e" +
        " WHERE (LOWER(e.user_name) LIKE LOWER('%" + key + "%')) OR (LOWER(e.child_name) LIKE LOWER('%" + key + "%')) " +
        " OR (LOWER(e.event) LIKE LOWER('%" + key + "%')) OR (LOWER(e.note) LIKE LOWER('%" + key + "%'))";

    global.mysql.query(sql, function(err, rows){
        if(err){
            res.json({result : err});
        }else{
            res.json(rows);
        }

    })
})

// when saving events
app.get('/save-event', function(req, res){
    var edate = req.query.edate;
    var etime = req.query.etime;
    var ename = req.query.ename;
    var enote = req.query.enote;
    var uid = req.query.uid;

    if(edate == '' || etime == '' || ename == '') {
        var smsg = 'Date "' + edate + '" Time "' + etime + '" Content "' + ename + '" is wrong. Retry it.';
        res.render('errorMsg', { title:'Daycare',hd:'Data Error', msg:smsg, url:'/calendar', btnname:'To Calendar' });
        return false;
    }

    ename = ename.replace(/'/gi, "`");
    enote = enote.replace(/'/gi, "`");

    var sql = "insert into events (mdate, mtime, event, note, user_id) values('"+edate+"','"+etime+"','"+ename+"','" + enote+"','" + uid +"')";
    console.log(sql);

    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            var smsg = 'Event data was not saved. Retry later.';
            res.render('errorMsg', { title:'Daycare',hd:'Data Saving Error', msg:smsg, url:'/calendar', btnname:'To Calendar' });
        }

        res.json({ result: "success" });
    })
});

// when editing existing note
app.post('/edit-note', function(req, res){
    var rid = req.body.rid;
    var rdate = req.body.rdate;
    var btime = req.body.btime;

    if(rdate == ''){
        res.json({result : 'Date is empty'});
        return false;
    }
    if(btime == ''){
        res.json({result : 'Time is empty'});
        return false;
    }

    var sql = "update report set rdate='" + rdate + "',btime='" + btime +"' where id='" + rid + "'";
    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            res.json({ result:'Inserting failure' });
        }
        res.json({result: "success"});
    })
});

// when inserting new note :action_id 1= arrive, 2=leave, 3=sleep, 4=wakeup
app.post('/new-note', function(req, res){
    var rdate = req.body.rdate;
    var btime = req.body.btime;
    var action_id = req.body.action_id;
    var cid = req.body.cid;
    var author = req.session.user_id;

    if(cid == ''){
        res.json({result : 'cid is empty'});
        return false;
    }
    if(rdate == ''){
        res.json({result : 'Date is empty'});
        return false;
    }
    if(btime == ''){
        res.json({result : 'Time is empty'});
        return false;
    }
    if(action_id*1 > 4){
        res.json({result : 'Action is wrong'});
        return false;
    }

    var sql = "insert into report (cid, rdate, btime, action_id, author) values('" +
        cid + "','" + rdate + "','" + btime + "','" + action_id + "','" + author + "')";
    console.log(sql);

    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            res.json({ result:'Inserting failure' });
        }
        var sql = "select id from report where cid='" + cid + "' and rdate='" + rdate + "' and btime='" + btime + "' and action_id='"+action_id+"'";
        console.log(sql);

        global.mysql.query(sql, function(err, rows) {
            res.json({result: "success", note_id: rows[0].id});
        })
    })
});

// when inserting new note :action_id 1= arrive, 2=leave, 3=sleep, 4=wakeup
app.post('/new-photo', function(req, res){
    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/uploads');
    form.keepExtensions = true;
    form.maxFieldsSize = 2 * 1024 * 1024;

    // parse a file upload
    form.parse(req, function(err, fields, files) {
    });

    var comment = "";
    var st = "";

    form.on('field',function(name,value){
        if(name == "comment"){ comment = value;};
        if(name == "btime"){ st = value;};
        console.log('normal field / name = '+name+' , value = '+value);
    });

    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = path.basename(this.openedFiles[0].path);
        req.session.photopath = temp_path;
        /* The file name of the uploaded file */
//        var file_name = this.openedFiles[0].name;
        var nm = req.session.user_id;
        var nd = new Date();
        var sd = nd.getFullYear() + "-" + (nd.getMonth()+1) + "-" + nd.getDate();

        if(nm) {   // when uploading completed, changed imgsrc of DB according child_id
            var sql = "insert into report (cid,action_id,action_content,author, rdate,btime,imgsrc) " +
                "value('0','11','" + comment + "','" + nm+"','"+sd+"','"+st+"','/uploads/" + temp_path + "')";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    res.json({state : "False"});
                }
                res.json({
                    state : "success",
                    author: nm,
                    rdate : sd,
                    btime : st,
                    cid   : '0',
                    action_id: nm,
                    imgsrc: '/uploads/' + temp_path
                });
            })
        }
    });
});

// when deleting existing note
app.post('/delete-note', function(req, res){
    var rid = req.body.rid;
    if(rid == ''){
        res.json({result : 'report id is empty'});
        return false;
    }
    var sql = "delete from report where id='" + rid + "'";
    global.mysql.query(sql, function(err, rows){
        if(err)  res.json({ result:'Deleting failure' });
        res.json({result: "success"});
    })
});

// when inserting new bottle, food, drink, potty, request, mood
app.post('/new-bottle', function(req, res){
    var rdate = req.body.rdate;
    var btime = req.body.btime;
    //var etime = req.query.etime;
    var action_id = req.body.action_id;
    var action_content = req.body.action_content;
    var cid = req.body.cid;
    var author = req.session.user_id;

    if(cid == ''){
        res.json({result : 'cid is empty'});
        return false;
    }
    if(rdate == ''){
        res.json({result : 'Date is empty'});
        return false;
    }
    if(btime == ''){
        res.json({result : 'Time is empty'});
        return false;
    }
    if(action_id =='' || action_id == undefined){
        res.json({result : 'Action is wrong'});
        return false;
    }
    if(action_content == '' || action_content == undefined) {
        res.json({result : 'Action content is empty'});
        return false;
    }

    action_content = action_content.replace(/'/gi, "`");

    var sql = "insert into report (cid, rdate, btime, action_id, action_content, author) values('" +
        cid + "','" + rdate + "','" + btime + ":00','" + action_id + "','" + action_content + "','" + author + "')";
    console.log(sql);

    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            res.json({ result:'Inserting failure' });
        }
        var sql = "select id from report where cid='" + cid + "' and rdate='" + rdate + "' and btime='" + btime + ":00' and action_id='" + action_id + "'";
        console.log(sql);

        global.mysql.query(sql, function(err, rows) {
            res.json({result: "success", note_id: rows[0].id});
        })
    })
});

// when updating new bottle, food, drink, potty, request, mood
app.post('/edit-bottle', function(req, res){
    var rdate = req.body.rdate;
    var btime = req.body.btime;
    var action_content = req.body.action_content;
    var rid = req.body.rid;

    if(rid == ''){ res.json({result : 'rid is empty'}); return false; }
    if(rdate == ''){ res.json({result : 'Date is empty'}); return false; }
    if(btime == ''){ res.json({result : 'Time is empty'}); return false; }
    if(action_content == '' || action_content == undefined) {
        res.json({result : 'Action content is empty'});
        return false;
    }

    var sql = "update report set rdate='"+rdate+"',btime='"+btime+"',action_content='"+action_content+"'" +
            " where id='"+rid+"'";
    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            res.json({ result:'Updating failure' });
        }
        res.json({result: "success"});
    })
});

// when inserting new bottle, food, drink, potty, request, mood
app.post('/delete-bottle', function(req, res){
    var rid = req.body.rid;

    if(rid == ''){ res.json({result : 'rid is empty'}); return false; }

    var sql = "delete from report where id='" + rid + "'";

    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            res.json({ result:'Deleting failure' });
        }
        res.json({result: "success"});
    })
});

// when deleting existing nap
app.get('/delete-nap', function(req, res){
    var nid = req.query.id;

    if(nid == ''){
        res.json({result : 'nid is empty'});
        return false;
    }

    var sql = "delete from report where id='" + nid + "' and action_id='2'";
    console.log(sql);

    global.mysql.query(sql, function(err, rows){
        if(err){
            console.log(err);
            res.json({ result:'Deleting failure' });
        }
        res.json({result: "success"});
    })
});

app.get('/chatting',function(req,res){
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

app.get('/get-event', function(req, res){
    var first = req.query.firstday, last = req.query.lastday;
    var sql = "select mdate, mtime, event, note from events where mdate between '" + first + "' and '" + last + "' order by mdate";
    global.mysql.query(sql, function(err, rows){
        if (err) {
            console.error(err);
            throw err;
        }
        res.json(rows);
    })
});

// when pressing TimeLine
app.get('/timeline', function(req, res){
    var nickname = req.session.nickname;
    res.render('timeline',{nname : nickname});
});

// when getting reports for Timeline
app.get('/get-report', function(req, res){
    var today= new Date(),
        stoday = today.getFullYear()+'-'+ (today.getMonth()+1)+'-'+today.getDate();

    var week1 = today;
    week1.setDate(today.getDate() - today.getDay());
    var sweek1 = week1.getFullYear()+'-'+ (week1.getMonth()+1)+'-'+week1.getDate();

    var cid = req.query.cid;

    var sql = "SELECT a.id rid, child_name,cid, rdate, btime, action_id, " +
        "action_content, action_note, author, a.imgsrc photo, b.imgsrc cphoto " +
        "FROM report AS a " +
        "LEFT JOIN childs AS b " +
        "ON a.cid=b.child_id " +
        "where (rdate between '" + sweek1 + "' and '" + stoday + "') and (cid='" + cid + "' or cid='0') " +
        "ORDER BY a.id";

    global.mysql.query(sql, function(err, rows){
        if(err) res.json({data: err});
        else    res.json({data : rows});
    })
});

// when getting reports for Report
app.get('/get-report-parent', function(req, res){
    var cdate = new Date(req.query.cdate);
    var cid = req.query.cid;
    var today= new Date();
    if (cdate > today) { res.json({data: "fail"}); return false;};

    //var sdate = cdate.getFullYear()+'-'+ (cdate.getMonth()+1)+'-'+cdate.getDate();
    var sdate = cdate.toISOString().split('T')[0];

    var sql = "SELECT a.id rid, child_name,cid, rdate, btime, action_id, " +
        "action_content, action_note, author, a.imgsrc photo, b.imgsrc cphoto " +
        "FROM report AS a " +
        "LEFT JOIN childs AS b " +
        "ON a.cid=b.child_id " +
        "where rdate='" + sdate + "' and (cid='" + cid + "' or cid='0') " +
        "ORDER BY a.id";

    global.mysql.query(sql, function(err, rows){
        if(err) res.json({data: err});
        else    res.json({data : rows});
    })
});

app.get("/get-food-list", function(req, res){
    var sql = "select food, icon from foods order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})

app.get("/get-drink-list", function(req, res){
    var sql = "select icon from drinks order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})

app.get("/get-request-list", function(req, res){
    var sql = "select icon from requests order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})

app.get("/get-mood-list", function(req, res){
    var sql = "select icon from moods order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})
//
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

    socket.on('joinroom',function(data) {
        console.log(data);
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
                data = {msg: nickname + ' was out.'};
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

        if(during == "1"){
            bdate.setDate(bdate.getDate()-7);
            edate = new Date();
        }else if(during=="2"){
            bdate.setDate(bdate.getDate()-14);
            edate.setDate(edate.getDate()-8);
        }else if(during=="3"){
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

        //var sql = "select sender, mdate,mtime,msg,imgsrc from message where room='" + room +"' and (mdate between '" + bstr + "' and '" + estr + "') order by id";
        var sql = "select sender, mdate,mtime,msg,imgsrc from message where (mdate between '" + bstr + "' and '" + estr + "') order by id";

        global.mysql.query(sql, function(err, rows){
            if (rows.length > 0){
                data.msg = "Messages( " + bstr + " ~ " + estr + " )\n";
                var socket_id = rooms[room].socket_ids[nickname];
                if (socket_id != undefined) {
                    io.to(socket_id).emit('broadcast_msg', data);
                    for(i=0; i < rows.length; i++){
                        data.msg = rows[i].msg;
                        data.sender = rows[i].sender;
                        data.mdate = rows[i].mdate;
                        data.mtime = rows[i].mtime;
                        data.imgsrc = rows[i].imgsrc;
                        io.to(socket_id).emit('broadcast_msg', data);
                    }// if
                }
            }
        })
    })

    socket.on('send_msg',function(data){
        var room = socket.room;
        var nickname = socket.nickname;
        var msg = data.msg;

        if(nickname != undefined && room != undefined ) {
            console.log('in send msg room is ' + room);

            var d = new Date();
            var sdate = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
            var stime = d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();

            data.sender = nickname;
            data.mdate = sdate;
            data.mtime = stime;
            data.msg = msg;
            if (data.to == 'ALL') socket.broadcast.to(room).emit('broadcast_msg', data); // send to other clients except self
            else {
                // whisper
                var socket_id = rooms[room].socket_ids[data.to];
                if (socket_id != undefined) {
                    io.to(socket_id).emit('broadcast_msg', data);
                }// if
            }

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
// when upload photo
    socket.on('send_photo',function(data){
        var room = socket.room;
        socket.broadcast.to(room).emit('broadcast_msg', data);
        socket.emit('broadcast_msg', data);
    });    //
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
