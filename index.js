var aws = require('aws-sdk');
var _ = require('lodash');
var async = require('async');
var queryBuilder = require('./query-builder');
var dynochamber = {};

//TODO add support for schema-related operations like crate/delete tables, update table etc.
dynochamber.loadStore = function(storeDefinition, customDynamoDB) {
  var tableName = storeDefinition.tableName;
  var schema = storeDefinition.schema;
  var operations = storeDefinition.operations;
  var documentClient = customDynamoDB ? new aws.DynamoDB.DocumentClient({ service: customDynamoDB }) : new aws.DynamoDB.DocumentClient();

  var store = {
    getTableName: function() { return _.isFunction(this._tableName) ? this._tableName() : this._tableName; },
    _tableName: tableName,
    _schema: schema,
    _operations: operations,
    _documentClient: documentClient
  };

  store = _.reduce(operations, dynochamber._addOperataion, store);
  return store;
};

dynochamber._batchGetPagingOperation = function(params, callback) {
  if (params.builtQuery.RequestItems.tableName) {
    var tableNameForBatchGet = params.queryOptions.tableName || params.builtQuery.TableName;
    params.builtQuery.RequestItems[tableNameForBatchGet] = params.builtQuery.RequestItems.tableName;

    delete params.builtQuery.RequestItems.tableName;
  }
  return dynochamber._pagingOperation(params, callback);
};

dynochamber._pagingOperation = function(params, callback) {
  // if user passes a table name as an option for the operation, use it
  // instead of using the one from the store definition
  if (params.queryOptions.tableName) params.builtQuery.TableName = params.queryOptions.tableName;

  //if user does not want paging operation, then it is a standard operation
  if (!params.queryOptions.pages) return dynochamber._standardOperation(params, callback);

  var lastEvaluatedKey;
  var query = params.builtQuery;
  var reducerResult = params.queryOptions.pageReduceInitial || null;

  return async.doWhilst(function(whileCallback) {
    if (lastEvaluatedKey) query.ExclusiveStartKey = lastEvaluatedKey;

    params.store._documentClient[params.operationType](query, function(err, results) {
      if (err) return whileCallback(err);

      lastEvaluatedKey = results.LastEvaluatedKey;
      try {
        results = dynochamber._bakeResults(params, results);
      } catch (outputErr) {
        return whileCallback(outputErr);
      }

      if (_.isFunction(params.queryOptions.pageCallback)) return params.queryOptions.pageCallback(results, whileCallback);
      if (_.isFunction(params.queryOptions.pageReduce)) {
        reducerResult = params.queryOptions.pageReduce(reducerResult, results);
      }

      return whileCallback();
    });

  }, function() {
    return !_.isUndefined(lastEvaluatedKey) && !_.isNull(lastEvaluatedKey);
  }, function(err, results) {
    return callback(err, params.queryOptions.pageReduce && !err ? reducerResult : null);
  });
};

dynochamber._standardOperation = function(params, callback) {
  // if user passes a table name as an option for the operation, use it
  // instead of using the one from the store definition
  if (params.queryOptions.tableName) params.builtQuery.TableName = params.queryOptions.tableName;
  return params.store._documentClient[params.operationType](params.builtQuery, function(err, results) {
    if (err) return callback(err);

    try {
      return callback(null, dynochamber._bakeResults(params, results));
    }
    catch (outputErr) {
      return callback(outputErr);
    }
  });
};

dynochamber._addOperataion = function(store, operation, operationName) {
  store[operationName] = function(model, callback) {
    model = _.cloneDeep(model) || {};
    var options = model._options || {};
    model = queryBuilder.cleanFromNonDynamoData(model);

    if (operation._validator) {
      var validationResults = operation._validator(model);
      if (validationResults && validationResults.failed) return callback(validationResults);
    }

    var builtQuery = queryBuilder.build(store._tableName, operation, model);
    var queryActionParams = {
      store,
      builtQuery,
      queryOptions: options,
      operationType: operation._type,
      dynochamberOperation: dynochamber._operations[operation._type],
      outputBuilder: operation._outputBuilder
    };

    return dynochamber._operations[operation._type].action(queryActionParams, callback);
  };

  return store;
};

dynochamber._operations = {
  batchGet: { action: dynochamber._batchGetPagingOperation, extractResult: r => r.Responses },
  get: { action: dynochamber._standardOperation, extractResult: r => r.Item },
  query: { action: dynochamber._pagingOperation, extractResult: r => r.Items },
  scan: { action: dynochamber._pagingOperation, extractResult: r => r.Items },
  put: { action: dynochamber._standardOperation, extractResult: _.identity },
  delete: { action: dynochamber._standardOperation, extractResult: _.identity },
  update: { action: dynochamber._standardOperation, extractResult: _.identity },
  batchWrite: { action: dynochamber._standardOperation, extractResult: _.identity }
};

//---helper options---
dynochamber.makeRecordsCounter = function(queryObj) {
  queryObj = _.cloneDeep(queryObj) || {};
  var options = queryObj ? (queryObj._options || {}) : {};

  queryObj._options = _.assign(options, {
    raw: true,
    pages: 'all',
    pageReduce: (result, page) => result + page.Count, pageReduceInitial: 0
  });

  return queryObj;
};

dynochamber._bakeResults = function(params, results) {
  if (params.queryOptions.raw === true) {
    return results;
  }

  if (params.outputBuilder) {
    return params.outputBuilder(results);
  }

  return params.dynochamberOperation.extractResult(results);
};

module.exports = dynochamber;
