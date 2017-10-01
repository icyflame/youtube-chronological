require('dotenv').config();

const rp = require('request-promise');
const async = require('async');
const Promise = require('bluebird');
const _ = require('lodash');

// BASE URLS
const CHANNELS_BASE = "https://www.googleapis.com/youtube/v3/channels";
const ACTIVITIES_BASE = "https://www.googleapis.com/youtube/v3/activities";
const SEARCH_BASE = "https://www.googleapis.com/youtube/v3/search";
const PLAYLIST_ITEMS_BASE = "https://www.googleapis.com/youtube/v3/playlistItems";

let basePlaylistId = process.env.BASE_PLAYLIST_ID;
let channels = process.env.CHANNELS.split(',');
let updatePlaylist = process.env.UPDATE_PLAYLIST && process.env.UPDATE_PLAYLIST === "true";

// 1: Get channel IDs from the channel usernames
Promise.map(channels, username => {
  let options = {
    uri: CHANNELS_BASE,
    qs: {
      part: "snippet",
      forUsername: username
    },
    headers: {
      Authorization: "Bearer " + process.env.YOUTUBE_OAUTH2_TOKEN
    },
    json: true
  };

  return rp(options);
})
.then(channels => {
  // 2: Get video IDs for these channels

  console.log(channels);
  let channelIds = _.map(channels, channel => {
    if (channel.items.length > 0) {
      return channel.items[0].id;
    }
  });

  console.log("Ids: ", channelIds);

  channelIds = [ channelIds[0] ];

  let channelIdsCopy = _.clone(channelIds);

  let nextPageTokens = { };
  let allVideos = { };

  async.whilst(
    () => !_.isEmpty(channelIds),
    (callback) => {
      Promise.map(channelIds, (id, index) => {
        let options = {
          uri: SEARCH_BASE,
          qs: {
            channelId: id,
            part: "snippet",
            type: "video",
            order: "date",
            maxResults: 50,
            pageToken: nextPageTokens[id]
          },
          headers: {
            Authorization: "Bearer " + process.env.YOUTUBE_OAUTH2_TOKEN
          },
          json: true
        };

        return rp(options);
      }).then(videoLists => {
        nextPageTokens = { };

        _.map(channelIds, (id, index) => {
          if (_.isUndefined(allVideos[id])) {
            allVideos[id] = [ ];
          }

          let uploadedItems = videoLists[index].items;

          allVideos[id] = _.concat(allVideos[id] || [ ], uploadedItems);

          let thisChannelsNextPageToken = videoLists[index].nextPageToken;

          if (_.isUndefined(thisChannelsNextPageToken)) {
            _.pull(channelIds, id);
          } else {
            nextPageTokens[id] = thisChannelsNextPageToken;
          }
        });

        callback(null);
      })
      .catch(error => {
        console.log("Error while retrieving the video IDs");
        console.error(error);
      });
    }, error => {
      if (error) {
        console.log("PROBLEMS!");
        console.error(error);
      } else {
        _.each(allVideos, (value, key) => {
          console.log(`${key} has ${value.length} videos`);
          _.reverse(value);
          console.log(require('util').inspect(value[0], { depth: null }));

          value = _.filter(value, video => video.id && video.id.kind === 'youtube#video');

          if (!updatePlaylist) {
            console.log();
            console.log();
            console.log("Update playlist boolean is set to false in this script");
            console.log("To make changes to the playlist, open the index.js file and change the value of updatePlaylist to true");
            process.exit(0);
          }

          console.log();
          console.log("Will add " + value.length + " videos to the given playlist.");
          console.log("This might take some time, please wait patiently!");
          console.log();

          Promise.each(value, (video, index) => {
            let playlistItemRes = {
              kind: "youtube#playlistItem",
              snippet: {
                playlistId: basePlaylistId,
                resourceId: video.id
              }
            };

            let options = {
              method: "POST",
              uri: PLAYLIST_ITEMS_BASE,
              qs: {
                part: "snippet"
              },
              body: playlistItemRes,
              headers: {
                Authorization: "Bearer " + process.env.YOUTUBE_OAUTH2_TOKEN
              },
              json: true
            };

            return rp(options);
          }).then(response => {
            console.log();
            console.log();
            console.log("PLAYLIST UPDATED!");
            console.log("Check this page: https://youtube.com/playlist?list=" + basePlaylistId);
          }).catch(error => {
            console.log("Problems while adding videos to playlist!");
            console.error(error);
          });
        });
      }
    });
})
.catch(error => {
  console.log("Error while retrieving the channel IDs");
  console.error(error);
});
