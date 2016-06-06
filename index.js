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

dynochamber._operations = {
  batchGet: {action: dynochamber._pagingOperation, extractResult: r => r.Responses},
  get: {action: dynochamber._standardOperation, extractResult: r => r.Item}
  // batchWrite: dynochamber._standardOperation,
  // delete: dynochamber._standardOperation,
  // put: dynochamber._standardOperation,
  // query: dynochamber._pagingOperation,
  // scan: dynochamber._pagingOperation,
  // update: dynochamber._standardOperation
};

dynochamber._pagingOperation = function(params, callback) {
  //if user does not want paging operation, then it is a standard operation
  if (!params.queryOptions.pages) return dynochamber._standardOperation(params, callback);

  //TODO continue from here
};

dynochamber._standardOperation = function(params, callback) {
  return params.store._documentClient[params.operationType](params.builtQuery, function(err, results) {
    if (err) return callback(err);

    if (params.options.raw === true) {
      return callback(null, results);
    }

    return callback(null, params.dynochamberOperation.extractResult(results));
  });
};

dynochamber._addOperataion = function(store, operation, operationName) {
  store[operationName] = function(model, callback) {
    var builtQuery = queryBuilder.build(store._tableName, operation, model);
    var queryActionParams = {
      store,
      builtQuery,
      queryOptions: model._options,
      operationType: operation._type,
      dynochamberOperation: dynochamber._operations[operation._type]
    };

    return dynochamber._operations[operation._type].action(queryActionParams, callback);
  };

  return store;
};

module.exports = dynochamber;
