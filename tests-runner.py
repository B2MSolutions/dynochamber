import os;
import urllib;
from subprocess import call

def run_tests():
  call(["./spawn-dynamo-run-mocha.sh"])

def download_dynamo():
  call(["curl", "-o", "./dynamodb.zip", "http://dynamodb-local.s3-website-us-west-2.amazonaws.com/dynamodb_local_2016-05-17.zip"]);

def extract_dynamo():
  call(["unzip", "./dynamodb.zip", "-d", "./dynamodb"])

def delete_dynamo():
  call(["rm", "./dynamodb.zip"])

dbExists = os.path.isdir("./dynamodb")
if dbExists: run_tests()
else:
  download_dynamo()
  extract_dynamo()
  delete_dynamo()
  run_tests()
