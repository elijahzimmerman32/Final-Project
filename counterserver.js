//express Server
const express = require('express')
const app = express()
const port = 3000
const webRoot = 'webRoot';
const fs = require("fs");
const path = require('path');
const https = require('https');

//to run local tunnel
//Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope Process
//lt --port 3000

//handle requests
const req = require('express/lib/request');

//body parser
const bodyparser = require('body-parser');
app.use(bodyparser.urlencoded({extended: true}));
app.use(bodyparser.json());

//sqlite3
const sqlite3 = require('sqlite3').verbose();

//express session
const session = require('express-session');
const { time } = require('console');
const { json } = require('express');
const config = {MaxLoginTries: 5, AccountLockout: 20*60*1000, SessionTimeOut: 10*60*1000}

app.use(session({
    secret: 'keyUSEDtoHASHsessionId',  
    name:    'app.session.id',
    resave:  false,
    saveUninitialized: false,
  
    cookie: { 
      httpOnly: true
      // ,secure: true
      // ,sameSite: strict
      // ,maxAge: 60*1000 
    }
  }));

function ClearSession( req ) {
    if (! req.session)
        return;

    req.session.isLoggedIn   = false;
    req.session.isAdmin      = false;
    req.session.user         = '';
    req.session.lastRequest = '2000-01-01 00:00:00';
}

function SendInvalidLogin(res, user, msg)
{
    // only show message while debugging
    //msg = 'Invalid login';

    fs.readFile(path.join(__dirname, 'webroot', 'login.html'), 'utf8', function(err, data) {
        if (err) {
            res.sendStatus(404);
        } else {
  
            data = data.replace( "const user = '';", `const user = '${user}';`);
            data = data.replace( "const statusMessage = '';", `const statusMessage = '${msg}';`);
  
            res.send(data);
        }
    });
}

function SendInvalidRegister(res, user, msg)
{
    // only show message while debugging
    //msg = 'Invalid login';

    fs.readFile(path.join(__dirname, 'webroot', 'register.html'), 'utf8', function(err, data) {
        if (err) {
            res.sendStatus(404);
        } else {
  
            data = data.replace( "const user = '';", `const user = '${user}';`);
            data = data.replace( "const statusMessage = '';", `const statusMessage = '${msg}';`);
  
            res.send(data);
        }
    });
}

function isValidSessionRequest( req, res, reqAdmin, redirect ) {
    let validated = false;

    let currentTime = new Date();

    //console.log( 'isValidSessionRequest | ', req.session );

    if (req.session && req.session.isLoggedIn && ((req.session.isAdmin == 1) || ! reqAdmin))
    {
        let sessionLastRequest = Date.parse(req.session.lastRequest)

        validated = (currentTime - sessionLastRequest <= config.SessionTimeOut);
    } 

    if (! validated)
    {   
        if (redirect)
            res.redirect( "/login.html" )
        else
            res.sendStatus(401);  // Unauthorized
        return false;
    }
    else {
        req.session.lastRequest = currentTime
        return true;
    }
}

let results = {};

function getData() {
    let holdresults = {};
    let db = new sqlite3.Database('usercount.sqlite');
    let sql = 'SELECT user, lastLoginAttempt, count FROM Counts'
    db.all(sql, (err, rows) => {
        if (err) {
        console.error(err.message);
        }
        else {
            rows.forEach((row) => {
                holdresults[row.user] = {user: row.user, count: row.count,  LastSeen: row.lastLoginAttempt}
                
            });
            results = holdresults;
            console.log(results)
            db.close()
        }
    });
};

getData();
let interval = setInterval(getData, 10*1000);



//Routing
app.use( (req, res, next) => {
    console.log( req.url );
    next();
});

app.get('/', (req, res) => {
  res.redirect("/login.html")
});

app.post('/login.html', (req, res) => {
    ClearSession(req);
    let userInfo = {};
    let test = {};
    let user = req.body.user;
    let password = req.body.password;
    console.log(user, password)


    ///debug the username/password
    if (! user || ! password)
    {
        SendInvalidLogin(res, user, "Missing username or password");
        return
    }

    ///// connecting to database
    let db = new sqlite3.Database('usercount.sqlite', (err) => {
        if (err) {
          return console.error(err.message);
        }
        //console.log('Connected to the usercount.sqlite database.');
        });

    /// Time of login request
    currentLoginTime = 'UPDATE datetime_text SET d = datetime("now","localtime") WHERE timenow = 0'
    db.run(currentLoginTime, function(err) {
        if (err) {
            return console.error(err.message);
        }
        //console.log(`Row(s) updated: ${this.changes}`);
        });

    /// create access to userinformation
    let sql = `SELECT * FROM Counts WHERE user = ?`;
    db.get(sql, [user], (err, row) => {
        if (err) {
            return console.error(err.message), userInfo;
        }
        else {
            userInfo = row;
            
            //console.log(row.user, row.password)
    
        ///No Username with this title
        if (userInfo == test)
            {
                SendInvalidLogin(res, user, 'Invalid username');
                return
            }

        datetime = "SELECT * FROM datetime_text WHERE timenow = 0"
        

        ///// setting current time so we can compare vs last accessed
        db.get(datetime, (err, row) => {
            if (err) {
                return console.error(err.message);
            }
            currentTimeSQL = row.d
            //console.log(row);

            // undefined if first login attempt
            if (! userInfo.lastLoginAttempt)
                userInfo.lastLoginAttempt = currentTimeSQL;
            
            // potential lockout expired?
            if (Date.parse(currentTimeSQL)-Date.parse(userInfo.lastLoginAttempt) > config.AccountLockout)
            {
                userInfo.badcount = 0;
            }
            /// Account Locked
            if (userInfo.badcount >= config.MaxLoginTries)
            {
                SendInvalidLogin(res, user, 'Account locked out' );
                return
            }

            //Password is wrong
            if (userInfo.password != password)
            {
                userInfo.badcount++;
                SendInvalidLogin(res, user, 'Invalid Password');
            }
            else
            {
                req.session.isLoggedIn  = true;
                req.session.isAdmin     = userInfo.isAdmin;
                req.session.user        = user;
                req.session.lastRequest = currentTimeSQL;

            if (userInfo.isAdmin == 1)
            {
                qs = (userInfo.isAdmin == 1) ? '?admin=1' : '';
            }
            else
            {
                qs = user ? `?user=${user}` : '';
            }
            
            res.redirect(`/counter.html${qs}`)
            }

            // updating the database with badcount and last login attempt
            let sql2 = `UPDATE Counts SET badcount = ${userInfo.badcount}, lastLoginAttempt = datetime("now","localtime") WHERE user = ?`;
            db.run(sql2, [user], function(err) {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`Row(s) updated: ${this.changes}`);
                /// closing sqlite connection
                db.close((err) => {
                    if (err) {
                    return console.error(err.message);
                    }
                    //console.log('Closed the database connection.');
                });
                });
                });
        }
        });

    
});

app.get("/register", (req, res) => {
    ClearSession(req)

    res.redirect("/register.html")
  });

app.post("/register.html", (req, res) => {
    let registery = req.body
    console.log(registery)
    let user = registery.user
    let password = registery.password

    if (! registery.user || ! registery.password || ! registery.confirmpassword)
    {
        SendInvalidRegister(res, user, 'Missing Username or Passwords')
        return
    }

    if (registery.confirmpassword != registery.password)
    {
        SendInvalidRegister(res, user, 'Passwords do not match')
        return
    }

    if (registery.user == registery.password)
    {
        SendInvalidRegister(res, user, 'Username and Password Cannot Be the Same')
        return
    }

    let db = new sqlite3.Database('usercount.sqlite', (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log('Connected to the usercount.sqlite database.');
    });

    let sql = `SELECT user FROM Counts`;
    let users = [];
    db.all(sql, (err, rows) => {
        if (err) {
        return console.error(err.message);
        }
        else {
            rows.forEach((row) => {
                //console.log(row.user);
                users.push(row.user);
            });

            if (users.includes(user)) {
                SendInvalidRegister(res, user, 'Username Taken')
                return
            }
            else {
                let sql2 = `INSERT INTO Counts (user, password, count, isAdmin, lastLoginAttempt, badcount) VALUES (?,?,0,0,datetime("now","localtime"),0)`;
                db.run(sql2, [user, password], function(err) {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log(`Row(s) updated: ${this.changes}`);
                });   
            }
        }   
    });

    db.close((err) => {
        if (err) {
        return console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
    console.log(req.session)
    if (req.session.isAdmin == 1) {
        res.json({'user': user})
    }
    else 
    {
        res.redirect("/login.html")
    }
});



app.get('/logout.html', (req, res) => {
    ClearSession(req);

    res.redirect("/login.html")
  });

app.get('/admin', (req, res) => {
    if (isValidSessionRequest(req, res, true, true))
        res.redirect("/admin.html")
        //res.sendFile(path.join(__dirname, 'webroot', 'admin.html'));
  });

app.get('/counter.html', (req, res) => {
    if (! isValidSessionRequest(req, res, false, true))
        return;
    else {
        res.sendFile(path.join(__dirname, 'webroot', 'counter.html'));
    }
});

app.post('/counter.html', (req, res) => {
    
    let dict = req.body
    console.log(dict.user)

    //Opening Connection
    let db = new sqlite3.Database('usercount.sqlite', (err) => {
    if (err) {
      return console.error(err.message);
    }
    //console.log('Connected to the usercount.sqlite database.');
    });

    let sql = `SELECT * FROM Counts WHERE user = ?`;

    db.get(sql, [dict.user], (err, row) => {
        if (err) {
          return console.error(err.message);
        }
        else {
            //console.log(row.count, row.user)
            res.json(row.count)
        }
    });

    //closing Database connection when done
    db.close((err) => {
        if (err) {
        return console.error(err.message);
        }
        //console.log('Closed the database connection.');
    });
    
});

app.post('/count', (req, res) => {
    if (! isValidSessionRequest(req, res, false, true)){
       return;}


    let order = req.body
    console.log(order)

    //Opening Connection
    let db = new sqlite3.Database('usercount.sqlite', (err) => {
        if (err) {
          return console.error(err.message);
        }
        //console.log('Connected to the usercount.sqlite database.');
        });
    
    let sql = `UPDATE Counts SET count=count+${parseInt(order.command)} WHERE user = ?`;

    if (parseInt(order.command) == 0)
        {
            sql = `UPDATE Counts SET count=0 WHERE user = ?`;
        }

    db.run(sql, [order.user], function(err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Row(s) updated: ${this.changes}`);

        let sql2 = `SELECT * FROM Counts WHERE user = ?`;

        db.get(sql2, [order.user], (err, row) => {
            if (err) {
                return console.error(err.message);
            }
            else {
                console.log(row.user, row.count)
                res.json(row.count)
            }
        });    
    });
    //closing Database connection when done
    db.close((err) => {
            if (err) {
            return console.error(err.message);
            }
            //console.log('Closed the database connection.');
    });
});

app.delete('/deleteuser/:user', (req, res) => {
    if (! isValidSessionRequest(req, res, true, false))
        return;

    let user = req.params.user;
    
    if (user == "admin"){
        res.sendStatus(405);  // Cannot Delete Admin
        return
    }

    let db = new sqlite3.Database('usercount.sqlite')
    sql = 'DELETE FROM Counts WHERE user = ?'
    db.run(sql, [user], function(err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Row(s) updated: ${this.changes}`);
        res.status(200); //
        res.json({User: user})
        db.close()
    });
    

});

app.get('/logout.html', (req, res) => {
    ClearSession(req);

    res.redirect("/login.html")
});

app.get('/users', (req, res) => {
    if (! isValidSessionRequest(req, res, true, false))
        return;
    

    res.json( results );
});

app.use(express.static('webRoot'));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
});