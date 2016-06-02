var aws = require("aws-sdk");
var _ = require('lodash');
var dynochamber = require('./index');

aws.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

var store = dynochamber.loadStore({
  tableName: 'elemez.development.worlds',
  operations: {
    getWorlds: {
      _type: 'get',
      Key: {id: "{{id}}"}
    }
  }
});


// store.getWorlds();
var a = dynochamber._substitutePlaceholders("{{hello}} and {{fcu}}");
console.log(a);
