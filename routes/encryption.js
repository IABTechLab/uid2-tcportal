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


const crypto = require("crypto");

const SYSTEM_SECRET = process.env.TCP_SYSTEM_SECRET;
const SYSTEM_SALT = process.env.TCP_SYSTEM_SALT;
const SYSTEM_CODE_SECRET = process.env.TCP_SYSTEM_CODE_SECRET;

const algo = "aes-128-cbc";


const encrypt = function(input, cb) {
    crypto.scrypt(SYSTEM_SECRET, SYSTEM_SALT, 16, (err, key) => {
        if (err) {
            cb(err);
            return;
        }
        crypto.randomFill(new Uint8Array(16), (err, iv) => {
            if (err) {
                cb(err);
                return;
            }
            const cipher = crypto.createCipheriv(algo, key, iv);
            let encrypted = '';
            cipher.setEncoding("base64");
            cipher.on('data', (chunk => encrypted += chunk));
            cipher.on('end', () => cb(null, Buffer.from(iv).toString('base64') + ";" + encrypted));
            cipher.write(input);
            cipher.end();
        })
    });
}

const createCode = function(email, timestamp, cb) {
    const hash = crypto.createHash("sha256");
    hash.on('readable', () => {
        const data = hash.read();
        if (data) {
            var val = 0;
            for (var i = 3; i >= 0; --i) {
                val = (val << 8) | data[data.length-i-1];
            }
            var code = Math.abs(val % 1000000);
            cb (null, code);
        }
    })
    hash.write(email);
    hash.write(timestamp.toString());
    hash.write(SYSTEM_CODE_SECRET);
    hash.end();

}

const decrypt = function(input, cb) {
    const parts = input.split(';');

    if (parts == undefined ||  parts.length != 2) {
        throw "Invalid Enrypted payload";
    }

    const iv = Uint8Array.from(Buffer.from(parts[0], "base64"));
    crypto.scrypt(SYSTEM_SECRET, SYSTEM_SALT, 16, (err, key) => {
        if (err) {
            cb(err);
            return;
        }

        const decipher = crypto.createDecipheriv(algo, key, iv);

        let decrypted = '';
        decipher.on('readable', ()=> {
            while (null !== (chunk = decipher.read())) {
                decrypted += chunk.toString("utf8");
            }
        });

        decipher.on('end',() => {
           cb(null, decrypted);
        });

        decipher.write(parts[1], "base64");
        decipher.end();

    });
}

module.exports = {
    "encrypt" : encrypt,
    "decrypt" : decrypt,
    "code" : createCode
}
