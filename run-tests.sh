#!/bin/bash

java -Djava.library.path=./dynamodb/DynamoDBLocal_lib -jar ./dynamodb/DynamoDBLocal.jar -inMemory &
dynamo_pid=$!
./node_modules/.bin/mocha ./tests.js
kill $dynamo_pid
