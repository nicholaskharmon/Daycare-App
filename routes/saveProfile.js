 exports.uploadData = function(req, res) {
    ////console.log(req);
    var cname = req.body.cname;
    var birthday = req.body.birthday;
    var address = req.body.address;
    var weight = req.body.weight;
    var cheight = req.body.cheight;
    var allergy = req.body.allergy;
    var medication = req.body.medication;
    var sibling = req.body.sibling;
     var imgpath = req.body.hfilename;
     var cid = req.session.child_id;
     var uid = req.session.user_id;

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
                sql += " sibling='1', ";
            } else {
                sql += " sibling='0', ";
            }
            sql += "imgsrc='" + imgpath + "' where child_id='" + cid + "'";

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
};
