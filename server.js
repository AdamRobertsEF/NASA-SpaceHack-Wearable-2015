
var express = require('express'),
fs = require('fs');
var app = express();

var http = require('http');
http.globalAgent.maxSockets = 200000;

var redis = require('redis'),
redisClient = redis.createClient(),
multi_queue;

var qs = require('querystring');

var uuid = require('node-uuid');

app.get('/', function(req, res){
        res.send('Please refer to API Documentation');
        });

app.get('/uuid', function(req,res){
        
        res.send('uuid:' + uuid());
});

app.get('/user/new', function (req, res){
        
        var query = require('url').parse(req.url,true).query;
        
        var username = query.username;
        var email = query.email;
        var password = query.password;
        
        if (username == null || email == null || password == null){
            res.send(400,'Failed incomplete request!');
        } else {
        
        redisClient.get ('user:' + email, function(err, reply){
                         if (reply){
                            res.send(409,'e-mail in use');
                         } else {
                         // Email doesn't exist let's check if username is available
                         redisClient.get ('user:' + username, function(err, reply){
                                          if (reply){
                                            res.send(409,'username in use');
                                          } else {
                                              // Username not in use - Let's create the user
                                              
                                              var newuseruuid = uuid();
                                              
                                              redisClient.set('user:' + username, newuseruuid);
                                              redisClient.set('user:' + email, newuseruuid);
                                              redisClient.set('user:' + newuseruuid + ':username', username);
                                              redisClient.set('user:' + username + ':password', password);
                                              redisClient.set('user:' + username + ':points', 0);
                                              var responseobject = new Object();
                                              responseobject.username = username;
                                              responseobject.email = email;
                                              responseobject.uuid = newuseruuid;
                                              var json = JSON.stringify(responseobject);
                                              res.send(201,json);
                                          }
                                });
                         }
                });
        }
});

app.get('/user/auth', function (req,res){
        
        var query = require('url').parse(req.url,true).query;
        
        var username = query.username;
        var password = query.password;
        
        redisClient.get('user:' + username + ':password', function(err, reply){
                        if (reply == password) {
                            // Correct username + password, let's generate a OAUTH token
                        
                            var token = uuid() + uuid();
                        
                            redisClient.get('user:' + username, function (err, reply){
                                        
                                        var uid = reply;
                                        console.log('user has been logged in');
                                        
                                        //the login call will return an OAuth token, which is saved
                                        //in the client object for later use.  Access it this way:
                                        
                                        var responseobject = new Object();
                                        
                                        redisClient.set('user:' + uid + ':token', token);
                                        redisClient.set('user:' + token + ':uuid', uid);
                                        
                                        responseobject.username = username;
                                        responseobject.token = token;
                                        responseobject.uuid = uid;
                                        responseobject.expires_in = 86400;
                                        var json = JSON.stringify(responseobject);
                                        res.send(200,json);
                                        redisClient.expire('user:' + uid + ':token', 86400);
                                        redisClient.expire('user:' + token + ':uuid', 86400);
                                        console.log('token ' + token);
                            });
                        
                        } else {
                            console.log('could not log user in');
                            console.log('username = ' + username);
                            console.log('password = ' + password);
                            res.send(401,'Authentication Failed!');
                        };
            });
});

app.get('/crew/get/heartrate', function(req,res){
        
        var query = require('url').parse(req.url,true).query;
        var responseobject = new Object();
        
        isAuthenticated(query.token, function(authenticatedUser){
                        
                        if (authenticatedUser){
                            var responseobject = new Object();
                            redisClient.get('user:' + query.uid + ':heartrate');
                        } else {
                            responseobject.error = 'Not Authenticated';
                            var json = JSON.stringify(responseobject);
                            res.send(401,json);
                        }
        });
});

app.get('/me/get/heartrate', function(req,res){

        var query = require('url').parse(req.url,true).query;
        var responseobject = new Object();
        
        isAuthenticated(query.token, function(authenticatedUser){
                        
                        if (authenticatedUser){
                            var responseobject = new Object();
                            redisClient.get('user:' + uid + ':heartrate');
                        
                        } else {
                            responseobject.error = 'Not Authenticated';
                            var json = JSON.stringify(responseobject);
                            res.send(401,json);
                        }
        
        });
});

app.get('/me/set/heartrate', function(req,res){
                
                var query = require('url').parse(req.url,true).query;
                var responseobject = new Object();
        
                isAuthenticated(query.token, function(authenticatedUser){
                                
                                if (authenticatedUser){
                                    var responseobject = new Object();
                                    redisClient.set('user:' + uid + ':heartrate',query.amount);
                                
                                } else {
                                    responseobject.error = 'Not Authenticated';
                                    var json = JSON.stringify(responseobject);
                                    res.send(401,json);
                                }
                });
                                
});


app.get('/crew/get/SpO2', function(req,res){ // Blood Oxygen Level
        
        var query = require('url').parse(req.url,true).query;
        var responseobject = new Object();
        
        isAuthenticated(query.token, function(authenticatedUser){
                        
                        if (authenticatedUser){
                            var responseobject = new Object();
                            redisClient.get('user:' + query.uid + ':SpO2',query.amount);
                        } else {
                            responseobject.error = 'Not Authenticated';
                            var json = JSON.stringify(responseobject);
                            res.send(401,json);
                        }
        });
});

app.get('/me/get/SpO2', function(req,res){ // Blood Oxygen Level
                
    var query = require('url').parse(req.url,true).query;
    var responseobject = new Object();
                
    isAuthenticated(query.token, function(authenticatedUser){
                                
                    if (authenticatedUser){
                        var responseobject = new Object();
                        redisClient.get('user:' + uid + ':SpO2',query.amount);
                                
                    } else {
                        responseobject.error = 'Not Authenticated';
                        var json = JSON.stringify(responseobject);
                        res.send(401,json);
                    }
    });
});

app.get('/me/set/SpO2', function(req,res){ // Blood Oxygen Level
        
        var query = require('url').parse(req.url,true).query;
        var responseobject = new Object();
        
        isAuthenticated(query.token, function(authenticatedUser){
                        if (authenticatedUser){
                            var responseobject = new Object();
                            redisClient.set('user:' + uid + ':heartrate',query.amount);
                        } else {
                            responseobject.error = 'Not Authenticated';
                            var json = JSON.stringify(responseobject);
                            res.send(401,json);
                        }
        });
});

app.get('/isauth', function (req, res){
        
        var query = require('url').parse(req.url,true).query;
        var token = query.token;
        
        isAuthenticated(token, function(uuid){
                        if (uuid){
                            res.send('Auth:YES - user = ' + uuid);
                        } else {
                            res.send('Auth:NO');
                        }
        });
});



function isAuthenticated(token, callback){
    
    redisClient.get ('user:' + token + ':uuid', function(err, reply){
                     if (token){
                        //console.log('is user: ' + reply);
                        callback(reply);
                     } else {
                        console.log('not auth!');
                        callback(false);
                     }
    });
}


Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}

Array.prototype.find = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return this[i];
        }
    }
    return -1;
}

// this will be activated on any error without try catch :)
process.on('uncaughtException', function (err) {
           console.log('Caught exception: ' + err);
           });

port = process.env.PORT || 1337;
app.listen(port);