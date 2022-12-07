//express Server
const express = require('express')
const app = express()
const port = 3000
const webRoot = 'webRoot';
const fs = require("fs");
const path = require('path');
const https = require('https');

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
const config = {MaxLoginTries: 5, AccountLockout: 20*60*1000, SessionTimeOut: 5*60*1000}

//for python code
let {PythonShell} = require('python-shell')

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
    req.session.lastRequest = '2000-01-01T00:00:00.000Z';
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

    ///// connecting to database
    let db = new sqlite3.Database('usercount.sqlite', (err) => {
        if (err) {
          return console.error(err.message);
        }
        //console.log('Connected to the usercount.sqlite database.');
        });

    /// Time of login request
    currentLoginTime = 'UPDATE datetime_text SET d = datetime("now") WHERE timenow = 0'
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
    
        ///debug the username/password
        if (! user || ! password)
        {
            SendInvalidLogin(res, user, "Missing username or password");
            return
        }
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

                //need to update counter with correct account
            fs.readFile(path.join(__dirname, 'webroot', 'counter.html'), 'utf8', function(err, data) {
                if (err) {
                    res.sendStatus(404);
                } else {
            
                    data = data.replace( "const user = '';", `const user = '${user}';`);
                    res.send(data);
                }
            })
                
                qs = (userInfo.isAdmin == 1) ? '?admin=1' : '';
                res.redirect(`/counter.html${qs}`)
            }

            // updating the database with badcount and last login attempt
            let sql2 = `UPDATE Counts SET badcount = ${userInfo.badcount}, lastLoginAttempt = datetime("now") WHERE user = ?`;
            db.run(sql2, [user], function(err) {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`Row(s) updated: ${this.changes}`);
                });

                });
        }
        });

    /// closing sqlite connection
    db.close((err) => {
        if (err) {
        return console.error(err.message);
        }
        //console.log('Closed the database connection.');
    });


    
});

app.post('/counter.html', (req, res) => {
    let dict = req.body
    
    console.log(dict.user)

    //Opening Connection
    let db = new sqlite3.Database('usercount.sqlite', (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Connected to the usercount.sqlite database.');
    });

    let sql = `SELECT * FROM Counts WHERE user = ?`;

    db.get(sql, [dict.user], (err, row) => {
        if (err) {
          return console.error(err.message);
        }
        else {
            console.log(row.count, row.user)
            res.json(row.count)
        }
    });
    

    //closing Database connection when done
    db.close((err) => {
        if (err) {
        return console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
    
});

app.post('/count', (req, res) => {
    let order = req.body
    console.log(order)

    //Opening Connection
    let db = new sqlite3.Database('usercount.sqlite', (err) => {
        if (err) {
          return console.error(err.message);
        }
        console.log('Connected to the usercount.sqlite database.');
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
            console.log('Closed the database connection.');
    });
});

app.use(express.static('webRoot'));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
});