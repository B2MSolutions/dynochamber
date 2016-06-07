var _ = require('lodash');
var mocha = require('mocha');
var expect = require('chai').expect;
var provision = require('./provision-tests');
var dynochamber = require('./index');
var dynoHelpers = require('./helpers');

var storeDescription = {
  tableName: "Movies",
  operations: {
    addMovie: {
      _type: 'put',
      Item: '{{movie}}'
    },
    getMovie: {
      _type: 'get',
      Key: '{{key}}'
    },
    deleteMovie: {
      _type: 'delete',
      Key: '{{key}}'
    },
    addMovies: {
      _type: 'batchWrite',
      RequestItems: {
        Movies: dynoHelpers.batchWrite({put: '{{movies}}'})
      }
    },
    getMovies: {
      _type: 'batchGet',
      RequestItems: {
        Movies: {Keys: '{{keys}}'}
      }
    },
    addGrossAndSetRating: {
      _type: 'update',
      Key: '{{key}}',
      UpdateExpression: 'set rating = :rating add gross :gross',
      ExpressionAttributeValues: {
        ':rating': '{{rating}}',
        ':gross': '{{gross}}'
      }
    },
    getAllMovies: {
      _type: 'scan'
    },
    setHighRatingsForHighGrossing: {
      _type: 'update',
      Key: '{{key}}',
      UpdateExpression: 'set rating = :rating',
      ConditionExpression: 'gross > :grossLevel',
      ExpressionAttributeValues: {
        ':rating': '{{rating}}',
        ':grossLevel': 500000
      }
    },
    queryMoviesByYear: {
      _type: 'query',
      KeyConditionExpression: '#year = :year',
      ExpressionAttributeNames: {
        '#year': 'year'
      },
      ExpressionAttributeValues: {
        ':year': '{{year}}'
      }
    }
  }
};

// ----- helpers ---------------
function handleError(done, callback) {
  return function(err, results) {
    if (err) {
      console.log(err);
      expect(err).to.not.exist;

      return done();
    }

    return callback(results);
  };
}
//------------------------------


describe("integration tests for dynochamber", function() {
  before(function(done) {
    provision(done);
  });

  it("should create a movie", function(done) {
    var store = dynochamber.loadStore(storeDescription);
    var movie = {year: 2013, title: "Superman", gross: 2000000};

    store.addMovie({movie}, handleError(done, function(results) {
      store.getMovie({key: {year: 2013, title: "Superman"}}, handleError(done, function(results) {
        expect(results).to.deep.equal(movie);
        return done();
      }));
    }));
  });

  it("should delete movie", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.deleteMovie({key: {year: 2013, title: "Superman"}}, handleError(done, function(results) {
      store.getMovie({key: {year: 2013, title: "Superman"}}, handleError(done, function(results) {
        expect(results).to.not.exist;
        return done();
      }));
    }));
  });

  it("should batch write movies and batch get movies", function(done) {
    var store = dynochamber.loadStore(storeDescription);
    var movies = [{year: 2015, title: "TMNT", gross: 100000},
                  {year: 2015, title: "Interstellar", gross: 10000000}];

    store.addMovies({movies}, handleError(done, function(results) {
      store.getMovies({keys: _.map(movies, _.partialRight(_.omit, ['gross']))}, handleError(done, function(results) {

        var tmnt = _.find(results.Movies, m => m.title === 'TMNT');
        expect(tmnt).to.deep.equal(movies[0]);

        var interstellar = _.find(results.Movies, m => m.title === 'Interstellar');
        expect(interstellar).to.deep.equal(movies[1]);

        return done();
      }));
    }));
  });

  it("should update movie", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.addGrossAndSetRating({key: {year: 2015, title: 'TMNT'}, rating: 4, gross: 20000}, handleError(done, function(results) {
      store.getMovie({key: {year: 2015, title: 'TMNT'}}, handleError(done, function(results) {
        expect(results).to.deep.equal({
          year: 2015,
          title: 'TMNT',
          rating: 4,
          gross: 120000
        });

        return done();
      }));
    }));
  });

  it("should get all movies by scan", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.getAllMovies(null, handleError(done, function(results) {
      var movies = [{year: 2015, title: "TMNT", gross: 120000, rating: 4},
                    {year: 2015, title: "Interstellar", gross: 10000000}];

      var tmnt = _.find(results, m => m.title === 'TMNT');
      expect(tmnt).to.deep.equal(movies[0]);

      var interstellar = _.find(results, m => m.title === 'Interstellar');
      expect(interstellar).to.deep.equal(movies[1]);

      return done();
    }));
  });

  it("should update movie with conditional", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.setHighRatingsForHighGrossing({key: {year: 2015, title: 'TMNT'}, rating: 10}, function(err, results) {
      expect(err.code).to.deep.equal("ConditionalCheckFailedException");
      return done();
    });
  });

  it("should query movies based on the year", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.addMovies({movies: [{year: 2001, title: 'Matrix'}, {year: 1985, title: 'Robocop'}]}, handleError(done, function(results) {
      store.queryMoviesByYear({year: 2001}, handleError(done, function(results) {
        expect(results.length).to.equal(1);
        expect(results[0]).to.deep.equal({year: 2001, title: 'Matrix'});
        return done();
      }));
    }));
  });
});
