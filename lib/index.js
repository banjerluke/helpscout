var debug = require('debug')('helpscout:conversations');
var defaults = require('defaults');
var request = require('superagent');
var Attachments = require('./attachments');
var Conversations = require('./conversations');
var Customers = require('./customers');
var Hooks = require('./hooks');
var Mailboxes = require('./mailboxes');
var Threads = require('./threads');
var Users = require('./users');

module.exports = Helpscout;

/**
 * Initialize a new `Helpscout` client with config.
 *
 * @param {Object} config
 * @param {Number} config.maxRetries
 * @param {Number} config.defaultRetryDelay
 * @param {String} config.apiVersion
 * @param {String} config.apiRoot
 * @param {Object} config.query
 * @param {String} config.mailboxId
 * @param {Number} config.timeout
 * @param {String} config.apiKey
 * @param {Object} config.retryList
 */

function Helpscout(config) {

    if (!(this instanceof Helpscout)) {
        return new Helpscout(config);
    }

    this.config = defaults(config, {
        maxRetries: 3,
        defaultRetryDelay: 1,
        apiVersion: 'v1',
        apiRoot: 'https://api.helpscout.net/',
        timeout: 0,
        retryList: [
            429,
            500,
            503
        ]
    });

    if (!this.config.apiKey) {
        throw new Error('Helpscout requires an apiKey.');
    }

    this.attachments = new Attachments(this);
    this.conversations = new Conversations(this);
    this.customers = new Customers(this);
    this.hooks = new Hooks(this);
    this.mailboxes = new Mailboxes(this);
    this.threads = new Threads(this);
    this.users = new Users(this);
}

/**
 * Abstraction for making a request with auto retry.
 *
 * @param {Object} options
 * @param {String} options.method 
 * @param {String} options.path
 * @param {Object} options.retryCount
 * @param {Function} options.callback
 * @param {Number} options.retryAfter
 * @param {Object} options.query
 * @param {Object} options.data
 */

Helpscout.prototype.request = function(options) {

    options = defaults(options, {
        method: 'get',
        path: '/',
        callback: function() {},
        retryCount: this.config.maxRetries,
        retryAfter: this.config.defaultRetryDelay,
        timeout: this.config.timeout
    });

    debug('Making request', options);
    request[options.method](this.config.apiRoot + this.config.apiVersion + options.path)
        .auth(this.config.apiKey, 'X')
        .query(this.config.query)
        .query(options.query)
        .timeout(options.timeout)
        .send(options.data)
        .end(function(err, res) {

            debug('Request complete', err, res && res.body);
            var isRetryError = err && (!err.status || this.config.retryList.indexOf(err.status) !== -1);
            if (isRetryError && options.retryCount > 0) {

                var retryAfterHeader = res && res.header && parseInt(res.header['retry-after'], 10);
                var retryDelay = retryAfterHeader || options.retryAfter;

                return setTimeout(function() {
                    options.retryCount = options.retryCount - 1;
                    options.retryAfter = options.retryAfter * 2;
                    this.request(options);
                }.bind(this), retryDelay * 1000);
            }

            if (options.returnFullResponse) {
                options.callback(err, res);
            } else {
                options.callback(err, res && res.body);
            }
        }.bind(this));
};
