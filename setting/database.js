var config = require('../config');

var mysql   = require('mysql');

function handleMysqlDisconnect() {
    global.mysql = mysql.createConnection(config.MYSQL_CONFIG);  // Recreate the connection, since
    // the old one cannot be reused.
    global.mysql.connect(function(err) {              // The server is either down
        if(err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleMysqlDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        }

        // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
                                            // If you're also serving http, display a 503 error.
    global.mysql.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            handleMysqlDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });
}

handleMysqlDisconnect();