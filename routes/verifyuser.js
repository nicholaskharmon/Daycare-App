 exports.verify = function(req, res) {
    //console.log(req);
    var email = req.body.email;
    var pwd = req.body.pwd;

    var sql = "select user_id, child_id from users where user_email='" + email + "' and user_pwd='" + pwd + "'";
    global.mysql.query(sql, function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        //res.json(rows);

        var user_id = 0, child_id = 0;
        for (var i = 0; i < rows.length; i++) {
            user_id = rows[i].user_id;
            child_id =rows[i].child_id;
        };

        if(user_id == 0) {
            // if can not find user, show message
            return res.redirect('/passerror');
        }

        // store user_id in session

        // if correct account, redirect next page
        req.session.user_id = user_id;
        req.session.child_id = child_id;
        return res.redirect('/dashboard');
        //alert("userid is "+user_id);
    });
};
