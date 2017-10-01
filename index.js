require('dotenv').config();

const rp = require('request-promise');
const async = require('async');
const Promise = require('bluebird');
const _ = require('lodash');


// BASE URLS
const CHANNELS_BASE = "https://www.googleapis.com/youtube/v3/channels";
const ACTIVITIES_BASE = "https://www.googleapis.com/youtube/v3/activities";

let channels = [ 'h3h3productions', 'h2h2productions', '007007Delta' ];

// 1: Get channel IDs from the channel usernames
Promise.map(channels, username => {
  let options = {
    uri: CHANNELS_BASE,
    qs: {
      key: process.env.YOUTUBE_API_KEY,
      part: "snippet",
      forUsername: username
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
          uri: ACTIVITIES_BASE,
          qs: {
            key: process.env.YOUTUBE_API_KEY,
            channelId: id,
            part: "snippet,contentDetails",
            maxResults: 50,
            pageToken: nextPageTokens[id]
          },
          json: true
        };

        return rp(options);
      }).then(videoLists => {
        console.log(videoLists);
        nextPageTokens = { };

        _.map(channelIds, (id, index) => {
          if (_.isUndefined(allVideos[id])) {
            allVideos[id] = [ ];
          }

          let uploadedItems = _.filter(videoLists[index].items, item => item.snippet.type === 'upload');

          allVideos[id] = _.concat(allVideos[id] || [ ], uploadedItems);

          let thisChannelsNextPageToken = videoLists[index].nextPageToken;

          console.log("Channel next page token is: ", thisChannelsNextPageToken);

          if (_.isUndefined(thisChannelsNextPageToken)) {
            console.log(`Removing ${id} from ${channelIds}`);
            _.pull(channelIds, id);
          } else {
            nextPageTokens[id] = thisChannelsNextPageToken;
          }
        });

        console.log("Channel IDs: ", channelIds);
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
          let latest = _.slice(value, 0, 10);
          _.reverse(value);
          let oldest = _.slice(value, 0, 10);
          console.log("LATEST: ");
          console.log(latest);
          console.log("OLDEST: ");
          console.log(oldest);
        });
      }
    });
})
.catch(error => {
  console.log("Error while retrieving the channel IDs");
  console.error(error);
});
