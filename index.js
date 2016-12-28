'use strict';

const AWS = require('aws-sdk');
const PromiseA = require('bluebird');

module.exports.create = function (options) {
  const s3 = PromiseA.promisifyAll(new AWS.S3({params: {Bucket: options.bucket}}));
  var log = function() {
    if (options.debug) {
      var args = Array.prototype.slice.call(arguments);
      console.log.apply(console, args);
    }
  };
  var accounts = {

    // Accounts
    setKeypairAsync: function (opts, keypair) {
      log('setting account keypair for', opts.email);
      return s3.putObjectAsync({
        Key: `accounts/${opts.email}/private_key.json`,
        Body: JSON.stringify(keypair.privateKeyJwk)
      }).then(function() {
        return keypair;
      }).catch(function(e) {
        console.error(e);
      });
    },
    // Accounts
    checkKeypairAsync: function (opts) {
      log('checking account keypair for', opts.email);
      return s3.getObjectAsync({
        Key: `accounts/${opts.email}/private_key.json`
      }).then(function(obj) {
        log('account keypair found');
        return {privateKeyJwk: JSON.parse(obj.Body.toString())};
      }).catch(function(e) {
        if (e.statusCode == 404) {
          log('account keypair not found');
          return null;
        } else {
          console.error(e);
        }
      });
    },

    // Accounts
    checkAsync: function (opts) {
      log('checking account', opts.email);
      return s3.getObjectAsync({
        Key: `accounts/${opts.email}/private_key.json`
      }).then(function(obj) {
        log('account found');
        return {id: opts.email, keypair: { privateKeyJwk: JSON.parse(obj.Body.toString())}}
      }).catch(function(e) {
        if (e.statusCode == 404) {
          log('account', opts.email, 'not found');
          return null;
        } else {
          console.error(e);
        }
      });
    },
    // Accounts
    setAsync: function (opts, reg) {
      log('setting account', opts.email);
      return s3.putObjectAsync({
        Key: `accounts/${opts.email}/private_key.json`,
        Body: JSON.stringify(reg.keypair.privateKeyJwk)
      }).then(function() {
        return {id: opts.email, email: opts.email, keypair: reg.keypair, receipt: reg.receipt};
      }).catch(function(e) {
        console.error(e);
      });
    }
  };

  var certificates = {

    // Certificates
    setKeypairAsync: function (opts, keypair) {
      log('setting cert keypair', opts.domains);

      var promises = [];
      for (var i=0; i < opts.domains.length; i++) {
        promises.push(s3.putObjectAsync({
          Key: `certs/${opts.domains[i]}/domain_key.json`,
          Body: JSON.stringify(keypair.privateKeyJwk)
        }));
      }

      return PromiseA.all(promises)
        .then(function() {
          return keypair;
        }).catch(function(e) {
          console.error(e);
        });
    },
    // Certificates
    checkKeypairAsync: function (opts) {
      log('checking cert keypair', opts.domains);

      var promises = [];
      for (var i=0; i < opts.domains.length; i++) {
        promises.push(s3.getObjectAsync({
          Key: `certs/${opts.domains[i]}/domain_key.json`
        }));
      }

      return PromiseA.all(promises)
        .then(function(arr) {
          log('cert keypair found');
          //in theory the keypairs should be the same for all domains on the same cert
          //if they are return the shared key, if not return null which will rewrite all the keys to a single shared key
          var areEqual = function() {
            var len = arguments.length;
            for (var i = 1; i< len; i++){
              if (arguments[i].Body.toString() !== arguments[i-1].Body.toString())
                return false;
            }
            return true;
          };
          //if they all match we can just return the first one (since we can only return 1)
          return  {privateKeyJwk: areEqual(arr) ? JSON.parse(arr[0].Body.toString()) : null}
        }).catch(function(e) {
          if (e.statusCode == 404) {
            log('cert keypair not found');
            return null;
          } else {
            console.error(e);
          }
        });
    },

    // Certificates
    checkAsync: function (opts) {
      log('looking for cert for', opts.domains, 'under account', opts.email);

      var promises = [];
      for (var i=0; i < opts.domains.length; i++) {
        promises.push(s3.getObjectAsync({Key: `certs/${opts.domains[i]}/cert.pem`}));
        promises.push(s3.getObjectAsync({Key: `certs/${opts.domains[i]}/privkey.pem`}));
        promises.push(s3.getObjectAsync({Key: `certs/${opts.domains[i]}/chain.pem`}));
      }

      return PromiseA.all(promises)
        .then(function(arr) {
          return {
            cert: arr[0].Body.toString(),
            privkey: arr[1].Body.toString(),
            chain: arr[2].Body.toString()
          }
        }).catch(function(e) {
          if (e.statusCode == 404) {
            log('cert not found');
            return null;
          } else {
            console.error(e);
          }
        });
    },
    // Certificates
    setAsync: function (opts) {
      log('setting cert');

      var promises = [];
      for (var i=0; i < opts.domains.length; i++) {
        promises.push(s3.putObjectAsync({Key: `certs/${opts.domains[i]}/cert.pem`, Body: opts.certs.cert}));
        promises.push(s3.putObjectAsync({Key: `certs/${opts.domains[i]}/privkey.pem`, Body: opts.certs.privkey}));
        promises.push(s3.putObjectAsync({Key: `certs/${opts.domains[i]}/chain.pem`, Body: opts.certs.chain}));
      }

      return PromiseA.all(promises)
        .then(function() {
          //log(opts.certs);
          return opts.certs;
        }).catch(function(e) {
          console.error(e);
        });
    }
  };

  return {
    getOptions: function () {
      // merge options with default settings and then return them
      return options;
    },
    accounts: accounts,
    certificates: certificates
  };

};
