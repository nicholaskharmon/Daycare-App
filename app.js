var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');
var restapi = require('./routes/restapi');
var verifyuser = require('./routes/verifyuser');
var sendSMS = require('./routes/sendSMS');
var signup = require('./routes/signup');

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
        callbackURL : 'http://localhost:8005/auth/facebook/callback'    // 8005 : port that server listening
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
            //Check whether the User exists or not using profile.id
            //Further DB code.
            return done(null, profile);
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
app.use(session({ secret: 'keyboard cat', key: 'sid'}));
app.use(passport.initialize());
app.use(passport.session());

//app.get('/', function(req, res){
//    res.render('index', { user: req.user });
//});
//
//app.get('/account', ensureAuthenticated, function(req, res){
//    res.render('account', { user: req.user });
//});

app.get('/auth/facebook', passport.authenticate('facebook',{scope:'email'}));
app.get('/auth/facebook/callback',
    // need attension !!!
    // successRedirect : case of facebook login success
    // failureRedirect : case of facebook login failure
    passport.authenticate('facebook', { successRedirect : '/dashboard', failureRedirect: '/' }),
    function(req, res) {
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
// when user answer is right, register user
app.post('/saveuser', signup.saveUser);
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
