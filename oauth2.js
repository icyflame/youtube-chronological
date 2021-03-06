// Copyright 2012-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
require('dotenv').config();

var readline = require('readline');

var google = require('googleapis');
var OAuth2Client = google.auth.OAuth2;
var plus = google.plus('v1');

// Client ID and client secret are available at
// https://code.google.com/apis/console
var REDIRECT_URL = 'urn:ietf:wg:oauth:2.0:oob'
var CLIENT_ID=process.env.OAUTH2_CLIENT_ID;
var CLIENT_SECRET=process.env.OAUTH2_SECRET;

var oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getAccessToken (oauth2Client, callback) {
  // generate consent page url
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    scope: 'https://www.googleapis.com/auth/youtube' // can be a space-delimited string or an array of scopes
  });

  console.log('Visit the url: ', url);
  rl.question('Enter the code here:', function (code) {
    // request access token
    oauth2Client.getToken(code, function (err, tokens) {
      if (err) {
        return callback(err);
      }
      // set tokens to the client
      // TODO: tokens should be set by OAuth2 client.
      console.log("Tokens: ", tokens);
      oauth2Client.setCredentials(tokens);
      callback(null, tokens);
    });
  });
}

getAccessToken(oauth2Client, (err, tokens) => {
  console.log();
  console.log("COMPLETED!");
  console.log();
  console.log();

  console.log("Access token:");
  console.log();
  console.log(tokens.access_token);
  console.log();
  console.log();

  require('fs').appendFile('.env', '\nYOUTUBE_OAUTH2_TOKEN=' + tokens.access_token, (err) => {
    if (!err) {
      console.log("Successfully written to the end of .env!");
      console.log();
      process.exit(0);
    } else {
      console.log("OH! There was an error");
      console.error(err);
      process.exit(1);
    }
  });
});
