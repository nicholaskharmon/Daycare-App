var express = require('express');
var path = require('path');
var mime = require('mime');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var fs = require('fs');
//var fstools = require('fs-tools');
var formidable = require('formidable')

var index = require('./routes/index');
var users = require('./routes/users');
var restapi = require('./routes/restapi');
var verifyuser = require('./routes/verifyuser');
var sendSMS = require('./routes/sendSMS');
var signup = require('./routes/signup');
var saveProfile = require('./routes/saveProfile');

//for Facebook Login
var passport          =     require('passport');
var util              =     require('util');
var FacebookStrategy  =     require('passport-facebook').Strategy;
var session           =     require('express-session');
//--------------

app = express();

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
app.use(session({ secret: 'todayandfuture', key: 'sid',saveUninitialized: false}));
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

//app.listen(3000);
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

        if(cid) {
            var sql = "update childs set imgsrc='" + temp_path + "' where child_id='" + cid + "'";
            global.mysql.query(sql, function (err, rows) {
                if (err) {
                    console.error(err);
                    throw err;
                }

            })
        }
        /* Location where we want to copy the uploaded file */
        //var new_location = 'e:/uploads/';

        //fs.copy(temp_path, new_location + file_name, function(err) {
        //    if (err) {
        //        console.error(err);
        //    } else {
        //        console.log("success!")
        //    }
        //});
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
            if (medication == 'on') {
                sql += " medication='1', ";
            } else {
                sql += " medication='0', ";
            }
            if (sibling == 'on') {
                sql += " sibling='1' ";
            } else {
                sql += " sibling='0' ";
            }
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
    var chid = req.session.child_id;
    global.mysql.query("select * from childs where child_id='" + chid + "'", function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        console.log(rows);
        res.render('profile', { title: 'DayCare', cdata : rows  });

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
    res.render('dashboard', { title: 'DayCare' });
});

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
