 exports.changePWD = function(req, res) {
    //console.log(req);
    var email = req.body.email;
    var username = req.body.username;
    var phonenumber = req.body.phonenumber;
    var newpwd = req.body.newpwd;

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

        if(cnt == 0) {
            // if can not find user, show message
            return res.redirect('/change_pwd_error');
        }

        // if correct account, change password and redirect to next page
        var sql = "update users set user_pwd='"+ newpwd + "'";
        sql += " where user_email='" + email + "'";
        sql +=  " and user_name='" + username + "'";
        sql +=  " and phonenumber='" + phonenumber + "'";

        global.mysql.query(sql, function(err, rows) {
            if (err) {
                console.error(err);
                return res.redirect('/change_pwd_error');
                //throw err;
            }else {
                return res.redirect('/dashboard');
            }
        });
        //alert("userid is "+user_id);
    });
};
