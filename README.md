# Dynochamber

### Rationale
Dynochamber helps you to build a store layer for your app from a list of DynamoDB operations.
Usually, we have a module, like `store` that exposes storage-related operations, like create, read, update, delete, and different queries with parameters.

```javascript
exports.getMovie = function(year, title, callback) {
	var params = {
      TableName: 'movies',
      Key:{
          "year": year,
          "title": title
      }
    };

    documentClient.get(params, callback);
}

exports.updateMovie = function(year, title, info) {
	var params = {
    	TableName: 'movies',
        Key:{
            "year": year,
            "title": title
        },
        UpdateExpression: "set info.rating = :r, info.plot=:p, info.actors=:a",
        ExpressionAttributeValues:{
            ":r": info.rating,
            ":p": info.plot,
            ":a": info.actors
        },
        ReturnValues:"UPDATED_NEW"
    };

    documentClient.update(params, callback);
}

exports.addRating = function(year, title, rating) {
	var params = {
    	TableName: 'movies',
        Key:{
            "year": year,
            "title": title
        },
        UpdateExpression: "set info.rating = info.rating + :val",
        ExpressionAttributeValues:{
        	":val": rating
        },
        ReturnValues:"UPDATED_NEW"
    };

    documentClient.update(params, callback);
}
//etc.
```

In each of those functions we have a different DynamoDB query that we pass to AWS DynamoDB client or Node-specific DocumentClient.

Dynochamber simplifies building these store modules by allowing you to write only DynamoDB queries and then generate a store for them. The code above with Dynochamber looks like:

```javascript
var storeDefinition = {
	tableName: 'movies',
    operations: {
    	getMovie: {
    		_type: 'get',
        	Key: '{{key}}',
        },
        updateMovie: {
        	_type: 'update',
        	Key: '{{key}}',
        	UpdateExpression: "set info.rating = :r, info.plot=:p, info.actors=:a",
            ExpressionAttributeValues:{
              ":r": '{{rating}}',
              ":p": '{{plot}}',
              ":a": '{{actors}}'
          	},
            ReturnValues:"UPDATED_NEW"
        },
        addRating: {
        	_type: 'update',
        	Key: '{{key}}',
            UpdateExpression: "set info.rating = info.rating + :val",
            ExpressionAttributeValues:{
                ":val": '{{rating}}'
            },
            ReturnValues:"UPDATED_NEW"
        }
    }
};

var moviesStore = dynochamber.loadStore(storeDescription);

// all operations are available as function on the moviesStore:
store.getMovie({key: {year: 1979, title: 'Alien'}}, function(err, results) { /* rest */ });

store.updateMovie({
	key: {year: 1979, title: 'Alien'},
  	rating: 42,
  	plot: 'scary',
  	actors: ['Sigourney Weaver', 'Tom Skerritt', 'Veronica Cartwright']
}, function(err, results) { /* rest */ });

store.addRating({key: {year: 1979, title: 'Alien'}, rating: 10},
                function(err, results) { /* rest */ });

```
---
### Placeholders
Dynochamber uses placeholders to insert data that you pass to generated store functions into DynamoDB queries. A placeholder can be in any place of a query and is substituted by passed data, whether it is a primitive type or an object.

```javascript
getMovie: {
	_type: 'get',
	Key: '{{key}}',
}
//....
store.getMovie({key: {year: 1985, title: 'something'}})

```
When Dynochamber constructs this query it finds placeholder's name in passed object and substitutes placeholder with the data.

Placeholders can also be a part of a string
```javascript
getMovie: {
	_type: 'get',
	Key: 'Aliens {{part}}',
}
//....
store.getMovie({part: '2'})
//OR
store.getMovie({part: '3'})

```


---
### Store Description
Store description is an object that describes all store operations and also contains an additional information required for store construction.

```javascript
{
	tableName: "Name of the table on which all operatoins are performed",
    operations: { //store's operations
    	nameOfOperation: { //name of an operation on a store
        	// here you write your query for DynamoDB. It's absolutely the same as the
            // one you write for DocumentClient, but with placeholders.
            // As an example, I wrote a query item request
            KeyConditionExpression: "#name = :name",
            ExpressionAttributeNames:{
              "#name": "name"
            },
            ExpressionAttributeValues: {
              ":name": "{{name}}"
            },

            // in addition to standard DynamoDB query fields we also need to specify
            // the type of operation. "query" in this case.
            // Supported types: put, get, delete, update, query, batchGet,
            // batchWrite, scan  (everything you can do with DocumentClient)
            _type: "query"
        }
    }
}
```
---
### Paging support
You can pass options as a part of an object that you pass to a store. For now, options are used only to support paging. There are two properties that you can use for it - `pages` and `pageCallback`

- **pages** - for now, this property can have only one value - 'all', otherwise your page callback won't work. In future, this property would be used to indicate over how many pages  you want to iterate.
- **pageCallback** - function that gets called on every page processed received by the library.

Example:
```javascript
var pageCallback = function(page, callback) {
	// do something with the page
    // you can report errors by calling the passed callback with an error
    callback();
};

store.scanItems({_options: {page: 'all', pageCallback: pageCallback}, done);
```
---
### Validation
You can add a validation function to a store description.

```javascript
{
	tableName: "Name of the table on which all operatoins are performed",
    operations: { //store's operations
    	nameOfOperation: { //name of an operation on a store
        	_type: 'query',
        	// DocumentClient query goes here
            _validator: function(obj) { /* validation logic */ }
        }
    }
}
```

Validation function gets called with an object that is passed as the first argument to a store operation. To fail, validation function should return object with `failed` property set to `true`. All other results are considered non-failed.

---
### Output builder
You can add builder function to a store description.

```javascript
{
	tableName: "Name of the table on which all operatoins are performed",
    operations: { //store's operations
    	nameOfOperation: { //name of an operation on a store
        	_type: 'query',
        	// DocumentClient query goes here
            _outputBuilder: function(rawResult) { /* output building logic */ }
        }
    }
}
```

Output builder function gets called before returning data. It is useful to restructure data in the way application expects to receive it back.

Output builder always receive raw database data.

When used with paging and reducer, output builder function will be called before passing data to reducer. So reducer will aggregate built results in this case.

Same rule applies to pageCallback, it will receive result returned by output builder for each page.

---
### Operation level table name
You can specify a different table name when you call an operation on a store. This is supported for "recyclable" tables, when you need to switch between tables with the same schema in runtime (example, you don't want your table to be partitioned and want to save data to a new table)
Example:
```javascript
// this will execute your query against "SOME_OTHER_TABLE" instead of the table set in the store definition
store.getAllMovies({_options: {tableName: 'SOME_OTHER_TABLE'}, done);
```

You can also get a name of the table set in the store definition, using `getTableName` on the generated store object
Example:
```javascript
var moviesStore = dynochamber.loadStore(storeDescription);

// this prints 'movies'
console.log(moviesStore.getTableName());
```

---
### Table name in batchGet
You can use table name set in store definition level inside BatchGetItem query. To do this use `tableName` as a table name inside `RequestItems` block. Dynochamber will replace `tableName` to actual table name
set in store definition.

Example:
```javascript
{
    tableName: "MoviesTables",
    operations: { //store's operations
    	getMovies: { //name of an operation on a store
        	_type: 'batchGet',
            RequestItems: {
                tableName: { Keys: '{{keys}}' } // This will be rewritten to 'MoviesTable: { Keys: '{{keys}}' }
            }
        }
    }
}
```
---
Code released under the MIT license
