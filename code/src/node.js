/* Node in a network */
var Tables = require('./neighborhoodTables.js'),
uuid = require('node-uuid'),
Server = require('./server.js'),
Client = require('./client.js'),
fs = require('fs'),
EventEmitter = require('events').EventEmitter,
util = require('util'),
Log = require('./log.js'),
ldf = require('./node_modules/Client.js-feature-asynciterator/ldf-client.js'),
HashMap = require('hashmap'),
PropertiesReader = require('properties-reader');
Logger = require('./node_modules/Client.js-feature-asynciterator/ldf-client.js').Logger,
lruCache = require('lru-cache'),
cacheToProfile = require('./cacheToProfile.js'),
fifo = require('fifo'),
mkdirp = require('mkdirp'),
status = require('./status.js');

var done = 1, 
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
properties = PropertiesReader(process.env.DELEGATE_HOME + '/bin/config.properties');

Logger.setLevel('ALERT');


/**
 * @param {String} ip: IP address of the node
 * @param {Integer} nbMaxRandomPeer: nb of peers in the Random Peer table
 * @param {Integer} nbMaxClusterPeer: nb of peers in the Cluster Peer table
 * @param {Function} networkSimilarityMethod: method used to compute the similarity between nodes
 * @param {Boolean} fullPredicate: true if we consider complete fragment, false otherwise
 * @param {String} startFragment: address of the dataset
 * [@param {String} peer: optional, a peer in the network]
 */
function Node (ip, nbMaxRandomPeer, nbMaxClusterPeer, networkSimilarityMethod, fullPredicate, startFragment, repBaseLog, port, peer) {
    this._id = uuid.v4();
    this._ip = ip;
    this._startFragment = startFragment;
    this._maxSizeCache = properties.get('sizeCache'); // Same as cache in FragmentClient.js
    this._peer = peer || undefined; 
    this._port = port || undefined;
    this._nbMaxRandomPeer = nbMaxRandomPeer;
    this._nbMaxClusterPeer= nbMaxClusterPeer;
    this._networkSimilarityMethod = networkSimilarityMethod;
    this._repBase = repBaseLog;
    this._queriesQueue = new fifo();
    this._status = status.WAITING;
    this._round = 'warmUp';

    EventEmitter.call(this);
    
    var self = this;

    this.on('FINISH', function() {
	console.log('emitFinish');
//	if (self._status != status.WAITING && self._status != status.EXECUTING && self._status != status.PENDING)
	if (self._status != status.WAITING)
	    self.executeQuery();
    });

    this.start();
}
util.inherits(Node, EventEmitter);

Node.prototype.start = function () {    
    console.log('Node - port: ', this._port);
    this._fragmentsClient = new ldf.FragmentsClient(this._startFragment);
    this._cache = this._fragmentsClient.getCache();
    console.log('Profile size:', properties.get('kprofile'));
    this._profile = new lruCache({max: properties.get('kprofile')});
    this._tables = new Tables(this._nbMaxRandomPeer, this._nbMaxClusterPeer, this._networkSimilarityMethod, this._id, this._cache, this._profile);

    this._client = new Client(this);
    this._server = new Server(this);

    this._fragmentsClient.setProfileAndTransform(this._profile, cacheToProfile);
};

Node.prototype.query = function(query, idQuery, roundType, idRound, nbQueries, idClient, dataset) {
    console.log('Node - add query: ', idQuery, roundType, idRound);
    if (typeof(this._log) === 'undefined') {
	mkdirp(process.env.DELEGATE_RES + "data" , function (err) {
            if (err != null) console.log(err);
	});
	this._log = new Log(process.env.DELEGATE_RES + "data/" + 'res_' + idClient, this._id);
	this._fragmentsClient.setLog(this._log);
    }

    var q = { query: query, id: idQuery, status: status.WAITING, round: { type: roundType, id: idRound, nbQueries: nbQueries }, idClient: idClient, dataset: dataset, ttl: properties.get('ttl')};
    this._queriesQueue.push(q);
    this.emit('FINISH');
}

Node.prototype.executeQuery = function() {
    console.log('Queries lenght: ', this._queriesQueue.length);
    console.log('Waiting queries: ', this._hasWaitingQueries());
    if (this._queriesQueue.length === 1 && this._hasWaitingQueries()){
	var q = this._getUnprocessQuery();
	console.log('Node - going to consider: ', q.id, q.round, q.status);
	if (q.status === status.WAITING) {
	    if (q.id === 1 && q.round.id === 1)
		fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Start " + q.round.type + " Phase: " + this.getCurrentDate() + "\n");

	    fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "[" + this.getCurrentDate() + "] Execute query: " + q.id + "\n"); 
	    q.status = status.PENDING;
	}
	this.execQuery(q, false);	
    } else if (this._queriesQueue.length > 1 && this._hasWaitingQueries()){
	if (properties.get('delegate') === 'on') {
	    this._client.delegateQuery();
	} else {
	    if (this._status === status.FREE) {
		var q = this._getUnprocessQuery();
		console.log('Node - going to consider: ', q.id, q.round, q.status);
		if (q.status === status.WAITING) {
		    if (q.id === 1 && q.round.id === 1)
			fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Start " + q.round.type + " Phase: " + this.getCurrentDate() + "\n");

		    fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "[" + this.getCurrentDate() + "] Execute query: " + q.id + "\n"); 
		}
		this.execQuery(q, false);	
	    }
	}
    }

/*    if (this._queriesQueue.length > 0 && !this._hasPendingQueries()) {
	
	var q = this._getUnprocessQuery();

	// TODO check that only one query remain in the queue and that it is the las
	// one of the query mix
	if (typeof(q) != 'undefined') {
	    q.src = "http://" + this._ip + ':' + this._port;
	    this._status = status.PENDING;

	    console.log('Node - going to consider: ', q.id, q.round, q.status);
	    if (q.status === status.WAITING) {
		if (q.id === 1 && q.round.id === 1)
		    fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Start " + q.round.type + " Phase: " + this.getCurrentDate() + "\n");

		fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "[" + this.getCurrentDate() + "] Execute query: " + q.id + "\n"); 
		q.status = status.PENDING;
	    }

	    if (properties.get('delegate') === 'on')
		this._client.delegateQuery(q);
	    else {
                if (q.round.type === "real") {
                    console.time('timeExecLocal');
                }
		this.execQuery(q, false);
            }
	} else {
	    console.log('Cannot execute query');
	}
    }*/
}

Node.prototype._hasWaitingQueries = function () {
    for (var node = this._queriesQueue.node; node; node = this._queriesQueue.next(node)) {
	if (node.value.status === status.WAITING)
	    return true;
    }
    return false;
}

Node.prototype._hasPendingQueries = function () {
    for (var node = this._queriesQueue.node; node; node = this._queriesQueue.next(node)) {
	if (node.value.status === status.PENDING)
	    return true;
    }
    return false;
}

Node.prototype._getUnprocessQuery = function () {
    for (var node = this._queriesQueue.node; node; node = this._queriesQueue.next(node)) {
	if (node.value.status === status.WAITING || node.value.status === status.TIMEDOUT) {
	    node.value.status = status.WAITING;
	    return node.value;
	}
    }
}

Node.prototype.execQuery = function (q, delegated) {
    if (q.round.type === "real") {
        console.time('timeExecLocal');
    }
//    this._cache.reset();
    console.log('Node _ size cache:', this._cache.itemCount);
    if (!delegated)
	this._log.incrementSelfWorkloadLocal();

    console.log('EQ: ', q.id, q.round, delegated);
    this._status = status.EXECUTING;
    if (!delegated)
	q.status = status.EXECUTING;

    var results = new ldf.SparqlIterator(q.query, { fragmentsClient: this._fragmentsClient });

    if (!delegated)
	this.processResults(results, q);
    else {
	return results;
    }
}

/**
* res is a stream
*/
Node.prototype.processResults = function(res, q) {
    var self = this;
    console.log('Node - process results');

    res.on('end', function() {

	fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "[" + self.getCurrentDate() + "] Finish query: " + q.id + "\n"); 
	
	self._log.incrementNbQueries();

	if (self._log.getNbQueries() === q.round.nbQueries) {
	    fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Stop " + q.round.type + " Phase: " + self.getCurrentDate() + "\n");

	    if (q.round.type === "warmUp") {
		fs.writeFileSync(process.env.DELEGATE_RES + "wu_" + q.idClient, "");
		self.emit('FinishWU');
	    }
	    if (q.round.type === "real") {
		fs.writeFile(process.env.DELEGATE_RES + "stop_" + q.idClient, "", function(err)  {if (err) throw err;});
		self.emit('FinishReal', q.round.id);
	    }
	}
	
	console.log('Node.js - going to remove: ', q.id, q.round);
	self._queriesQueue.forEach(function(value, node) {
	    console.log('\t In queue: ', value.id, value.round);
	});
	var removed = self.removeQuery(q);
	if (removed != q)
	    new Error('Remove: ' , removed, ' instead of: ', q);

	self._status = status.FREE;
        if (q.round.type === "real") {
            console.timeEnd('timeExecLocal');
        }
	self.emit('FINISH');
    });

    var writer = new ldf.SparqlResultWriter.instantiate('application/json', res);

    var rep = process.env.DELEGATE_RES + q.round.type + 'Round_' + q.round.id+ '/',
    file = 'idClient_' + q.idClient + '_dataset_' + q.dataset + '_idQuery_' + q.id,
    repResult =  rep + file;
    fs.appendFile(repResult, 'Query: ' + q.id, function(err) { if(err) throw err;});

    writer.on('data', function(data) {
	// TODO Need to check that the reponse is not written twice due to delegation
	fs.appendFile(repResult, data, function(err) { if(err) throw err;});
    });
    writer.on('error', function(err) {
	console.trace(err);
    });
    writer.on('end', function() {
	console.log('Finish writing res: ', q.id, q.round);
    });
}

Node.prototype.queriesQueueGet = function(q) {
    console.log('Node.js - queriesQueueGet: ', q);
    var ret;
    this._queriesQueue.forEach(function(value, node) {
	if (value.query === q.query && value.id === q.id && value.round.type === q.round.type && value.round.id === q.round.id  && value.idClient === q.idClient && value.dataset === q.dataset)
	    ret = value;
    });
    return ret;
}

Node.prototype.removeQuery = function(q) {
    var ret, n;
    this._queriesQueue.forEach(function(value, node) {
	if (value.query === q.query && value.id === q.id && value.round.type === q.round.type && value.round.id === q.round.id  && value.idClient === q.idClient && value.dataset === q.dataset) {
	    ret = value;
	    n = node;
	}
    });
    this._queriesQueue.remove(n);
    return ret;
}

Node.prototype.getCurrentDate = function() {
    var today = new Date(),
    day = today.getDate(),
    month = months[today.getMonth()], // getMonth() start with 0
    year = today. getFullYear(),
    hour = today.getHours(),
    min = today.getMinutes(),
    sec = today.getSeconds(),
    ms = today.getMilliseconds(),
    fullDate = day + '/' + month + '/' + year + ':' + hour + ':' + min + ':' + sec + ':' + ms;
    return fullDate;
}

Node.prototype.saveData = function(suffixe) {
    var randomPeers = this._tables.getRandomPeers();
    this._log.writeRandomPeers(randomPeers);

    var clusterPeers = this._tables.getClusterPeers();
    this._log.writeClusterPeers(clusterPeers);

    this._log.saveResults(suffixe);
}

Node.prototype.clearData = function() {
    this._log.clearData();
}

module.exports = Node;
