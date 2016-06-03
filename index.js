var aws = require('aws-sdk');
var _ = require('lodash');
var queryBuilder = require('./query-builder');
var dynochamber = {};

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

  //TODO populate with standard operations:
  //createTable, describeTable, updateTable and deleteTable
  store = _.reduce(operations, dynochamber._addOperataion, store);
  return store;
};

dynochamber._addOperataion = function(store, operation, operationName) {
  store[operationName] = function(model, callback) {
    var builtQuery = queryBuilder.build(store._tableName, operation, model);
    return store._documentClient[operation._type](builtQuery, callback);
  };

  return store;
};

module.exports = dynochamber;
