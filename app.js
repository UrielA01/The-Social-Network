var express = require("express");
var bodyParser = require('body-parser');
var encrypt_pass = require('./encrypt_pass');
var mysqlHandler = require('./mysqlHandler');
const session = require('express-session');
var cookieParser = require('cookie-parser');
var express_validator = require('express-validator');
const {
    check,
    validationResult
} = require('express-validator/check');
var path = require("path");
const multer = require("multer");
var fs = require("fs");


const upload = multer({
    dest: "final project/images/"
    // you might also want to set some limits: https://github.com/expressjs/multer#limits
});



var app = express();

//cookie parser
app.use(cookieParser());

//get the current date
function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;

}

function uploadImage(file){
    const tempPath = file.path;
    const targetPath = path.join(__dirname, "./uploads/" + file.originalname);

    if (path.extname(file.originalname).toLowerCase() === ".png") {
        fs.rename(tempPath, targetPath, err => {
            if (err) return err;
            return "name: ";
        });
    } else {
        fs.unlink(tempPath, err => {
            if (err) return err;
            return "Only png files are allowed";
        });
    }
}

//set view engine
app.set("view engine", "ejs");

//set views
app.set('views', path.join(__dirname, './views'));

app.use(express.static('uploads/'));

//body parser
app.use(bodyParser.json());
var urlencodedParser = bodyParser.urlencoded({
    extended: false
});

//validator
// app.use(express_validator());

// register the session with it's secret ID
app.use(session({
    secret: '',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false
    }
}));

//render index.ejs
app.get('/', function (req, res) {
    var query = "SELECT * FROM posts ORDER BY id DESC";
    //select all posts
    mysqlHandler.executeQuery(query, function (err, rows) {
        if (err) throw err;
        res.render('index', {
            error: req.session.error,
            user: req.session.user,
            posts: rows
        });
        req.session.error = "";
        req.session.save();
    });
});

//render signup.ejs
app.get('/signup', function (req, res) {
    res.render('usersystem/signup', {
        error: req.session.error,
        user: req.session.user
    });
});

//get post request sign up information by post request
app.post('/signup', urlencodedParser, [
        //check(["email","firstName","lastName","password","birthDay"]).isEmpty().withMessage("One of the parameters is empty"),
        check('email').custom(email => {
            return mysqlHandler.executeQueryAsync("SELECT * FROM users WHERE email = ?", [email]).then(rows => {
                if (rows.length > 0) {

                    return Promise.reject('Email already in use');
                }
            })
        }).isEmail().withMessage("Email is not valid"),
        check(["firstName", "lastName"]).isAlpha().withMessage("Name is not valid"),
        check('password').isLength({
            min: 8,
            max: 32
        }).withMessage("Password length must be between 8 to 32"),
        check("birthDay").isISO8601().withMessage("birthDay is not valid")
    ],
    function (req, res) {
        if (!req.body) redirect("/");
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).render('usersystem/signup', {
                error: errors.array()[0].msg
            });
        }
        //gets the user information vals.password is set to undefined because it should be the hash password
        var plainPass = req.body.password;
        var vals = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: undefined,
            birthDay: req.body.birthDay,
            joined: getDateTime()
        };
        req.session.user = {
            loggedIn: true,
            id: undefined,
            firstName: vals.firstName,
            lastName: vals.lastName,
            email: req.body.email,
            status: 0
        }
        //hash the password and store it in vals.password
        encrypt_pass.cryptPassword(plainPass, function (err, hash) {
            if (err) throw err;
            vals.password = hash;
            var query = "INSERT INTO users SET ?";
            //insert all the data to database
            mysqlHandler.executeQuery(query, vals, function (err, rows) {
                if (err) {
                    req.session.user = undefined;
                    req.session.save();
                    throw err;
                }
                req.session.user.id = rows.insertId;
                res.redirect('/');
            });
        });
});

//render login.ejs
app.get('/login', function (req, res) {
    res.render('usersystem/login', {
        error: req.session.error,
        user: req.session.user
    });
});


//get post request sign up information by post request
app.post('/login', urlencodedParser, function (req, res) {
    if (!req.body) redirect("/");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("shit");
        return res.status(422).render('usersystem/login', {
            error: errors.array()[0].msg
        });
    }
    var query = "SELECT * FROM users WHERE email = ?";
    var loginVals = [req.body.email];
    //first callback - check if the email exists in the DB, if so get the hash password and check if that's 
    mysqlHandler.executeQuery(query, loginVals, function (err, rows) {
        if (err) throw err;
        if (rows.length > 0) {
            if (rows[0].status == -1) {
                req.session.error = "you got banned from this community"
                res.redirect("/");
                return;
            }
            var hashWord = rows[0].password;
            var plainPass = req.body.password;
            encrypt_pass.comparePassword(plainPass, hashWord, function (err, isMatch) {
                if (err) {
                    throw err;
                }
                if (isMatch) {
                    req.session.error = "success";
                    req.session.user = {
                        loggedIn: true,
                        id: rows[0].id,
                        firstName: rows[0].firstName,
                        lastName: rows[0].lastName,
                        email: req.body.email,
                        status: rows[0].status
                    }
                    res.redirect('/');
                } else {
                    res.render('usersystem/login', {
                        error: "Email or password incorrect"
                    });
                }
            });
        } else {
            res.render('usersystem/login', {
                error: "Email or password incorrect"
            });
        }
    });
});

//page with user information
app.get('/userpg', function (req, res) {
    var id = req.query.uid;
    var query = "SELECT * FROM users WHERE id = ?";
    var vals = [id];
    //first callback - check if the email exists in the DB, if so get the hash password and check if that's 
    mysqlHandler.executeQuery(query, vals, function (err, rows) {
        if (err) throw err;
        if (rows.length > 0) {
            var query = "SELECT * FROM posts WHERE user_id = ?";
            mysqlHandler.executeQuery(query, vals, function (err, posts) {
                res.render('usersystem/user_page', {
                    error: "",
                    info: rows,
                    posts: posts,
                    user: req.session.user
                });
            });
        } else {
            res.render('usersystem/user_page', {
                error: "User doesn't exist"
            });
        }
    })
});

app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect('/');
});


app.get('/upload_post', function (req, res) {
    if (typeof req.session.user === 'undefined') {
        res.redirect('/');
    } else {
        res.render('upload_post', {
            error: req.session.error,
            user: req.session.user
        });
    }
});

//get post request sign up information by post request
app.post('/upload_post', upload.single("image"), urlencodedParser, function (req, res) {
    if (!req.body || typeof req.session.user === 'undefined') res.redirect("/");
    var query = "SELECT * FROM users WHERE id = ?";
    mysqlHandler.executeQueryAsync("SELECT * FROM users WHERE id = ?", req.session.user.id).then(rows => {
        if(rows[0].status != -1){
            if (typeof req.file === "undefined") {
                var vals = {
                    title: req.body.title,
                    content: req.body.content,
                    user_id: req.session.user.id,
                    uploader: req.session.user.firstName + " " + req.session.user.lastName,
                    uploaded: getDateTime()
                }
                var query = "INSERT INTO posts SET ?";
                //insert all the data to database
                mysqlHandler.executeQuery(query, vals, function (err, rows) {
                    if (err) {
                        throw err;
                    }
                    req.session.error = "Post uploaded successfully";
                    res.redirect("/");
                });
                return;
            }
            const tempPath = req.file.path;
            const targetPath = path.join(__dirname, "./uploads/" + req.file.originalname);

            if (path.extname(req.file.originalname).toLowerCase() === ".png") {
                fs.rename(tempPath, targetPath, err => {
                    if (err) return err;
                    var vals = {
                        title: req.body.title,
                        content: req.body.content,
                        picture: req.file.originalname,
                        user_id: req.session.user.id,
                        uploader: req.session.user.firstName + " " + req.session.user.lastName,
                        uploaded: getDateTime()
                    }
                    var query = "INSERT INTO posts SET ?";
                    //insert all the data to database
                    mysqlHandler.executeQuery(query, vals, function (err, rows) {
                        if (err) {
                            throw err;
                        }
                        req.session.error = "Post uploaded successfully";
                        res.redirect("/");
                    });
                });
            } else {
                fs.unlink(tempPath, err => {
                    if (err) return err;
                    req.session.error = "Only png files are allowed";
                    res.redirect("/");
                });
            }
        }else{
            req.session.destroy();
            res.redirect("/");
        }
    })
    
});

app.get('/admins', function (req, res) {
    if (!req.session.user) {
        res.redirect("/");
        return;
    } else if (req.session.user.status !== 1) {
        res.redirect("/");
        return;
    }
    var query = "SELECT * FROM users WHERE status!=-1";
    mysqlHandler.executeQuery(query, [], function (err, users) {
        if (err) throw err;
        query = "SELECT * FROM users WHERE status=-1";
        mysqlHandler.executeQuery(query, [], function (err, banned_users) {
            if (err) throw err;
            query = "SELECT * FROM reports";
            mysqlHandler.executeQuery(query, [], function (err, reports) {
                if (err) throw err;
                res.render("admins_panel", {
                    error: req.session.error,
                    users: users,
                    banned_users: banned_users,
                    reports: reports,
                    user: req.session.user
                });
                req.session.error = "";
                req.session.save();
            });
        });
    });
});

app.get('/report', function (req, res) {
    if (!req.session.user) {
        res.redirect("/");
        return;
    } else if (!req.query.p || !req.query.u) {
        res.redirect("/");
        return;
    }
    res.render("report", {
        error: "",
        user: req.session.user
    })
});

//report a user
app.post('/report', urlencodedParser, function (req, res) {
    if (!req.body || typeof req.session.user === 'undefined') return res.sendStatus(400);
    if (req.body.upid.split(" ")[0] == req.session.user.id) {
        req.session.error = "You can't report yourself";
        res.redirect("/");
        return;
    }
    var vals = {
        reporter_id: req.session.user.id,
        reported_user: req.body.upid.split(" ")[0],
        reported_post: req.body.upid.split(" ")[1],
        reason: req.body.reasons
    }
    var query = "INSERT INTO reports SET ?";
    //insert all the data to database
    mysqlHandler.executeQuery(query, vals, function (err, rows) {
        if (err) {
            throw err;
        }
        req.session.error = "Report submitted successfully";
        res.redirect("/");
    });
});


app.post('/ban', urlencodedParser, function (req, res) {
    if (!req.body || typeof req.session.user === 'undefined') return res.sendStatus(400);
    if (req.session.user.status != 1) {
        res.redirect("/");
        return;
    }
    if (req.session.user.id == req.body.reported_user) {
        req.session.error = "You can't ban yourself";
        res.redirect("/admins");
        return;
    }
    if (typeof req.body.unban !== "undefined") {
        var query = "UPDATE users SET status=0 WHERE id=?";
        mysqlHandler.executeQuery(query, [req.body.uid], function (err, rows) {
            if (err) {
                req.session.error = err;
                res.redirect("/");
                return;
            }
            req.session.error = "UnBanned successfully";
            res.redirect("/");
            return;
        });
    } else if (typeof req.body.deleteOnly !== "undefined") {
        var query = "DELETE FROM posts WHERE id=?;";
        mysqlHandler.executeQuery(query, [req.body.reported_post], function (err, rows) {
            if (err) {
                throw err;
            }
            query = "DELETE FROM reports WHERE reported_post=?;";
            //update the report to solved
            mysqlHandler.executeQuery(query, [req.body.reported_post], function (err, rows) {
                if (err) {
                    throw err;
                }
                req.session.error = "Post deleted successfully";
                res.redirect("/");
            });
        });
    }
    else {
        var query = "UPDATE users SET status=-1 WHERE id=?";
        //ban the user
        mysqlHandler.executeQuery(query, [req.body.reported_user], function (err, rows) {
            if (err) {
                throw err;
            }
            query = "DELETE FROM posts WHERE id=?;";
            //delete the post
            mysqlHandler.executeQuery(query, [req.body.reported_post], function (err, rows) {
                if (err) {
                    throw err;
                }
                query = "DELETE FROM reports WHERE reported_user=?;";
                //update the report to solved
                mysqlHandler.executeQuery(query, [req.body.reported_user], function (err, rows) {
                    if (err) {
                        throw err;
                    }
                    req.session.error = "Banned successfully";
                    res.redirect("/");
                });
            });
        });
    }
});

app.post("/image", upload.single("filetoupload"), function (req, res) {
    
});


app.listen(3000);