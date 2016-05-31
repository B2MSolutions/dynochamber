var aws = require('aws-sdk');
var traverse = require('traverse');
var _ = require('lodash');
var dynochamber = {};

dynochamber.loadStore = function(storeDefinition) {
  //TODO add validation

  var tableName = storeDefinition.tableName;
  var schema = storeDefinition.schema;
  var operations = storeDefinition.operations;

  var store = {
    _tableName: tableName,
    _schema: schema,
    _operations: operations,
    _documentClient: new aws.DyanmoDB.DocumentClient()
  };

  //TODO populate with standard operations: createTable, deleteTable etc.
  // populate with business operations
  return store = _.reduce(operations, dynochamber._addOperataion, store);
};

dynochamber._addTableName = function(query, tableName) {
  query.TableName = tableName;
  return query;
};

dynochamber._addDynamoOperation = function(query, operation) {
  return _.merge(query, operation);
};

dynochamber._fillPlaceholders = function(query, model) {
  //TODO fill placeholders here
};

dynochamber._cleanFromNonDynamoData = function(query) {
  const nonDynamoFields = ["_type"];
  return _.omit(query, nonDynamoFields);
};

dynochamber._addOperataion = function(store, operation, operationName) {
  return store[operationName] = function(model, callback) {

    var buildDynamoQuery = _.flow(
      _.partialRight(dynochamber._addTableName, store._tableName),
      _.partialRight(dynochamber._addDynamoOperation, operation),
      _.partialRight(dynochamber._fillPlaceholders, model),

      dynochamber._cleanFromNonDynamoData);

    var initialQuery = {};
    var query = buildDynamoQuery(initialQuery);

    return store._documentClient[operation._type](query, callback);
  };
};

module.exports = dynochamber;
