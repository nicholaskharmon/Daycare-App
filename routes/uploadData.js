 exports.uploadData = function(req, res) {
    ////console.log(req);
    var cname = req.body.cname;
    var birthday = req.body.birthday;
    var address = req.body.address;
    var weight = req.body.weight;
    var cheight = req.body.cheight;
    var allergy = req.body.allergy;
    var medication = req.body.medication.checked;
    var sibling = req.body.sibling.checked;

    var sql = "select * from childs where child_name='" + cname;
     sql +=  "' and birthday='" + birthday + "'";
     sql +=  " and address='" + address + "'";

    global.mysql.query(sql, function(err, rows) {
        if (err) {
            console.error(err);
            throw err;
        }
        //res.json(rows);

        var cnt = rows.length;

        if(cnt > 0) {
            // if can not find user, show message
            return res.redirect('/child_exist');
        }

        // if correct account, register user and redirect to next page
        var sql = "insert into childs (child_name,birthday,address,weight,height,allergies,medication,sibling) ";
        sql += " values('" + cname + "','" + birthday + "',";
        sql += "'" + weight + "','" + cheight + "','" + allergy + "',";
        if (medication == true) {
            sql += "'1',";
        }else{
            sql += "'0',";
        }
        if (sibling == true) {
            sql += "'1')";
        }else{
            sql += "'0')";
        }

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
