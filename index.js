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
    _documentClient: new aws.DynamoDB.DocumentClient()
  };

  //TODO populate with standard operations: createTable, deleteTable etc.

  store = _.reduce(operations, dynochamber._addOperataion, store);
  return store;
};

dynochamber._addTableName = function(query, tableName) {
  query.TableName = tableName;
  return query;
};

dynochamber._addDynamoOperation = function(query, operation) {
  return _.merge(query, operation);
};

dynochamber._stringHasPlaceholders = function(stringValue) {
  const regex = /\{\{([a-zA-Z]\w*)\}\}/;
  return _.isString(stringValue) && stringValue.match(regex) != null;
};

dynochamber._stringIsPlaceholder = function(stringValue) {
  const regex = /^\{\{([a-zA-Z]\w*)\}\}$/;
  var match = regex.exec(stringValue);

  if (match != null) {
    return match[1];
  }

  return false;
};

dynochamber._substitutePlaceholders = function(value, model) {
  var replacementKey = dynochamber._stringIsPlaceholder(value);
  if (replacementKey) return model[replacementKey];

  const regex = /\{\{([a-zA-Z]\w*)\}\}/g;
  var match;
  while ((match = regex.exec(value)) !== null) {
    var keyName = match[1];
    value = value.replace(new RegExp(`\{\{${keyName}\}\}`), model[keyName]);
  }

  return value;
};

dynochamber._fillPlaceholders = function(query, model) {
  traverse(query).forEach(function(value) {
    if (dynochamber._stringHasPlaceholders(value)) {
      this.update(dynochamber._substitutePlaceholders(value, model));
    }
  });

  return query;
};

dynochamber._cleanFromNonDynamoData = function(query) {
  const nonDynamoFields = ["_type"];
  return _.omit(query, nonDynamoFields);
};

dynochamber._addOperataion = function(store, operation, operationName) {
  store[operationName] = function(model, callback) {
    var buildDynamoQuery = _.flow(
      _.partialRight(dynochamber._addTableName, store._tableName),
      _.partialRight(dynochamber._addDynamoOperation, operation),
      _.partialRight(dynochamber._fillPlaceholders, model),

      dynochamber._cleanFromNonDynamoData);

    var initialQuery = {};
    var query = buildDynamoQuery(initialQuery);

    return query;
    // return store._documentClient[operation._type](query, callback);
  };

  return store;
};

module.exports = dynochamber;
