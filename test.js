var aws = require("aws-sdk");
var _ = require('lodash/fp');
var dynochamber = require('./index');

aws.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

var store = dynochamber.loadStore({
  tableName: 'elemez.development.worlds',
  operations: {
    getWorld: {
      _type: 'get',
      Key: {id: "{{id}}"}
    },
    getAllWorlds: {
      _type: 'scan',
      FilterExpression: "contains(#name, :name)",
      ExpressionAttributeNames: {'#name': 'name'},
      ExpressionAttributeValues: {':name': '{{name}}'}
    }
  }
});

store.getWorld({id: '9b0546eb8601441eaddef58c31d2ca87'}, function(err, results) {
  console.log("ERROR: ", err);
  console.log(JSON.stringify(results, ' ', 2));
});

store.getAllWorlds({name: 'Development'}, function(err, results) {
  console.log("ERROR: ", err);
  console.log(JSON.stringify(results, ' ', 2));
});
