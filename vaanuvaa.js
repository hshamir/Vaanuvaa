//stat file servers

var express = require('express');
var clusterMaster = require("cluster-master")
var conf = require('./config');
var fs = require('fs');
var mongoose = require('mongoose');
var async = require('async');
var redis = require("redis").createClient();
var spawn = require('child_process').spawn; 
var util = require('./lib/util');
spawn('node',['lib/cache.js']);
clusterMaster('./dcom.js')