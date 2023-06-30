//jshint esversion:6
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy; // level 6
const findOrCreate = require("mongoose-findorcreate");
require('dotenv').config();

//const encrypt = require("mongoose-encryption"); level 2
//const md5 = require("md5"); //level 3
// const bcrypt = require("bcrypt"); //level 4 security
// const saltRounds = 10;

const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({   //docs recomm of express-session to setup and use 
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());  //docs of passport told us to write this for setup and to use passport
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// const secret = "Thisisourlittlesecret."; //defining secret to use encryption //Level 2
//userSchema.plugin(encrypt, { secret: secret , encryptedFields: ["password"] });  level 2

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
  function (accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function (req, res) {
  res.render("home");
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] })); //thru this google accs prompt get opened

app.get('/auth/google/secrets',  //we set this in google authorized redirect url
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/secrets');
  });

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/secrets", async function (req, res) {
  const foundUsers = await User.find({"secret": {$ne : null}});
  if(foundUsers){
    res.render("secrets", {usersWithSecrets: foundUsers});
  }
});

app.get("/submit", function(req, res){
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", async function(req, res){
const submittedSecret = req.body.secret;
  const foundUser = await User.findById(req.user.id);
  if(foundUser){
    foundUser.secret = submittedSecret;
    await foundUser.save();
    res.redirect("/secrets");
  }
});

app.get("/logout", function (req, res) {

  req.logout(function (e) {
    if (e) {
      console.log(e);
    } else {
      console.log("logged out");
    }
  }); // logout function provided by passport local mongoose
  res.redirect("/");
});

app.post("/register", async function (req, res) {
  User.register({ username: req.body.username }, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {  //setting up the session for user and bcoz of this 
        //if they are logged in they can directly go to secrets untill they logout else we render the secret page but here we redirect
        res.redirect("/secrets");
      })
    }
  }) //.register is a method provided by express-local-mongoose
});

app.post("/login", async function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) { //login function is  provided by express-local-mongoose
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });

    }
  });
});

















app.listen(3000, function () {
  console.log("server started at port 3000");
});
