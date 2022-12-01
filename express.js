//express Server
const express = require('express')
const app = express()
const port = 3000

const bodyparser = require('body-parser');
const req = require('express/lib/request');

app.use(bodyparser.urlencoded({extended: true}));
app.use(bodyparser.json());

//sqlite3
const sqlite3 = require('sqlite3').verbose();

//Routing
app.use( (req, res, next) => {
    console.log( req.url );
    next();
});

app.get('/', (req, res) => {
  res.redirect("/login.hmtl")
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
})