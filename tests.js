var _ = require('lodash');
var aws = require('aws-sdk');
var mocha = require('mocha');
var expect = require('chai').expect;
var provision = require('./provision-tests');
var dynochamber = require('./index');
var dynoHelpers = require('./helpers');
var sinon = require('sinon');

var storeDescription = {
  tableName: "Movies",
  operations: {
    addMovie: {
      _type: 'put',
      Item: '{{movie}}'
    },
    getMovieWithPart: {
      _type: 'get',
      Key: {
        title: "{{title}}:{{part}}:{{subtitle}}",
        year: "{{year}}"
      }
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
        Movies: dynoHelpers.batchWrite({ put: '{{movies}}' })
      }
    },
    getMovies: {
      _type: 'batchGet',
      RequestItems: {
        Movies: { Keys: '{{keys}}' }
      },
      Limit: 3
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
      _type: 'scan',
      Limit: 3
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
      },
      Limit: 3
    },
    getMoviesCountWithPaging: {
      _type: 'scan',
      Select: 'COUNT',
      Limit: 2
    },
    getMoviesWithDynamicTableName: {
      _type: 'batchGet',
      RequestItems: {
        tableName: { Keys: '{{keys}}' }
      },
      Limit: 3
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

  it("should support getting a name from a store", function() {
    var store = dynochamber.loadStore(storeDescription);
    expect(store.getTableName()).to.deep.equal("Movies");
  });

  it("should create a movie", function(done) {
    var store = dynochamber.loadStore(storeDescription);
    var movie = { year: 2013, title: "Superman", gross: 2000000 };

    store.addMovie({ movie }, handleError(done, function(results) {
      store.getMovie({ key: { year: 2013, title: "Superman" } }, handleError(done, function(results) {
        expect(results).to.deep.equal(movie);
        return done();
      }));
    }));
  });

  it("should delete movie", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.deleteMovie({ key: { year: 2013, title: "Superman" } }, handleError(done, function(results) {
      store.getMovie({ key: { year: 2013, title: "Superman" } }, handleError(done, function(results) {
        expect(results).to.not.exist;
        return done();
      }));
    }));
  });

  it("should get movie with composite placholder", function(done) {
    var store = dynochamber.loadStore(storeDescription);
    var movie = { year: 2013, title: "Superman:100:omg", gross: 2000000 };

    store.addMovie({ movie }, handleError(done, function(results) {
      store.getMovieWithPart({ year: 2013, title: "Superman", part: "100", subtitle: "omg" }, handleError(done, function(results) {
        expect(results).to.deep.equal(movie);

        store.deleteMovie({ key: { year: 2013, title: "Superman:100:omg" } }, done);
      }));
    }));
  });

  it("should batch write movies and batch get movies", function(done) {
    var store = dynochamber.loadStore(storeDescription);
    var movies = [{ year: 2015, title: "TMNT", gross: 100000 },
    { year: 2015, title: "Interstellar", gross: 10000000 }];

    store.addMovies({ movies }, handleError(done, function(results) {
      store.getMovies({ keys: _.map(movies, _.partialRight(_.omit, ['gross'])) }, handleError(done, function(results) {

        var tmnt = _.find(results.Movies, m => m.title === 'TMNT');
        expect(tmnt).to.deep.equal(movies[0]);

        var interstellar = _.find(results.Movies, m => m.title === 'Interstellar');
        expect(interstellar).to.deep.equal(movies[1]);

        return done();
      }));
    }));
  });

  it("should batch write movies and batch get movies if dynamic table name used in batch get", function(done) {
    var store = dynochamber.loadStore(storeDescription);
    var movies = [{ year: 2015, title: "TMNT", gross: 100000 },
    { year: 2015, title: "Interstellar", gross: 10000000 }];

    store.getMoviesWithDynamicTableName({ keys: _.map(movies, _.partialRight(_.omit, ['gross'])) }, handleError(done, function(results) {
      var tmnt = _.find(results.Movies, m => m.title === 'TMNT');
      expect(tmnt).to.deep.equal(movies[0]);

      var interstellar = _.find(results.Movies, m => m.title === 'Interstellar');
      expect(interstellar).to.deep.equal(movies[1]);

      return done();
    }));
  });

  it("should batch get movies if dynamic table name used in batch get and tableName passed through options", function(done) {
    var storeDescriptionWithIncorrectTableName = {
      tableName: "Movies-Incorrect",
      operations: {
        getMoviesWithDynamicTableName: {
          _type: 'batchGet',
          RequestItems: {
            tableName: { Keys: '{{keys}}' }
          },
          Limit: 3
        }
      }
    };
    var store = dynochamber.loadStore(storeDescriptionWithIncorrectTableName);
    var movies = [{ year: 2015, title: "TMNT", gross: 100000 },
                  { year: 2015, title: "Interstellar", gross: 10000000 }];

    store.getMoviesWithDynamicTableName({
      keys: _.map(movies, _.partialRight(_.omit, ['gross'])),
      _options: { tableName: 'Movies' }
    }, handleError(done, function(results) {
      var tmnt = _.find(results.Movies, m => m.title === 'TMNT');
      expect(tmnt).to.deep.equal(movies[0]);

      var interstellar = _.find(results.Movies, m => m.title === 'Interstellar');
      expect(interstellar).to.deep.equal(movies[1]);

      return done();
    }));
  });

  it("should update movie", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.addGrossAndSetRating({ key: { year: 2015, title: 'TMNT' }, rating: 4, gross: 20000 }, handleError(done, function(results) {
      store.getMovie({ key: { year: 2015, title: 'TMNT' } }, handleError(done, function(results) {
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
      var movies = [{ year: 2015, title: "TMNT", gross: 120000, rating: 4 },
      { year: 2015, title: "Interstellar", gross: 10000000 }];

      var tmnt = _.find(results, m => m.title === 'TMNT');
      expect(tmnt).to.deep.equal(movies[0]);

      var interstellar = _.find(results, m => m.title === 'Interstellar');
      expect(interstellar).to.deep.equal(movies[1]);

      return done();
    }));
  });

  it("should update movie with conditional", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.setHighRatingsForHighGrossing({ key: { year: 2015, title: 'TMNT' }, rating: 10 }, function(err, results) {
      expect(err.code).to.deep.equal("ConditionalCheckFailedException");
      return done();
    });
  });

  it("should query movies based on the year", function(done) {
    var store = dynochamber.loadStore(storeDescription);

    store.addMovies({ movies: [{ year: 2001, title: 'Matrix' }, { year: 1985, title: 'Robocop' }] }, handleError(done, function(results) {
      store.queryMoviesByYear({ year: 2001 }, handleError(done, function(results) {
        expect(results.length).to.equal(1);
        expect(results[0]).to.deep.equal({ year: 2001, title: 'Matrix' });
        return done();
      }));
    }));
  });

  it("should support tableName as a function", function(done) {
    var customStoreDefinition = {
      tableName: _ => "Movies",
      operations: {
        getMovie: {
          _type: 'get',
          Key: '{{key}}'
        }
      }
    };

    var store = dynochamber.loadStore(customStoreDefinition);
    expect(store.getTableName()).to.deep.equal("Movies");

    store.getMovie({ key: { year: 2015, title: "TMNT" } }, handleError(done, function(results) {
      var expectedResult = {
        "rating": 4,
        "gross": 120000,
        "title": "TMNT",
        "year": 2015
      };

      expect(results).deep.equal(expectedResult);
      return done();
    }));
  });

  describe("paging", function() {
    var store = null;

    before(function(done) {
      var movies = [
        { year: 1995, title: 'ToyStory' },
        { year: 1990, title: 'It' },
        { year: 1982, title: 'The Thing' },
        { year: 1978, title: 'Halloween' }

      ];

      store = dynochamber.loadStore(storeDescription);
      store.addMovies({ movies }, done);
    });

    it("should be supported by scan", function(done) {
      var currentPage = 0;
      var expectedPages = [
        [{
          "title": "Matrix",
          "year": 2001
        },
        {
          "title": "ToyStory",
          "year": 1995
        },
        {
          "title": "It",
          "year": 1990
        }
        ],
        [{
          "title": "The Thing",
          "year": 1982
        },
        {
          "title": "Interstellar",
          "gross": 10000000,
          "year": 2015
        },
        {
          "rating": 4,
          "gross": 120000,
          "title": "TMNT",
          "year": 2015
        }
        ],
        [{
          "title": "Robocop",
          "year": 1985
        },
        {
          "title": "Halloween",
          "year": 1978
        }
        ]];

      var pageCallback = function(page, callback) {
        expect(page).to.deep.equal(expectedPages[currentPage++]);
        return callback();
      };

      store.getAllMovies({ _options: { pages: 'all', pageCallback } }, done);
    });

    it("should be supported by query", function(done) {
      store.addMovies({
        movies: [
          { year: 1985, title: 'Back to the Future' },
          { year: 1985, title: 'The Goonies' },
          { year: 1985, title: 'The Breakfast Club' },
          { year: 1985, title: 'Rocky IV' },
          { year: 1985, title: 'A Nightmare on Elm Street Part 2: Freddy\'s Revenge' },
          { year: 1985, title: 'Commando' }
        ]
      }, handleError(done, function() {
        var currentPage = 0;
        var titles = [];

        var pageCallback = function(page, callback) {
          _.each(page, m => titles.push(m.title));
          return callback();
        };

        var payload = {
          year: 1985,
          _options: {
            pageCallback,
            pages: 'all'
          }
        };

        store.queryMoviesByYear(payload, handleError(done, function() {
          expect(titles.length).to.equal(7);
          return done();
        }));
      }));
    });

    it("should support page reducer", function(done) {
      store.getMoviesCountWithPaging({ _options: { raw: true, pages: 'all', pageReduce: (result, page) => result + page.Count, pageReduceInitial: 0 } }, handleError(done, function(result) {
        expect(result).to.equal(14);
        return done();
      }));
    });

    it("should support helper paging reducer options", function(done) {
      var params = { something: "hello" };
      store.getMoviesCountWithPaging(dynochamber.makeRecordsCounter(params), handleError(done, function(result) {
        //this expectation is written to verify that we do not modify passed parameters
        expect(params).to.deep.equal({ something: "hello" });
        expect(result).to.equal(14);
        return done();
      }));
    });
  });

  describe("validation", function() {
    it("should fail if validator is present and fails", function(done) {
      var descriptionWithValidator = {
        tableName: "Movies",
        operations: {
          addMovie: {
            _type: 'put',
            _validator: m => {
              if (_.isUndefined(m.gross) || _.isNull(m.gross)) return { failed: true, message: 'must have gross field' };
              return null;
            },
            Item: '{{movie}}'
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithValidator);

      store.addMovie({ movie: { year: 2010, title: 'Dark Knight' } }, function(err, results) {
        expect(results).to.not.exist;
        expect(err).to.deep.equal({ failed: true, message: 'must have gross field' });
        return done();
      });
    });

    it("should not fail if validator is present, but do not fail", function(done) {
      var descriptionWithValidator = {
        tableName: "Movies",
        operations: {
          addMovie: {
            _type: 'put',
            _validator: m => ({ failed: false }),
            Item: '{{movie}}'
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithValidator);

      store.addMovie({ movie: { year: 2010, title: 'Dark Knight' } }, function(err, results) {
        expect(err).to.not.exist;
        return done();
      });
    });

    it("should call validator once", function(done) {
      var descriptionWithValidator = {
        tableName: "Movies",
        operations: {
          addMovie: {
            _type: 'put',
            _validator: m => ({ failed: false }),
            Item: '{{movie}}'
          }
        }
      };
      var spy = sinon.spy(descriptionWithValidator.operations.addMovie, "_validator");
      var store = dynochamber.loadStore(descriptionWithValidator);

      store.addMovie({ movie: { year: 2010, title: 'Dark Knight' } }, function(err, results) {
        expect(spy.called).to.be.true;
        expect(spy.callCount).to.be.equal(1);
        return done();
      });
    });

    it("should not fail if validator returns nothing", function(done) {
      var descriptionWithValidator = {
        tableName: "Movies",
        operations: {
          addMovie: {
            _type: 'put',
            _validator: m => null,
            Item: '{{movie}}'
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithValidator);

      store.addMovie({ movie: { year: 2011, title: 'Dark Knight Rises' } }, function(err, results) {
        expect(err).to.not.exist;
        return done();
      });
    });

    it("should apply validation on pure model", function(done) {
      var descriptionWithValidator = {
        tableName: "Movies",
        operations: {
          addMovie: {
            _type: 'put',
            _validator: m => m._options ? { failed: true } : { failed: false },
            Item: '{{movie}}'
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithValidator);

      store.addMovie({ movie: { year: 2011, title: 'Dark Knight Rises' }, _options: {} }, function(err, results) {
        expect(err).to.not.exist;
        return done();
      });
    });
  });

  describe("external dynamoDB", function() {
    it('should fail when dynamodb is reconfigured with a custom dynamodb client', function(done) {
      var dynamodbClient = new aws.DynamoDB({ endpoint: new aws.Endpoint("http://localhost:4242") });
      var store = dynochamber.loadStore(storeDescription, dynamodbClient);

      store.getMovie({ key: { year: 2013, title: "Superman" } }, handleError(done, function(results) {
        // this operation should never succeed, meaning this line should not be executed
        expect(true).to.be.false;
        return done();
      }));

      global.setTimeout(_ => { return done(); }, 1000);
    });
  });

  describe("operation-scope table name", function() {
    it("should allow to specify a tablename for a specific operation (not paging)", function(done) {
      var store = dynochamber.loadStore(storeDescription);
      var movie = { year: 2018, title: "Hulk", gross: 200000 };
      var film = { year: 2018, title: "Hulk", gross: 100000 };

      // add movie
      store.addMovie({ movie }, handleError(done, function(results) {
        // add film into a separate table
        store.addMovie({ movie: film, _options: { tableName: "Films" } }, handleError(done, function(results) {

          // get from movies
          store.getMovie({ key: { year: 2018, title: "Hulk" } }, handleError(done, function(results) {
            expect(results).to.deep.equal({
              "title": "Hulk",
              "gross": 200000,
              "year": 2018
            });

            // get from films
            store.getMovie({ key: { year: 2018, title: "Hulk" }, _options: { tableName: "Films" } }, handleError(done, function(results) {
              expect(results).to.deep.equal({
                "title": "Hulk",
                "gross": 100000,
                "year": 2018
              });

              return done();
            }));
          }));
        }));
      }));
    });

    it("should allow to specify a tablename for a specific operation (paging)", function(done) {
      var store = dynochamber.loadStore(storeDescription);

      // movies hulk
      store.queryMoviesByYear({ year: 2018 }, handleError(done, function(results) {
        expect(results.length).to.equal(1);
        expect(results[0]).to.deep.equal({ year: 2018, title: 'Hulk', gross: 200000 });

        // films hulk
        store.queryMoviesByYear({ year: 2018, _options: { tableName: "Films" } }, handleError(done, function(results) {
          expect(results.length).to.equal(1);
          expect(results[0]).to.deep.equal({ year: 2018, title: 'Hulk', gross: 100000 });

          return done();
        }));
      }));
    });
  });

  describe("outputBuilder", function() {
    it("should use outputBuilder before returning results", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            _outputBuilder: results => _.map(results.Items, 'title')
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithBuilder);

      store.getMovieNames({ year: 1985 }, function(err, results) {
        expect(err).to.not.exist;
        expect(results).to.deep.equal(['A Nightmare on Elm Street Part 2: Freddy\'s Revenge', 'Back to the Future', 'Commando', 'Robocop', 'Rocky IV', 'The Breakfast Club', 'The Goonies']);

        return done();
      });
    });

    it("should use outputBuilder only once", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            _outputBuilder: results => _.map(results.Items, 'title')
          }
        }
      };
      var spy = sinon.spy(descriptionWithBuilder.operations.getMovieNames, "_outputBuilder");
      var store = dynochamber.loadStore(descriptionWithBuilder);

      store.getMovieNames({ year: 1985 }, function(err, results) {
        expect(spy.called).to.be.true;
        expect(spy.callCount).to.be.equal(1);
        return done();
      });
    });

    it("should return error when outputBuilder throws", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            _outputBuilder: results => { throw "outputBuilder error" }
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithBuilder);

      store.getMovieNames({ year: 1985 }, function(err, results) {
        expect(err).to.equal("outputBuilder error");
        expect(results).to.not.exist;

        return done();
      });
    });

    it("should ignore outputBuilder before returning results with raw", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            Limit: 2,
            _outputBuilder: results => ({ items: _.map(results.Items, 'title'), lastKey: results.LastEvaluatedKey })
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithBuilder);

      store.getMovieNames({ year: 1985, _options: { raw: true } }, function(err, results) {
        expect(err).to.not.exist;
        expect(results).to.deep.equal({
          Items: [{
            title: "A Nightmare on Elm Street Part 2: Freddy's Revenge",
            year: 1985
          },
          {
            title: "Back to the Future",
            year: 1985
          }
          ],
          LastEvaluatedKey: {
            title: "Back to the Future",
            year: 1985
          },
          Count: 2,
          ScannedCount: 2
        });

        return done();
      });
    });

    it("should use outputBuilder when using paging with reduce", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            Limit: 1,
            _outputBuilder: results => _.map(results.Items, 'title')
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithBuilder);

      store.getMovieNames({ year: 1985, _options: { pages: 'all', pageReduce: (result, page) => _.union(result, page), pageReduceInitial: [] }, }, function(err, results) {
        expect(err).to.not.exist;
        expect(results).to.deep.equal(['A Nightmare on Elm Street Part 2: Freddy\'s Revenge', 'Back to the Future', 'Commando', 'Robocop', 'Rocky IV', 'The Breakfast Club', 'The Goonies']);

        return done();
      });
    });

    it("should return error when outputBuilder throws when using paging with reduce", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            Limit: 1,
            _outputBuilder: results => { throw "outputBuilder Error" }
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithBuilder);

      store.getMovieNames({ year: 1985, _options: { pages: 'all', pageReduce: (result, page) => _.union(result, page), pageReduceInitial: [] }, }, function(err, results) {
        expect(err).to.be.equal("outputBuilder Error");
        expect(results).to.not.exist;

        return done();
      });
    });

    it("should ignore outputBuilder when using paging with reduce and raw", function(done) {
      var descriptionWithBuilder = {
        tableName: "Movies",
        operations: {
          getMovieNames: {
            _type: 'query',
            KeyConditionExpression: '#year = :year',
            ExpressionAttributeNames: {
              '#year': 'year'
            },
            ExpressionAttributeValues: {
              ':year': '{{year}}'
            },
            Limit: 2,
            _outputBuilder: results => ({ items: _.map(results.Items, item => item.year + '#' + item.title), total: results.Count })
          }
        }
      };

      var store = dynochamber.loadStore(descriptionWithBuilder);
      var reducer = (result, page) => ({ Items: _.union(result.Items, page.Items), Count: result.Count + page.Count });

      store.getMovieNames({ year: 1985, _options: { raw: true, pages: 'all', pageReduce: reducer, pageReduceInitial: { Items: [], Count: 0 } }, }, function(err, results) {
        expect(err).to.not.exist;
        expect(results).to.deep.equal({
          Count: 7,
          Items: [
            { title: 'A Nightmare on Elm Street Part 2: Freddy\'s Revenge', year: 1985 },
            { title: 'Back to the Future', year: 1985 },
            { title: 'Commando', year: 1985 },
            { title: 'Robocop', year: 1985 },
            { title: 'Rocky IV', year: 1985 },
            { title: 'The Breakfast Club', year: 1985 },
            { title: 'The Goonies', year: 1985 }
          ]
        });

        return done();
      });
    });
  });
});
