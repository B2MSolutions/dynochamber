var _ = require('lodash');
var queryBuilder = require('./query-builder');
var helpers = {};

helpers.batchWrite = function(options) {
  return function(model) {
    var optionsWithModel = queryBuilder.fillPlaceholders(options, model);
    var deleteRequests = _.map(optionsWithModel.delete, (deleteKey) => ({DeleteRequest: {Key: deleteKey}}));
    var putRequests = _.map(optionsWithModel.put, (item) => ({PutRequest: {Item: item}}));

    return deleteRequests.concat(putRequests);
  };
};

module.exports = helpers;
