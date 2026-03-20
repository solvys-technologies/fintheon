// [claude-code 2026-03-10] twitter-cli module public API

export {
  isTwitterCliInstalled,
  searchTweets,
  fetchUserTimeline,
  type TwitterCliTweet,
} from './twitter-cli-service.js';

export {
  classifyFJHeadline,
  filterByTier,
  type FJTier,
  type FJClassification,
  type FJUrgency,
} from './fj-emoji-filter.js';

export {
  pollTwitterForEconNews,
  startEconTwitterPoller,
  stopEconTwitterPoller,
  getWarmCacheItems,
} from './econ-triggered-poller.js';
