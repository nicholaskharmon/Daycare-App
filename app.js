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

// for mail-sending
var nodemailer = require('nodemailer');
var generator = require('xoauth2').createXOAuth2Generator({
    user: 'iceberg198819@gmail.com',
    clientID: '235649864040-3cvic98rl7cjpjooasei2kj20apl995e.apps.googleusercontent.com',
    clientSecret: 'Y9nrwSgHJqvAd5H51HVk9v4_',
    refreshToken: '1/BiK9J7K6IDp6sG054s0oGjWopZxjDWf_TBitxC1rWVU',
    accessToken: 'ya29.Ci_JAyHIhwfyn5PzzjUtuO9qlfTkgzPT0XHQlu6-rqikrtrxh_fLUVHi7FoOSrqYJw'
});

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

// mail server
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
//app.post('/sendSMS', sendSMS.changePWD);

app.post('/sendSMS', function(req, res){

// listen for token updates
// you probably want to store these to a db
    generator.on('token', function(token){
        generator = require('xoauth2').createXOAuth2Generator({
            user: 'iceberg198819@gmail.com',
            clientID: '235649864040-3cvic98rl7cjpjooasei2kj20apl995e.apps.googleusercontent.com',
            clientSecret: 'Y9nrwSgHJqvAd5H51HVk9v4_',
            refreshToken: token.refreshToken
        });
        console.log('New token for %s: %s', token.user, token.accessToken);
    });


// login
    var transporter = nodemailer.createTransport(({
        service: 'gmail',
        auth: {
            xoauth2: generator
        }
    }));

// setup e-mail data with unicode symbols
    var mailOptions = {
        from: '"Yu Yang" <iceberg198819@gmail.com>', // sender address
        to: '<gross0109414@yandex.com>', // list of receivers
        subject: 'Hello Yu Yang', // Subject line
        text: 'Did you recieve my invitation mail? Please send your answer.', // plaintext body
        html: '<b>Thanks and regards</b>' // html body
    };

// send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });});

app.get('/selectPhoto', function(req, res){
    res.render('selectPhoto', { title: 'DayCare' });
});

// File Upload API
app.post('/uploadPhoto', function(req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/uploads');
    form.keepExtensions = true;
    form.maxFieldsSize = 2 * 1024 * 1024;

    var cid;
    // parse a file upload
    form.parse(req, function(err, fields, files) {
        //res.writeHead(200, {'content-type': 'text/plain'});
        //res.write('Upload received :\n');
        //res.end(util.inspect({fields: fields, files: files}));
    });

    form.on('field',function(name,value){
        if(name == "cid"){ cid = value;};
    });

    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = path.basename(this.openedFiles[0].path);
        req.session.photopath = temp_path;
        /* The file name of the uploaded file */
        var file_name = this.openedFiles[0].name;
        if(cid == undefined ) cid = req.session.child_id;

        if(cid) {   // when uploading completed, changed imgsrc of DB according child_id
            var sql = "update childs set imgsrc='/uploads/" + temp_path + "' where child_id='" + cid + "'";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    throw err;
                }
            })
        }
        res.json({imgsrc : '/uploads/' +temp_path});
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

// When updating child Profile in admin side
app.post('/update-child-data', function(req, res) {
    console.log(req);
    var imgpath     = req.body.imgpath;
    var cname       = req.body.name;
    var nickname    = req.body.nickname;
    var gender      = req.body.gender;
    var birthday    = req.body.birthday;
    var address     = req.body.address;
    var city        = req.body.city;
    var state       = req.body.state;
    var zipcode     = req.body.zipcode;
    var firstattend = req.body.firstattend;
    var lastattend  = req.body.lastattend;
    var tuition     = req.body.tuition;
    var weight      = req.body.weight;
    var cheight     = req.body.height;
    var cid = req.body.cid;

    // if can not find user, show message
    var sql = "update childs set child_name='" + cname + "', ";
    sql += "nickname='" +nickname + "', gender='" +gender+ "',";
    sql += " birthday='" + birthday + "', address='" + address + "',";
    sql += " city='" + city + "', state='" + state + "',";
    sql += " zipcode='" + zipcode + "', firstattend='" + firstattend + "',";
    sql += " lastattend='" + lastattend + "', tuition='" + tuition + "',";
    sql += " weight='" + weight + "', height='" + cheight + "',";
    sql += " imgsrc='" + imgpath + "'";
    sql += " where child_id='" + cid + "'";

    global.mysql.query(sql, function (err, rows) {
        if (err) { console.error(err); res.json({result:err}); }
        res.json({result : "success"});
    });
});

// When updating child Profile in admin side
app.post('/get-child-data', function(req, res) {
    console.log(req);
    var cid = req.body.cid;

    // if can not find user, show message
    var sql = "select child_name,nickname,gender,birthday,address,city," +
        "state,zipcode,firstattend,lastattend,tuition,weight,height,imgsrc " +
        " from childs where child_id='" + cid + "'";

    global.mysql.query(sql, function (err, rows) {
        if (err) { console.error(err); res.json({result:err}); }
        else res.json(rows);
    });
});

// update child emergancy action from server side
app.post('/update-emergency', function(req, res){
    var cid = req.body.cid, emerg = req.body.emerg, kind = req.body.kind;
    var sql = "insert into child_emergency (child_id, emer_id, emer_item) " +
        " value('" + cid + "','" + kind + "','" + emerg + "')";

    global.mysql.query(sql, function(err, rows){
        if(err) {
            console.log(err); res.json({result : err})
        }else{
            res.json({result : "success"});
        }
    })
})

// delete child emergancy action from server side
app.post('/delete-emergency', function(req, res){
    var cid = req.body.cid;
    var sql = " delete from child_emergency where child_id='" + cid + "'";

    global.mysql.query(sql, function(err, rows){
        if(err) {
            console.log(err); res.json({result : err})
        }else{
            res.json({result:'success'});
        }
    })
})

// get child emergancy action from server side
app.post('/get-emergency', function(req, res){
    var cid = req.body.cid, kind = req.body.kind;
    var sql = "select emer_item from child_emergency where child_id='" + cid + "' and emer_id='" +kind+ "'";

    global.mysql.query(sql, function(err, rows){
        if(err) { console.log(err); res.json({result : err}) }
        else res.json(rows);
    })
})

// get user data from sercer side
app.post('/get-parent-data',function(req, res){
    var cid = req.body.cid, gender = req.body.gender;

    var sql = "select * from users where child_id='"  + cid + "' and gender='" + gender + "'";
    global.mysql.query(sql,function(err, rows){
        if(err) res.json({result:err});
        else res.json(rows);
    })
})

// when change user data from sercer side
app.post('/update-parent-data',function(req, res){
    var cid = req.body.cid, gender = req.body.gender,
        name = req.body.name, phonenumber = req.body.phone,
        address = req.body.address, city = req.body.city,
        state = req.body.state, zipcode = req.body.zipcode,
        employer = req.body.employer, workphone = req.body.workphone,
        workaddress = req.body.workaddress, workcity = req.body.workcity,
        workstate = req.body.workstate, workzip = req.body.workzip;

    var sql = "update users set user_name='" + name + "',phonenumber='" + phonenumber + "'," +
        "address='" + address + "',city='" + city + "',state='" + state + "',zipcode='" + zipcode + "'," +
        "employer='" + employer + "',workphone='" + workphone + "',workaddress='" + workaddress + "'," +
        "workcity='" + workcity + "',workstate='" + workstate + "',workzipcode='" + workzip + "'" +
        " where child_id='"  + cid + "' and gender='" + gender + "'";
    global.mysql.query(sql,function(err, rows){
        if(err) res.json({result:err});
        else res.json({result:'success'});
    })
})

// when save child's doctor data
app.post('/save-doctor-data', function(req, res){
    var cid = req.body.cid, name = req.body.name,
        phone = req.body.phone, address = req.body.address,
        city = req.body.city, state = req.body.state,
        zipcode = req.body.zipcode, medical = req.body.medical,
        insure_number = req.body.insure_number;
    var sql = "select child_id from child_doctor where child_id='" + cid + "'";
    global.mysql.query(sql, function(err, rows){
        if(rows.length > 0){
            sql = "update child_doctor set name='" + name + "', " +
                "phone='" + phone + "', address='" + address + "', city='" + city + "', " +
                "state=" + state + ",zipcode='" + zipcode + "', medical='" + medical + "', " +
                "insure_number='" + insure_number + "' where child_id='" + cid + "'";
            global.mysql.query(sql, function(err, rows){
                if(err) res.json({result:err});
                else res.json({result:'success'});
            })
        }else{
            sql = "insert into child_doctor (child_id,name,phone,address,city,state,zipcode,medical,insure_number) " +
                " value('"+ cid + "','" + name + "','" + phone + "','" + address + "','" + city + "'," +
                "'" + state + "','" + zipcode + "','" + medical + "','" + insure_number + "')";
            global.mysql.query(sql, function(err, rows){
                if(err) res.json({result:err});
                else res.json({result:'success'});
            })
        }
    })
})

// get child's doctor's data
app.post('/get-doctor-data', function(req, res){
    var cid = req.body.cid;
    var sql = "select * from child_doctor where child_id='" + cid + "'";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:err});
        else res.json(rows);
    })
})

// when save child's emergency contact 1
app.post('/save-emcontact-data', function(req, res){
    var cid = req.body.cid, kind = req.body.kind, name = req.body.name,
        phone = req.body.phone, address = req.body.address, city = req.body.city,
        state = req.body.state, zipcode = req.body.zipcode, relation = req.body.relation;

    // check if existing
    var sql = "select child_id from child_emergency_contact where child_id='" + cid + "' and kind='" + kind + "'";

    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:err});
        else if (rows.length > 0){   // when exist, update
            sql = "update child_emergency_contact set name='" + name + "',phone='" + phone + "' " +
                ",address='" + address + "',city='" + city + "',state='" + state + "' " +
                ",zipcode='" + zipcode + "',relation='" + relation + "' " +
                " where child_id='" + cid + "' and kind='" + kind + "'";
            global.mysql.query(sql, function(err, rows){
                if(err){ res.json({result: err}); return}
                else res.json({result:'success'});
            })
        }else{   // when not exist, insert
            sql = "insert into child_emergency_contact (child_id,kind,name,phone,address,city,state,zipcode,relation) " +
                " value('"+ cid +"','" + kind +"','" +name +"','" +phone +"','" +address +"','" +city +"','" +state +"','" +zipcode +"','" +relation+"')";
            global.mysql.query(sql, function(err, rows){
                if(err){ res.json({result: err}); return}
                else res.json({result:'success'});
            })
        }
    })
})

// when save child's emergency contact 1
app.post('/get-emcontact-data', function(req, res){
    var cid = req.body.cid, kind = req.body.kind;
    // check if existing
    var sql = "select * from child_emergency_contact where child_id='" + cid + "' and kind='" + kind + "'";

    global.mysql.query(sql, function(err, rows){
            if(err){ res.json({result: err}); return}
            else res.json(rows);
    })
})

// when user answer is right, register user
app.post('/saveuser', signup.saveUser);

// when click profile button in admin-dashboard
app.get('/select-profile', function(req, res){
    res.render('select_child_profile');
})

// when press button<profile>, show page<Profile>
app.get('/profile', function(req, res){
//    var ipath = req.query.imgsrc;
    var cid = req.query.cid;
    //
    //var nm = req.session.nickname;
    //var grd = req.session.grade;
    //var uid = req.session.user_id;
    //
    //if(cid == undefined || cid == ''){
    //    global.mysql.query("select child_id from users where user_id='" + uid + "'", function(err, rows) {
    //        if (err) { console.error(err); throw err; }
    //        global.mysql.query("select * from childs where child_id='" + rows[0].child_id + "'", function(err, rows) {
    //            if (err) { console.error(err); throw err; }
    //            res.render('profile', { cdata : rows, nname: nm, grade : grd, imgpath : ipath });
    //        })
    //    })
    //}else{
    //    global.mysql.query("select * from childs where child_id='" + cid + "'", function(err, rows) {
    //        if (err) { console.error(err); throw err; }
    //        res.render('profile', { cdata : rows, nname: nm, grade : grd, imgpath : ipath });
    //    })
    //}
    res.render('profile', {cid: cid});
});

// when press button <Add activity in admin dashboard>
app.get("/admin-activity", function(req, res){
    res.render("select_child_activity");
})

// when press button <Add activity>
app.get("/add-activity", function(req, res){
    var userid = req.session.user_id;
    res.render("add_activity", {uid : userid});
})

// when press button <Report>
app.get("/user-report", function(req, res){
    var nname = req.session.nickname;
    var cid = req.query.cid;

    res.render("child_report", {nm : nname});
})

// when press button <Report>
app.get("/admin-report", function(req, res){
    var nname = req.session.nickname;
    res.render("select_child_report", {nm : nname});
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

    //console.log("nicname=" + nickname+"  grade="+grade);
    //
    if(grade < 3)
        res.render('admin_dashboard', { title: 'DayCare', nname: nickname, grade: grade, uid: uid});
    else
        res.render('parent_dashboard', { title: 'DayCare', nname: nickname, grade: grade, uid: uid});
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
// when get Foodlist from table foods
app.get('/getfoodlist',function(req, res){
    var sql = "select food,icon from foods order by id";
    global.mysql.query(sql, function(err,rows){
        if(err) res.json({result:err});
        else res.json(rows);
    })
})
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

// save new photo and return  url
app.post('/new-photo', function(req, res){
    var form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/uploads');
    form.keepExtensions = true;
    form.maxFieldsSize = 2 * 1024 * 1024;

    // parse a file upload
    form.parse(req, function(err, fields, files) {
    });

    var comment = "", st = "", groupcheck = true;

    form.on('field',function(name,value){
        if(name == "comment"){ comment = value;};
        if(name == "btime"){ st = value;};
        if(name == "group"){ groupcheck = value;};
        console.log('normal field / name = '+name+' , value = '+value);
    });

    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = path.basename(this.openedFiles[0].path);
        req.session.photopath = temp_path;
        /* The file name of the uploaded file */
//        var file_name = this.openedFiles[0].name;
        res.json({
            state : "success",
            imgsrc: '/uploads/' + temp_path
        });
    });
});

// when inserting new note :action_id 1= arrive, 2=leave, 3=sleep, 4=wakeup
app.post('/new-photo-register', function(req, res){
    var cid = req.body.cid,     btime = req.body.btime;
    var author = req.session.user_id, bdate = req.body.bdate;
    var cont = req.body.cont,   url = req.body.url;

    var sql = "insert into report (cid,action_id,action_content,author, rdate,btime,imgsrc) " +
        "value('"+cid+"','11','" + cont + "','" + author+"','"+bdate+"','"+btime+"','" + url + "')";
    global.mysql.query(sql, function (err, rows) {
        if (err) {
            console.error(err);
            res.json({state : "False"});
        }
        res.json({ state : "success"  });
    })
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

app.get('/select-chat',function(req,res){
    var nickname = req.session.nickname;
    res.render('select_chatting',{room:'Staff', nname : nickname});
});

app.get('/chatting',function(req,res){
    var cid = req.session.child_id;
    var uid = req.session.user_id;
    var grade = req.session.grade;
    var nickname = req.session.nickname;
    var roomname;
    //******** in case of admin
    var nm = req.query.nname;
    var rname = req.query.room;
    var vcid = req.query.cid;
    //*****************************

    if(nickname== undefined){
        res.render('errorMsg',
            { title: 'DayCare',
                hd : "Not Signed in yet.",
                msg: "Please SignIn.",
                url: "/",
                btnname:"Return to Login Page"
            });
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
                var ss = childname.split(' ');
                childname = ss[0].charAt(0).toUpperCase() + ss[0].substring(1);

                if(ss.length > 1) // get child name as Lenon G. from lenono gay
                    childname += ' ' + ss[1].charAt(0).toUpperCase()+'.';

                console.log('room name is : ' + childname + 'nickname=' + nickname);

                roomname = childname + ' Chat';

                res.render('parent_chatting',{room:roomname, nname : nickname, cid:cid});
            })
        }
    } else {
        res.render('admin_chatting',{room: rname, nname: nm, cid:vcid});
    }
});

// get phonenumber of father and mother of child
app.get('/get-phone-number/:cid', function(req, res){
    var cid = req.params.cid;
    console.log("child_id="+cid);
    var sql = "SELECT phonenumber, gender FROM users WHERE child_id='" + cid + "'";
    global.mysql.query(sql, function(err, rows){
        console.log(rows);
        for(var i=0; i< rows.length; i++){
            var fnum = '', mnum = '';
            if(rows[i].gender == 'f') fnum = rows[i].phonenumber;
            if(rows[i].gender == 'm') mnum = rows[i].phonenumber;
        }
        res.json({fatherNumber: fnum, motherNumber:mnum});
    })
})

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
    var sql = "select drink, icon from drinks order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})

app.get("/get-request-list", function(req, res){
    var sql = "select reqname, icon from requests order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})

app.get("/get-mood-list", function(req, res){
    var sql = "select mood,icon from moods order by id";
    global.mysql.query(sql, function(err, rows){
        if(err) res.json({result:"failure"});
        else res.json(rows);
    })
})
// get user's child's photo url
app.get('/get-child-photo/:user',function(req, res){
    var user = req.params.user;
    if(user==undefined || user == '') {
        res.json({msg: ''});
    }else{
        var sql = "SELECT imgsrc FROM childs AS a " +
            ", (SELECT child_id FROM users WHERE nickname='" + user + "') AS b" +
            " WHERE a.`child_id`=b.`child_id`";
        global.mysql.query(sql, function(err, rows){
            if(rows.length > 0) res.json({url: rows[0].imgsrc});
            else res.json({url:''});
        })
    }
})
// get user's last messsage
app.get('/getLastMsg',function(req, res){
    var nickname = req.query.nickname;
    var cid = req.query.cid;
    if(nickname==undefined || nickname == '') {
        res.json({msg: ''});
    }else{
        var sql = "select id from message where sender='" + nickname + "' and in_out='1' order by id desc limit 0,1";
        global.mysql.query(sql, function(err, rows){
            if(rows.length == 0) res.json({msg: 'Error'});
            else {
                var lastID = rows[0].id;
                sql = "select count(id) cnt from message where sender='" + nickname + "' and in_out='0' and id>='" + lastID + "'";
                global.mysql.query(sql, function(err, rows){
                    console.log(rows[0].cnt);
                    res.json({msg: rows[0].cnt, cid:cid });
                })
            }
        })
    }
})

// get surename and user_id
app.post('/getSureName', function(req, res){
    var nickname = req.body.nickname;
    var sql = "select user_name from users where nickname='" + nickname + "'";
    global.mysql.query(sql, function(err, rows){
        console.log(rows);
        res.json(rows);
    })
})
//
app.post('/select_during', function(req, res){ //{during: $('#during').val()});
    var during = req.body.during;
    var bdate = new Date(), edate = new Date();

    during = during * 1;
    bdate.setDate(bdate.getDate()-(during + 1)*7 );
    edate.setDate(edate.getDate()-during * 7);

    var bstr = "";
    var estr = "";
    bstr = bdate.getFullYear() + "-" + (bdate.getMonth()+1) + "-" + bdate.getDate();
    estr = edate.getFullYear() + "-" + (edate.getMonth()+1) + "-" + edate.getDate();

    //var sql = "select sender, mdate,mtime,msg,imgsrc from message where room='" + room +"' and (mdate between '" + bstr + "' and '" + estr + "') order by id";
    var sql = "select sender, mdate,mtime,msg,imgsrc from message where (mdate between '" + bstr + "' and '" + estr + "') order by id";

    global.mysql.query(sql, function(err, rows){
        if (rows.length > 0){ res.json(rows) };
    })
})



// ---------------- start of group chatting server ----------------------

var count = 0;
var rooms = [];

io.sockets.on('connection',function(socket){
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
        var cid = data.cid;

        //var nickname = 'guest-'+count;
        var nickname = data.nickname;

        socket.room = room;
        socket.nickname = nickname;
        socket.cid = cid;

        socket.emit('changename', {nickname: nickname});

        var dt = new Date();
        var sdate = dt.getFullYear()+"-"+(dt.getMonth()+1)+"-"+dt.getDate();
        var stime = dt.getHours() + ":" + dt.getMinutes()+":00";

        // Create Room
        if (rooms[room] == undefined) {
            console.log('room create :' + room);
            rooms[room] = new Object();
            rooms[room].socket_ids = new Object();

            // record room-open-time into db
            var sql = "insert into message (sender, mdate, mtime, room, in_out)";
            sql += " values('" + nickname + "','" + sdate + "','" +
                    stime + "','" + room + "','1')";

            global.mysql.query(sql, function (err, rows) {
                if (err) { console.error(err);}
            })
        }
        // Store current user's nickname and socket.id to MAP
        rooms[room].cid = cid;
        rooms[room].socket_ids[nickname] = socket.id;

        // broadcast join message
        data = { msg: nickname + ' entered in room ' + room + '.'};
        io.sockets.in(room).emit('broadcast_msg', data);

        io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});

        if(room != 'Staff') // when parent creates a room, inform it to staff
            io.sockets.in('Staff').emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
    });

    socket.on('get-room-user-list',function(){
        var roomnames = Object.keys(rooms); // namelist of all rooms
        var usernames = [];
        var cids = [];  // for getting phonenumber
        for (var i=0; i<roomnames.length; i++){
            var ur = Object.keys(rooms[roomnames[i]].socket_ids); // all nicknames in that room
            console.log(ur);
            usernames.push(ur);
            cids.push(rooms[roomnames[i]].cid);
        }
        io.sockets.in('Staff').emit('roomuserlist', {rooms: roomnames, users:usernames, cids:cids});
    })

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
        var nickname = socket.nickname;
        console.log("disconnect room=" + room + " nickname="+nickname);

        if(room != undefined && rooms[room] != undefined){

            console.log('nickname ' + nickname + ' has been disconnected\n');
            // broad cast <out room> message
            if (nickname != undefined) {
                if (rooms[room].socket_ids != undefined
                    && rooms[room].socket_ids[nickname] != undefined){
                    delete rooms[room].socket_ids[nickname];

                    var dt = new Date();
                    var sdate = dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate();
                    var stime = dt.getHours()+':'+dt.getMinutes()+':00';

                    // record room-out-time into db
                    var sql = "insert into message (sender, mdate, mtime, room, in_out)";
                    sql += " values('" + nickname + "','" + sdate + "','" +
                        stime + "','" + room + "','2')";

                    global.mysql.query(sql, function (err, rows) {
                        if (err) { console.error(err);}
                    })

                }

            }// if
           // if(room == 'Staff'){
            data = {msg: nickname + ' was out.'};
            io.sockets.in(room).emit('broadcast_msg', data);
            io.sockets.in(room).emit('userlist', {users: Object.keys(rooms[room].socket_ids)});

            if(room != 'Staff') // when parent creates a room, inform it to staff
                io.sockets.in('Staff').emit('userlist', {users: Object.keys(rooms[room].socket_ids)});
         //   }
        }
    });

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
            if (data.to == 'ALL')
                socket.broadcast.to(room).emit('broadcast_msg', data); // send to other clients except self
            else {
                // whisper
                socket_id = rooms[room].socket_ids[data.to];
                if (socket_id != undefined) {
                    io.to(socket_id).emit('broadcast_msg', data);
                    //io.sockets.socket(socket_id).emit('broadcast_msg', data);
                }// if
            }

            // save msg into DB
            var sql = "insert into message (sender, reciever, mdate, mtime, msg, room)";
            sql += " values('" + nickname + "','" + data.to + "','";
            sql += sdate + "','" + stime + "','" + data.msg + "','" + room + "')";

            global.mysql.query(sql, function (err, rows) {
                if (err) { console.error(err);}
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
