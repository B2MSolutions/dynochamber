var AWS = require("aws-sdk");
var helpers = require('./helpers');
var dynochamber = require('./index');

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

var dynamodb = new AWS.DynamoDB();

var store = dynochamber.loadStore({
  tableName: 'movies',
  operations: {

    getMovie: {
      _type: 'get',
      Key: {movieName: '{{name}}'}
    },
    batchGetMovies: {
      _type: 'batchGet',
      RequestItems: {
        movies: {
          Keys: '{{keys}}'
        }
      }
    },
    getAllMovies: {
      _type: 'scan'
    },
    saveMovie: {
      _type: 'put',
      Item: '{{movie}}'
    },
    batchSaveMovies: {
      _type: 'batchWrite',
      RequestItems: {
        movies: helpers.batchWrite({put: '{{put}}', delete: '{{delete}}'})
      }
    },

    //updates
    updateDirector: {
      _type: 'update',
      Key: {movieName: '{{movieName}}'},
      UpdateExpression: 'set director = :director',
      ExpressionAttributeValues: {
        ':director': '{{director}}'
      }
    },
    addVisitors: {
      _type: 'update',
      Key: {movieName: '{{movieName}}'},
      UpdateExpression: 'add visitors :visitors',
      ExpressionAttributeValues: {
        ':visitors': '{{visitors}}'
      }
    }
  }
});

// store.batchSaveMovies({put: [
//   {movieName: "hello", director: "Fincher"},
//   {movieName: "Aliens", director: "Cameron"}
// ]}, function(err) {
//   console.log(err);
// });

// store.batchGetMovies({keys: [
//   {movieName: 'terminator'},
//   {movieName: 'sugar'}
// ]}, function(err, results) {
//   console.log(err);
//   console.log(JSON.stringify(results, ' ', 2));
// });

// store.addVisitors({movieName: 'terminator', visitors: 200}, function (err) {
//   console.log(err);
// });

// store.saveMovie({movie: {movieName: "sugar", director: "James Cameron", visitors: 112}}, function(err) {
//   console.log(err);
// });

// store.updateDirector({movieName: "terminator", director: "unknown"}, function(err) {
//   console.log(err);
// });

// store.getAllMovies({attributes: "movieName, visitors, director"}, function(err, results) {
//   if (err) {console.log(err); return;}

//   console.log(JSON.stringify(results, ' ', 2));
// });
