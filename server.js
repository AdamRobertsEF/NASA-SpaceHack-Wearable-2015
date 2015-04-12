
var express = require('express'),
fs = require('fs');
var app = express();

var http = require('http');
http.globalAgent.maxSockets = 2000;

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
                                              redisClient.set('user:' + username + ':heartrate', 0);
                                              redisClient.set('user:' + username + ':SpO2', 0);
                                              redisClient.set('user:' + username + ':unit', 0);
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
        var unit     = query.unit;
        
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
                                        redisClient.set('user:' + uid + ':unit', unit);
                                            
                                        responseobject.username = username;
                                        responseobject.token = token;
                                        responseobject.uuid = uid;
                                        responseobject.expires_in = 86400;
                                        var json = JSON.stringify(responseobject);
                                        res.send(200,json);
                                        redisClient.expire('user:' + uid + ':token', 86400);
                                        redisClient.expire('user:' + token + ':uuid', 86400);
                                        redisClient.expire('user:' + uid + ':unit', 86400);
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

app.get('/me/follow', function(req,res){
        
        var query = require('url').parse(req.url,true).query;
        var responseobject = new Object();
        
        isAuthenticated(query.token, function(authenticatedUser){
                        
                if (authenticatedUser){
                        var followuuid = query.uid;
                        
                        redisClient.sadd('user:' + authenticatedUser  + 'following', query.uid, function(err, reply){
                                         
                                         if (reply == '1'){
                                         
                                         var following = new Object();
                                         var followers = new Object();
                                         
                                         followers.uuid = authenticatedUser;
                                         following.uuid = query.uid;
                                         
                                         redisClient.sadd('user:' + query.uid  + 'followers', authenticatedUser);
                                         
                                         redisClient.incr('following:' + authenticatedUser, function(err, reply){
                                                          following.count = reply;
                                                          responseobject.following = following;
                                                          console.log('following: '+ reply);
                                                          
                                                          redisClient.incr('followers:' + followuuid, function (err, reply) {
                                                                           console.log('followers: '+ reply);
                                                                           followers.count = reply;
                                                                           
                                                                           responseobject.follower = followers;
                                                                           
                                                                           var json = JSON.stringify(responseobject);
                                                                           res.send(json);
                                                                           });
                                                          });
                                         } else {
                                         responseobject.error = 'Already following';
                                         var json = JSON.stringify(responseobject);
                                         console.log('already following!');
                                         res.send(json);
                                         }
                                         
                                         });
                        } else {
                        responseobject.error = 'Not Authenticated';
                        var json = JSON.stringify(responseobject);
                        res.send(json);
                        }
                        });
        
        
        });

app.get('/me/unfollow', function(req,res){
        var query = require('url').parse(req.url,true).query;
        
        var follower = query.follower;
        
        isAuthenticated(token, function(uuid){
                        if (uuid){
                            var responseobject = new Object();
                        
                            redisClient.srem('user:' + uuid  + 'following', follower, function(err, reply){
                                         
                                         if (reply == '1'){
                                         
                                         var following = new Object();
                                         var followers = new Object();
                                         
                                         followers.uuid = uuid;
                                         following.uuid = follower;
                                         
                                         redisClient.srem('user:' + follower  + 'followers', uuid);
                                         
                                         redisClient.decr('following:' + uuid, function(err, reply){
                                                          following.count = reply;
                                                          responseobject.following = following;
                                                          console.log('following: '+ reply);
                                                          
                                                          redisClient.decr('followers:' + follower, function (err, reply) {
                                                                           console.log('followers: '+ reply);
                                                                           followers.count = reply;
                                                                           
                                                                           responseobject.follower = followers;
                                                                           
                                                                           var json = JSON.stringify(responseobject);
                                                                           res.send(json);
                                                                           });
                                                          });
                                         
                                         } else {
                                             responseobject.error = 'Not following';
                                             var json = JSON.stringify(responseobject);
                                             console.log('not following!');
                                             res.send(json);
                                         }
                                });
                        } else {
                            res.send('Auth:NO');
                        }
        });
});

app.get('/me/followers', function(req,res){
        
        var query = require('url').parse(req.url,true).query;
        
        var responseobject = new Object();
        
        isAuthenticated(query.token, function(authenticatedUser){
                        
                        if (authenticatedUser){
                        
                        redisClient.smembers('user:' + uuid + 'followers', function(err, reply){
                                             responseobject.followers = reply;
                                             var json = JSON.stringify(responseobject);
                                             res.send(json);
                                             });
                        } else {
                        responseobject.error = 'Not Authenticated';
                        var json = JSON.stringify(responseobject);
                        res.send(json);
                        }
                        });
        });

app.get('/me/following', function(req,res){
        
        var query = require('url').parse(req.url,true).query;
        isAuthenticated(query.token, function(uuid){
                        isFollowing(uuid, function(responseobject){
                                    res.send(responseobject);
                                    });
                        });
});


app.get('/me/post', function (req, res){
        
        var query = require('url').parse(req.url,true).query;
        var token = query.token;
        var heartrate = query.heartrate;
        var SpO2 = query.SpO2;
        
        isAuthenticated(token, function(authenticatedUser){
                        if (authenticatedUser){
                        var post = new Object();
                        post.id = uuid();
                        post.uid = authenticatedUser;
                        post.heartrate = heartrate;
                        post.SpO2 = SpO2;
                        
                        redisClient.hmset('post:' + post.id, {
                                          'uid' : authenticatedUser,
                                          'heartrate' : heartrate,
                                          'SpO2'      : SpO2
                                          });
                        
                        var responseobject = new Object();
                        
                        redisClient.smembers('user:' + authenticatedUser + ':followers', function(err, reply){
                                             reply.push(authenticatedUser);
                                             responseobject.following = reply;
                                             console.log('followers: ' + reply);
                                             reply.forEach(postToGraph,post);
                                             });
                        } else {
                        res.send('Cannot post - not authenticated!');
                        }
                        });
});

app.get('/me/timeline', function (req, res){
        
        var query = require('url').parse(req.url,true).query;
        var token = query.token;
        
        isAuthenticated(token, function(authenticatedUser){
                        
                        if (authenticatedUser){
                        redisClient.lrange('user:' + authenticatedUser + ':timeline',query.start,query.start+query.count, function(err, reply){
                                           var timeline = new Object();
                                           timeline.posts = new Array();
                                           var posts = new Array();
                                           var actors = new Array();
                                           
                                           var uids = new Array();
                                           
                                           multi_queue = redisClient.multi();
                                           multi_queue2 = redisClient.multi();
                                           for (var i=0; i<reply.length; i++) {
                                           multi_queue.hgetall('post:' + reply[i]);
                                           console.log ('post.uuid:' + reply[i]);
                                           }
                                           
                                           multi_queue.exec(function (err, replies) {
                                                            console.log ('1st:' + JSON.stringify(replies));
                                                            replies.forEach(function (reply, index) {
                                                                            
                                                                            posts.push(reply);
                                                                            if (!uids.contains(reply.uid)){
                                                                            uids.push(reply.uid);
                                                                            multi_queue2.hgetall('user:' + reply.uid);
                                                                            }
                                                                            
                                                                            });
                                                            
                                                            multi_queue2.exec(function (err, replies) {
                                                                              console.log ('2nd: ' + JSON.stringify(replies))
                                                                              ;
                                                                              replies.forEach(function (reply, index) {
                                                                                              console.log(reply);
                                                                                              actors.push(reply);
                                                                                              });
                                                                              
                                                                              posts.forEach(function (element, index, array){
                                                                                            for (var i=0; i<actors.length; i++) {
                                                                                            if (actors[i].uuid == element.uid){
                                                                                            console.log('found actor! = ' + JSON.stringify(actors[i]));
                                                                                            console.log ('element = ' + JSON.stringify(element));
                                                                                            var post = new Object();
                                                                                            post.uuid = element.uuid;
                                                                                            post.content = element.content;
                                                                                            post.actor = actors[i];
                                                                                            timeline.posts.push(post);
                                                                                            break;
                                                                                            }
                                                                                            }
                                                                                            });
                                                                              
                                                                              var json = JSON.stringify(timeline);
                                                                              res.send(json);
                                                                              });
                                                            });
                                           });
                        } else {
                        var responseobject = new Object();
                        responseobject.error = 'Not Authenticated';
                        var json = JSON.stringify(responseobject);
                        res.send(json);
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