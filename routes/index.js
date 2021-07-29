// Copyright (c) 2021 The Trade Desk, Inc
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

const express = require('express');
const router = express.Router();

const encryption = require("./encryption");
const emailVerification = require("./email");
const recaptcha = require("./recaptcha");
const optout = require("./optout");
const axios = require('axios');

const generateEmailChallenge = function(email, cb) {
  // This is Epoch Ms
  const ts = Math.floor(new Date().getTime());
  let payload = {
      "email" : email,
      "timestamp" : ts
  };

  encryption.code(email, ts, (err, code) => {
    if (err) {
      cb(err);
      return;
    }

    encryption.encrypt(JSON.stringify(payload), (err, encrypted) => {
      if (err) {
        cb(err);
        return;
      }
      payload["encrypted"] = encrypted;
      payload["code"] = code;
      cb(null, payload);
    })
  })

}

const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;


const isValidEmail = function(email) {
  return emailRegex.test(email);
}



const handleCodeVerification = function(req, res, next) {
  const email = req.body.email;
  const submittedCode = req.body.code;
  const encytptedPayload = req.body.encrypted;
  const recaptchaData = req.body.recaptcha
  console.log("Email Submitted is " + email);

  encryption.decrypt(encytptedPayload, (err, p) => {
    if (err) {
      res.redirect("/");
      return;
    }
    recaptcha.validate(recaptchaData, (success) => {
      if (!success) {
        res.render('index', { email : email, error : "Blocked a potentially automated request. Please try again later."});
      } else {
        const payload = JSON.parse(p);
        encryption.code(payload["email"], payload["timestamp"], (err, code) => {
          if (submittedCode == code) {
            encryption.encrypt(payload["email"], (err, encrypted) => {
              res.render('email_verified', { email : email, encrypted: encrypted});
            });
          } else {
            res.render('email_submit', { "encrypted" : encytptedPayload, "code" : submittedCode, "email" : email, "error" : "Code does not match"});
          }
        })
      }
    })
  })
}

const handleEmailPromptSubmission = function(req, res, next) {
  const email = req.body.email;
  const recaptchaData = req.body.recaptcha;
  if (!isValidEmail(email)) {
    res.render('index', { email : email, error : "Please enter a valid email address"});
  } else {
    recaptcha.validate(recaptchaData, (success) => {
      if (!success) {
        res.render('index', { email : email, error : "Blocked a potentially automated request. Please try again later."});
      } else {
        const payload = generateEmailChallenge(email, (err, payload) => {
          emailVerification.send(email, payload["code"], (err, cb) => {
            if (err) {
              res.render('index', { email : email, error : "Trouble sending verification email"});
            } else {
              res.render('email_submit', { "encrypted" : payload["encrypted"], "email" : payload["email"]});
            }
          });
        });
      }
    });
  }
}

const handleOptoutSubmit = function(req, res, next) {
  var encrypted = req.body.encrypted;
  encryption.decrypt(encrypted, (err, payload) => {
    if (err) {
      res.redirect("/");
      return;
    }
    optout.send(payload, (err, data) => {
      if (err)  {
        res.render('index', { error : "Sorry, we could not process your request."});
        return;
      }
      res.render('confirmation', { message : ""});
    })
  });

}

const STEP_MAPPING = {
  "email_prompt" : handleEmailPromptSubmission,
  "code_submit" : handleCodeVerification,
  "optout_submit" : handleOptoutSubmit
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/', function(req, res, next) {
  const step = req.body.step;
  const handler = STEP_MAPPING[step];
  if (handler) {
    handler(req, res, next);

  } else {
      res.redirect("/");
  }
});

router.get("/ops/healthcheck", function(req, res, next) {
  res.send("OK");
});



module.exports = router;
