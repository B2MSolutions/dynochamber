var AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000",
  accessKeyId: 'accessKeyId',
  secretAccessKey: 'secretAccessKey'
});

module.exports = function(callback) {
  var dynamodb = new AWS.DynamoDB();

  var params = {
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

  dynamodb.createTable(params, callback);
};
