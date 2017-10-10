require('dotenv').config();

const rp = require('request-promise');
const async = require('async');
const Promise = require('bluebird');
const _ = require('lodash');

const playlist = require('./playlist');

// BASE URLS
const CHANNELS_BASE = "https://www.googleapis.com/youtube/v3/channels";
const ACTIVITIES_BASE = "https://www.googleapis.com/youtube/v3/activities";
const SEARCH_BASE = "https://www.googleapis.com/youtube/v3/search";
const PLAYLIST_ITEMS_BASE = "https://www.googleapis.com/youtube/v3/playlistItems";

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
  console.log("------------ STEP 1 -----------------");
  console.log("CHANNELS: ");
  console.log(require('util').inspect(channels, { depth: null }));

  playlist(channels)
  .then((playlistId) => {
    //assign base playlist id
    let basePlaylistId = playlistId;
    // 2: Get video IDs for these channels
    let channelIds = _.map(channels, channel => {
      if (channel.items.length > 0) {
        return channel.items[0].id;
      }
    });

    channelIds = _.filter(channelIds, channel => !_.isUndefined(channel));

    console.log("Channel Ids: ", channelIds);
    console.log("------------ STEP 1 END -------------");
    console.log();
    console.log();
    // channelIds = [ channelIds[0] ];

    let channelIdsCopy = _.clone(channelIds);

    let nextPageTokens = { };
    let allVideos = { };
    let videosToSort = [ ];

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

          console.log("Channel Ids: ", channelIds);

          let ogChannelIds = _.clone(channelIds);

          _.map(ogChannelIds, (id, index) => {
            let uploadedItems = videoLists[index].items;

            console.log("Adding videos to channel ID: ", id);
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

            // We can only handle videos
            value = _.filter(value, video => video.id && video.id.kind === 'youtube#video');

            // Reverse so we get chronological order
            _.reverse(value);

            // console.log(require('util').inspect(value[0], { depth: null }));

            // Add a "time" field which is UTC milliseconds since epoch when
            // video was published
            _.each(value, video => {
              video.time = (new Date(video.snippet.publishedAt)).getTime();
            });

            // console.log(require('util').inspect(value[0], { depth: null }));

            // Put this annotated list in a bigger list of all videos
            videosToSort = _.concat(videosToSort, value);
          });

          videosToSort = _.sortBy(videosToSort, [ "time" ]);

          if (!updatePlaylist) {
            console.log();
            console.log();
            console.log("Update playlist boolean is set to false in this script");
            console.log("To make changes to the playlist, open the index.js file and change the value of updatePlaylist to true");
            return;
          }

          console.log();
          console.log("Will add " + videosToSort.length + " videos to the given playlist.");
          console.log("This might take some time, please wait patiently!");
          console.log();

          Promise.each(videosToSort, (video, index) => {
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

            if (index % 50 === 0) {
              console.log("Sending request for video number ", index);
            }

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
        }
      });
  },
  err => {
    console.log(err);
  });
})
.catch(error => {
  console.log("Error while retrieving the channel IDs");
  console.error(error);
});
