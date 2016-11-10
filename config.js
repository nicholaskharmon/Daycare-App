
exports.REDIS_CONFIG = {
    host: '127.0.0.1',
    port: 6379,
}

exports.MYSQL_CONFIG = {
    host     : 'localhost',
    user     : 'root',
    password : '',
    port     : 3306,
    database : 'sunshine_daycare'
};

//exports.TIMEZONE = 'Asia/Dubai';

var fs = require('fs');
var xml2js   = require("xml2js");

var self = this;
exports.readSetting = function() {
    console.log('read setting');

    var parser = new xml2js.Parser();

    var xml = fs.readFileSync('config.xml', 'utf-8');

    parser.parseString(xml, function(err, result) {
        console.log(result);

        self.MYSQL_CONFIG.host = result.config.mysql[0].host[0];
        self.MYSQL_CONFIG.user = result.config.mysql[0].user[0];
        self.MYSQL_CONFIG.port = result.config.mysql[0].port[0];
        self.MYSQL_CONFIG.password = result.config.mysql[0].password[0];
        self.MYSQL_CONFIG.database = result.config.mysql[0].database[0];
    });
}


this.readSetting();
