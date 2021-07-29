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

const axios = require('axios');
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY

const sendVerificationCode = function(email, code, cb) {

    axios.post("https://api.sendgrid.com/v3/mail/send",
         {
                "from" : {
                    "email" : "noreply@transparentadvertising.org"
                },
            "personalizations" : [
                {
                    "to" : [ { "email" : email}],
                    "dynamic_template_data" : {
                        "code" : code
                    }
                }
            ],
            "template_id" : "d-04a7859751a04139b89ed9b46807f81c"
        },
        {
            headers : { "Authorization" : "Bearer " + SENDGRID_API_KEY,
                "Content-Type" : "application/json"},
        }


).then((res) => {
        cb(null, res.data);
    }).catch((error) => {
        cb(error);
    })
}

module.exports = {
    send : sendVerificationCode
}
