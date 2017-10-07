// Load process.env
require('dotenv').config();

// Load dependencies
const rp = require('request-promise');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

// Define constants
const PLAYLISTS_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlists';
const ENCODING = 'utf-8';
const ENV_FILE = '.env';

// Util method to update .env file
var updateEnvFile = function(playlistId) {
  return new Promise(function(resolve, reject) {
    fs.readFileAsync(ENV_FILE, ENCODING)
    .then(data => {
      const newData = data.replace(/BASE_PLAYLIST_ID=.*\n/, 'BASE_PLAYLIST_ID=' + playlistId + '\n');
      return fs.writeFileAsync(ENV_FILE, newData, ENCODING);
    }, reject)
    .then(() => {
      console.log('\nNEW PLAYLIST ID: ' + playlistId + '\n');
      console.log('ENV Updated!\n');
      resolve(playlistId);
    }, reject);
  });
}

// Call youtube data api to create a playlist
var playlist = function(channelName) {
  const options = {
    method: 'POST',
    uri: PLAYLISTS_API_ENDPOINT,
    qs: {
      part: 'snippet,status',
    },
    body: {
      snippet: {
        title: channelName + ' Chronological ' + (new Date()).toISOString().replace(/T.*$/,'')
      },
      status: {
        privacyStatus: 'private'
      }
    },
    headers: {
      Authorization: 'Bearer ' + process.env.YOUTUBE_OAUTH2_TOKEN
    },
    json: true
  };
  return new Promise(function(resolve, reject) {
    rp(options).then(res => {
      const playlistId = res.id;
      updateEnvFile(playlistId)
      .then(resolve, reject);
    }, reject);
  });
}

module.exports = playlist;
