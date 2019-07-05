var mysql = require('mysql');

// var pool = mysql.createPool({
//     connectionLimit: 5,
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'final_project',
//     dateStrings: true
// });

// exports.executeQuery = function (query, vals, callback) {
//     pool.getConnection(function (err, connection) {
//         if (err) {
//             throw err;
//         }
//         connection.query(query, vals, function (err, rows, fields) {
//             if (err) {
//                 throw err;
//             }
//             callback(null, rows);
//             connection.release();
//         });
//     });
// }

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: 'final_project',
    dateStrings: true
});

con.connect(function (err) {
    if (err) throw err;

});

exports.executeQuery = function (query, vals, callback) {
    con.query(query, vals, function (err, rows, fields) {
        if (err) throw err;
        callback(null, rows);
    });
}

exports.executeQueryAsync = function (query, vals) {
    return new Promise((resolve, reject) => {
            con.query(query, vals, function (err, rows, fields) {
                if (!err) {
                    resolve(rows);
                }
            });
        });
}
