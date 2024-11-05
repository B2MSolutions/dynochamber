var AWS = require('aws-sdk/global');
var async = require("async");

AWS.config.update({
  endpoint: "http://localhost:8000",
  accessKeyId: 'accessKeyId',
  secretAccessKey: 'secretAccessKey'
});

module.exports = function(callback) {
  var dynamodb = new AWS.DynamoDB();

  var movies = {
    TableName : "Movies",
    KeySchema: [
      { AttributeName: "year", KeyType: "HASH"},
      { AttributeName: "title", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
      { AttributeName: "year", AttributeType: "N" },
      { AttributeName: "title", AttributeType: "S" }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };

  var films = {
    TableName : "Films",
    KeySchema: [
      { AttributeName: "year", KeyType: "HASH"},
      { AttributeName: "title", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
      { AttributeName: "year", AttributeType: "N" },
      { AttributeName: "title", AttributeType: "S" }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };

  async.parallel([
    dynamodb.createTable.bind(dynamodb, movies),
    dynamodb.createTable.bind(dynamodb, films)
  ], callback);
};
