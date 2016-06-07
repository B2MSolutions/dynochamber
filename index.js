var aws = require('aws-sdk');
var _ = require('lodash');
var async = require('async');
var queryBuilder = require('./query-builder');
var dynochamber = {};

//TODO add support for schema-related operations like crate/delete tables, update table etc.
dynochamber.loadStore = function(storeDefinition) {
  var tableName = storeDefinition.tableName;
  var schema = storeDefinition.schema;
  var operations = storeDefinition.operations;

  var store = {
    _tableName: tableName,
    _schema: schema,
    _operations: operations,
    _documentClient: new aws.DynamoDB.DocumentClient()
  };

  store = _.reduce(operations, dynochamber._addOperataion, store);
  return store;
};

dynochamber._pagingOperation = function(params, callback) {
  //if user does not want paging operation, then it is a standard operation
  if (!params.queryOptions.pages) return dynochamber._standardOperation(params, callback);

  var lastEvaluatedKey;
  var query = params.builtQuery;
  return async.doWhilst(function(whileCallback) {
    if (lastEvaluatedKey) query.ExclusiveStartKey = lastEvaluatedKey;

    params.store._documentClient[params.operationType](query, function(err, results) {
      if (err) return whileCallback(err);

      lastEvaluatedKey = results.LastEvaluatedKey;
      results = params.queryOptions.raw === true ? results : params.dynochamberOperation.extractResult(results);

      if (_.isFunction(params.queryOptions.pageCallback)) params.queryOptions.pageCallback(results, whileCallback);

      return whileCallback();
    });

  }, function() {
    return !_.isUndefined(lastEvaluatedKey) && !_.isNull(lastEvaluatedKey);
  }, callback);
};

dynochamber._standardOperation = function(params, callback) {
  return params.store._documentClient[params.operationType](params.builtQuery, function(err, results) {
    if (err) return callback(err);

    if (params.queryOptions.raw === true) {
      return callback(null, results);
    }

    return callback(null, params.dynochamberOperation.extractResult(results));
  });
};

dynochamber._addOperataion = function(store, operation, operationName) {
  store[operationName] = function(model, callback) {
    model = model || {};

    var builtQuery = queryBuilder.build(store._tableName, operation, model);
    var queryActionParams = {
      store,
      builtQuery,
      queryOptions: model._options || {},
      operationType: operation._type,
      dynochamberOperation: dynochamber._operations[operation._type]
    };

    return dynochamber._operations[operation._type].action(queryActionParams, callback);
  };

  return store;
};

dynochamber._operations = {
  batchGet: {action: dynochamber._pagingOperation, extractResult: r => r.Responses},
  get: {action: dynochamber._standardOperation, extractResult: r => r.Item},
  query: {action: dynochamber._pagingOperation, extractResult: r => r.Items},
  scan: {action: dynochamber._pagingOperation, extractResult: r => r.Items},
  put: {action: dynochamber._standardOperation, extractResult: _.identity},
  delete: {action: dynochamber._standardOperation, extractResult: _.identity},
  update: {action: dynochamber._standardOperation, extractResult: _.identity},
  batchWrite: {action: dynochamber._standardOperation, extractResult: _.identity}
};

module.exports = dynochamber;
