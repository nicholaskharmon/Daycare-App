 exports.saveUser = function(req, res) {
    //console.log(req);
    var email = req.body.email;
    var username = req.body.username;
     var phonenumber = req.body.phonenumber;
     var gender = req.body.gender;
     var pwd = req.body.pwd1;
     var nickname = req.body.nickname;

    var sql = "select * from users where user_email='" + email;
     sql +=  "' and user_name='" + username + "'";
     sql +=  " and phonenumber='" + phonenumber + "'";
     //sql +=  "' and user_pwd='" + pwd + "'";
    global.mysql.query(sql, function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        //res.json(rows);

        var cnt = rows.length;

        if(cnt > 0) {
            // if can not find user, show message
            return res.redirect('/signup_error');
        }

        // if correct account, register user and redirect to next page
        var sql = "insert into users (user_email,user_name, phonenumber,gender,user_pwd, nickname) ";
        sql += " values('" + email + "','" + username + "','" + phonenumber + "',";
        if (gender == "Father") {
            sql += "'f'";
        }else{
            sql += "'m'";
        }
        sql += ",'" + pwd + "','" + nickname + "')";

        global.mysql.query(sql, function(err, rows) {
            if (err) {
                console.error(err);
                //return res.redirect('/change_pwd_error');
                //throw err;
            }else {
                return res.redirect('/dashboard');
            }
        });

    });
};
