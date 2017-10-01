// Load process.env
require('dotenv').config();

// Load dependencies
const rp = require('request-promise');
const fs = require('fs');

// Define constants
const PLAYLISTS_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlists';

// Call youtube data api to create a playlist
const options = {
  method: 'POST',
  uri: PLAYLISTS_API_ENDPOINT,
  qs: {
    part: 'snippet,status',
  },
  body: {
    snippet: {
      title: 'youtube-chronological ' + Date().toString()
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
rp(options).then(res => {
  const playlistId = res.id;

  // Read and update .env file
  const envData = fs.readFileSync('.env', 'utf-8');
  // This will always replace BASE_PLAYLIST_ID with the new value, more logic would be needed if
  // we want to check for existing playlist
  const newData = envData.replace(/BASE_PLAYLIST_ID=.*\n/, 'BASE_PLAYLIST_ID=' + playlistId + '\n');
  fs.writeFileSync('.env', newData, 'utf-8');
  console.log('\nNEW PLAYLIST ID: ' + playlistId + '\n');
  console.log('ENV Updated!\n');
}, err => {
  console.log(err);
});