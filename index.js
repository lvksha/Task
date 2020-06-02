var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var session = require('express-session');
// const port = process.env.PORT||3000
app.use(bodyParser.json({ type: 'application/*+json' }));       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
var uuid = require('uuid');
const { Client } = require('pg')
app.use(express.static(__dirname));
app.use(express.static(__dirname + "/public")); //using express
app.use(session({
    secret: 'keyboard cat cat key 9876543210',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 900000 }
}))

const client = new Client({
    user: 'postgres',
    // host: 'database.server.com',
    host: 'localhost',
    database: 'mainDB',
    password: 'pass',
    port: 5432,
})
client.connect();
var useruid;
var userimg;
var lk = io.of('/liked');

var userblockeduid;
var Alldata = {};
var total = 0;
var likeduid;
var superlikeduid=null;



app.get("/", (req, res) => {

    if (req.session.uid !== null && req.session.uid !== undefined) {
      
        async function getdata() {
            await client.query('SELECT * FROM public."Interaction"', function (err, Results) {
                if (err) {
                    console.log(err);
                    // res.render(__dirname + "/public/register.ejs");
                    return;
                }
                else {
                    var count=0;
                    total = Results.rowCount - 2
                    Results.rows.forEach(row => {
                        if (row.uid === req.session.uid) {
                            console.log(useruid)
                            userblockeduid = row.blocked_uid;
                            userimg=row.image_link;
                            useruid=row.uid;
                        } else {
                            // console.log(row)

                            Alldata[count] = { uid: row.uid, image: row.image_link, blocked: row.blocked_uid, superliked: row.superliked_uid };
                            count++;
                        }

                    })
                    // console.log(Alldata)
                    io.on('connection', function (socket) {
                        socket.emit('load', { total: total, userblockeduid: userblockeduid, useruid: req.session.uid, Alldata: Alldata });
                        //Whenever someone disconnects this piece of code executed
                        socket.on('disconnect', function () {
                            console.log('A user disconnected from io');
                        });
                    });
                    lk.on('connection',function(socketlk){
    
                        socketlk.on(useruid, function(data) {
                            likeduid=data.likeduid;  
                            console.log(useruid+"jisne-=-=--jisko"+likeduid)
                            
                         })
                         setInterval(() => {
                            if(likeduid){         
                                socketlk.emit(likeduid,{info:useruid+"liked you"});
                                console.log("liked notification send from SERVER"+likeduid);
                                likeduid=null;
                             }
                         }, 1000);
                         
                         socketlk.on('disconnect', function () {
                            console.log('A user disconnected from liked');
                        });
                        
                    })
                    var slk = io.of('/superliked');
                    slk.on('connection',function(socketslk){
                        console.log("connected"+ req.session.uid);
                        // socketslk.emit('useruid',{useruid:req.session.uid});
                        socketslk.on(req.session.uid, function(data) {
                           console.log(data.superlikeduid)
                            superlikeduid=data.superlikeduid;  
                            console.log(req.session.uid+"jisne-=-SUPER=--jisko"+superlikeduid);
                            // emitsuper(superlikeduid);
                     
                            
                        })
                        setInterval(() => {
                            if(superlikeduid !==null ){
                                socketslk.emit(superlikeduid,{image:userimg,info:req.session.uid});            
                                console.log("SUPER liked notification send from SERVER"+superlikeduid);
                                superlikeduid=null;
                            }
                        }, 1000);
                       
                        socketslk.on('disconnect', function () {
                            console.log('A user disconnected from superliked');
                        });

                })
            }
            
        })
        
        }
        getdata(); 
        res.render(__dirname + "/public/main.ejs");
        return;
    } else {
        res.redirect('/login');
    }

})


app.get("/login", (req, res) => {
    if (req.session !== null) {
        req.session.destroy(function (err) {
        })
    }
    res.render(__dirname + "/public/login.ejs");
    return;
})
app.post("/login", (req, res) => {
    let email = req.body.email.toLowerCase();
    let password = req.body.password;
    client.query('SELECT * from public."User" where email=' + "'" + email + "'", function (err, Results) {
        if (err) {
            console.log("An error ocurred accessing user cred. during login");
            console.log(err);
            return;
        } else {

            if (Results.rowCount == 1 && Results.rows[0].password == password) {
                useruid=Results.rows[0].uid;
                req.session.email = email;
                req.session.uid = Results.rows[0].uid;
               res.redirect('/')
               
            } else {
                res.send("Recheck Your Credentials.<br> <a href='/login'>Retry Again </a>");//TODO
                //   res.render(__dirname+"/public/login.ejs",{message:"Recheck Your Credentials"});//TODO
                return;
            }
        }
    });

})
app.get('/register', function (req, res) {
    if (req.session !== null) {
        req.session.destroy(function (err) { });
        res.render(__dirname + "/public/register.ejs")
        return;
    }

    res.render(__dirname + "/public/register.ejs")
    return;
});
app.post('/register', function (req, res) {
    var email = req.body.email.toLowerCase();
    var password = req.body.password

    client.query('SELECT * from public."User" where email=' + "'" + email + "'", function (err, Results) {
        if (err) {
            console.log(err);
            res.render(__dirname + "/public/register.ejs");
            return;
        }
        else {

            var uid = uuid.v1();
            if (Results.rowCount == 0) {
                client.query('INSERT INTO public."User" (uid, email, password) VALUES (' + "'" + uid + "','" + email + "','" + password + "')", function (err, Plots) {
                    if (err) {
                        console.log("An error ocurred accessing plots");
                        console.log(err);
                        client.query('DELETE FROM public."User" WHERE email = ' + "'" + email + "'", function (err, result) { });
                        res.send("Error occured" + err + "<br> <a href='/register'>Go back</a>");
                        return;
                    }
                    else {
                        client.query('INSERT INTO public."Interaction" (uid) VALUES (' + "'" + uid + "')", function (err, Plots) {
                            if (err) {
                                console.log("An error ocurred accessing plots");
                                console.log(err);
                                client.query('DELETE FROM public."User" WHERE email = ' + "'" + email + "'", function (err, result) { });
                                client.query('DELETE FROM public."Interaction" WHERE uid = ' + "'" + uid + "'", function (err, result) { });
                                res.send("Error occured" + err + "<br> <a href='/register'>Go back</a>");
                                return;
                            }
                            else {
                                res.redirect("/login");
                            }
                        })

                    }
                })

            } else {
                res.send("Email Already Taken.<br> <a href='/register'>Try Again with diiferent email</a>");

            }
        }
    })

});

app.get("/logout", function (req, res) {
    if (req.session !== null) {
        req.session.destroy(function (err) {
        })
    }
    res.redirect("/login");
    return;
});

http.listen(8888, function () {
    console.log('listening on *:8888');
});