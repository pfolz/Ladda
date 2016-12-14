/* A client*/

var ioClient = require('socket.io-client'),
HashMap = require('hashmap'),
cacheToProfile = require('./cacheToProfile.js'),
PropertiesReader = require('properties-reader'),
Logger = require('./node_modules/Client.js-feature-asynciterator/ldf-client.js').Logger;
status = require('./status'),
fs = require('fs');

var SparqlParser = require('sparqljs').Parser,
descriptionFunction = require('./descriptionProfileQuery.js');

var properties = PropertiesReader(process.env.DELEGATE_HOME + '/bin/config.properties');

function toHashMap(obj) {
    var h = new HashMap();
    Object.keys(obj).forEach(function(key) {
        h.set(key, obj[key]);
    });
    return h;
}

function Client (node) {
    this._node = node;
    this._id = node._id;
    this._ip = node._ip;
    this._port = node._port;
    this._tables = node._tables;
    this._cache = node._cache;
    this._profile = node._profile;
    // List of connections to other peer (peerId, socket)
    this._listOfConnections = new HashMap();
    this._connectionDelegate = new Array();
    this._logger = new Logger('Client');

    this._logger.info('Start: ', this._address);

    var self = this;

    if (properties.get('delegate') === 'on') {                                              
        // Send neighborhood tables each n sec
	console.log('SetInterval to shuffle: ', properties.get('timeShuffleTables'));
        setInterval(function () {                                                                
            self._shuffleTables();                                                              
        }, properties.get('timeShuffleTables'));                                           
    }
}

Client.prototype.connectTo = function (serverAddress, firstConnection, idPeer) {

    var self = this;
  
    this._address = 'http://' + this._ip + ':' + this._port;

    var socketClient = ioClient.connect(serverAddress);

    if (this._listOfConnections.has(serverAddress))
	throw Error("Multiple connection!");

    this._listOfConnections.set(serverAddress, socketClient);
    socketClient.address = serverAddress;

    socketClient.on('error', function (err) {
	self._logger.error('ERROR', 'ClientError: ', err);
    });
    
    socketClient.on('connect', function() {
        
    var msg = {'src': {'id': self._id, 'adr': self._address},
              'dst': serverAddress,
               'content': {'id': self._id, 'ip': self._ip, 'port': self._port, 'profile': JSON.stringify(self._profile.toObject())}};
        
	self._logger.debug('AskConnection to: ', serverAddress , ' msg: ', msg);
        socketClient.emit('demandNewConnection', msg);

	self._node._log.incrementClientNbShufSent();
    });
    
    socketClient.on('answerDemandeNewConnection', function(msg) {
	
	self._node._log.incrementClientNbShufReceived();

	self._logger.debug('Client-AnswerNewConnection from: ' + msg.src.adr);
	
	var peer = msg.content;
	if (firstConnection) {
	    self._tables.addRandomPeer({'id': peer.id, 'ip': peer.ip, 'port': peer.port, 'profile': JSON.parse(peer.profile),'timestamp': 0});
	}

	socketClient.peerId = peer.id;
	self._logger.debug('After connect RPS: ', self._tables.getRandomPeers());

    });
    

    socketClient.on('exchangeNeighbourhoodTablesServerToClient', function(msg) {
	
	self._node._log.incrementClientNbShufReceived();

	self._tables.updateProfile(msg.src.id, JSON.parse(msg.src.profile));
        
	self._logger.info('Client-ReceivePeers from: ', msg.src.adr);
        
        self._receiveNeigborhoodTables(msg.content);

    });
    
    socketClient.on('status', function(msg) {

	self._node._log.incrementClientNbAskReceived();

	console.log('Client.js - status of: ', socketClient.address, ' ', msg.execute, ' ', msg.query.id , msg.query.round);
	var q = self._node.queriesQueueGet(msg.query);
	self._node._queriesQueue.forEach(function(value, node) {
	    console.log('\t In queue: ', value.id, value.round);
	});
	console.log ('\t listOfConnections: ', self._listOfConnections.keys());
	// If q was already process it will no longer be in the queue
	if (typeof(q) != 'undefined') {
	    // Cannot delegate to a client already executing a delated query
	    if (msg.execute === true && q.status === status.PENDING && self._connectionDelegate.indexOf(socketClient.address) === -1) {
		console.log('\t Client.js - execQuery: ', socketClient.address, msg.query.id);
		if (self._node._status != status.EXECUTING)
		    self._node._status = status.DELEGATING;
		q.status = status.DELEGATING;

		socketClient.emit('executeQuery', msg.query);

		if(self._connectionDelegate.indexOf(socketClient.address) === -1) 
		    self._connectionDelegate.push(socketClient.address);
		else
		    throw new Error('Cannot delegate to same client');

		console.log('\t\t Client - save connection: ', socketClient.address, self._connectionDelegate);

		self._node._log.incrementClientNbExecuteSent();

		// When a query is delegated can process a new one
		self._node.emit('FINISH');

		/*setTimeout(function() {
		    var query = self._node.queriesQueueGet(q);
		    // TODO see how to stop delegation
		    // Query can be already executed whent timeout fire up
		    if (typeof(query) != 'undefined') {
			if (query.status === status.DELEGATING && self._node._status != status.EXECUTING) {
			    console.log('TimeoutExecution: ', query.id, query.round);
                            if (query.round.type === "real") {
                                console.time('timeExecLocal');
                            }
			    self._node.execQuery(query, false);

			    self._node._log.incrementSelfWorkloadTimeout();
			} else if (query.status === status.DELEGATING) { // Query timeout but node is busy now
			    self._node._log.incrementSelfWorkloadTimeout();
			    console.log('TimeoutExecution: ', query.id, query.round);
			    query.status = status.TIMEDOUT;
			}
		    }
		}, properties.get('timePerformQuery'));*/	    

	    } else {

		if (msg.execute === true && (self._connectionDelegate.indexOf(socketClient.address) === -1)) {
		    var query = self._node._getUnprocessQuery();
		    console.log('Typeof query: ', typeof(query));
		    if (typeof(query) != 'undefined'){
			query.status = status.DELEGATING;
			console.log('Client -execQuery: ', query.id, query.round);
			socketClient.emit('executeQuery', query);
			if(self._connectionDelegate.indexOf(socketClient.address) === -1) 
			    self._connectionDelegate.push(socketClient.address);
			else
			    throw new Error('Cannot delegate to same client');
		    }
		}
		// When query timed out neighbors is set to 0
		q.neighbors--;
		console.log('Client - q.neighbors: ', q.neighbors);
		console.log('Client - q: ', q);
		if (q.status === status.PENDING && q.neighbors === 0) {
		    if (self._node._status != status.EXECUTING) {
                        if (q.round.type === "real") {
                            console.time('timeExecLocal');
                        }
			self._node.execQuery(q, false);
		    } else 
//			q.status = status.TIMEDOUT;
			q.status = status.WAINTING;
		}
	    }
	} else if (msg.execute === true && (self._connectionDelegate.indexOf(socketClient.address) === -1)) {
	    var query = self._node._getUnprocessQuery();
	    console.log('Typeof query: ', typeof(query));
	    if (typeof(query) != 'undefined'){
		query.status = status.DELEGATING;
		socketClient.emit('executeQuery', query);
		console.log('Client - execQuery: ', query.id, query.round);
		if(self._connectionDelegate.indexOf(socketClient.address) === -1) 
		    self._connectionDelegate.push(socketClient.address);
		else
		    throw new Error('Cannot delegate to same client');
	    }
	}
    });

    socketClient.on('res', function(msg) {
	self._node._log.incrementClientNbExecuteReceived();
	console.log('Client on res: ', msg);
	var q = self._node.queriesQueueGet(msg.query);
	// Query can be timeout and already finish
	if (typeof(q) != 'undefined') {
	    console.log('Res for: ', q.id, q.round, q.status);
	    if (q.status === status.DELEGATING) {

		if (msg.answer === 'busy') {
		    console.log('/t delegation fails');
		    self._removeDelegateSocket(socketClient);
		//    q.status = status.TIMEDOUT;
		    q.status = status.WAITING;

		    if (self._node._status != status.EXECUTING && self._node._status != status.PENDING)  {
			self._node._status = status.FREE;
			self._node.emit('FINISH');
		    }
		} else {
		    self._processResults(msg.query, msg.answer);

		    if (msg.answer === 'finish') {
			fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "[" + self._node.getCurrentDate() + "] Finish query: " + q.id + "\n");

			self._node._log.incrementNbQueries();
			self._node._log.incrementSelfWorkloadDelegate();

			if (self._node._log.getNbQueries() === q.round.nbQueries) {
			    fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Stop " + q.round.type + " Phase: " + self._node.getCurrentDate() + "\n");
			
			    if (q.round.type === "warmUp") {
				fs.writeFileSync(process.env.DELEGATE_RES + "wu_" + q.idClient, "");
				self._node.emit('FinishWU');
			    }
			    if (q.round.type === "real") {
				fs.writeFile(process.env.DELEGATE_RES + "stop_" + q.idClient, "", function(err) {if (err) throw err;});
				self._node.emit('FinishReal', q.round.id);
			    }
			}

			var removed = self._node.removeQuery(q);
			console.log('Client.js - answer for: ', msg.query.id, msg.query.round);
			console.log('\t from: ', socketClient.address);
			console.log('Client.js - delete query: ', removed.id, removed.round);

			self._removeDelegateSocket(socketClient);

			if (self._node._status != status.EXECUTING && self._node._status != status.PENDING) 
			    self._node._status = status.FREE;
		    
			self._node.emit('FINISH');
		    }
		}
	    }
	}
    });
}

Client.prototype._removeDelegateSocket =  function(socketClient) {
    var index = this._connectionDelegate.indexOf(socketClient.address);
    if (index > -1) {
	console.log('Client.js - delate socket in queue: ', this._connectionDelegate);
	this._connectionDelegate.splice(index, 1);
	console.log('\t Client.js - delate socket in queue: ', this._connectionDelegate);
	if (this._connectionDelegate.indexOf(socketClient.address) > -1)
	    throw new Error('Was not remove');
	
	this._removeDelegateConnection(socketClient.address, socketClient.peerId);
    } else
	throw new Error('Socket was not added first');
}

Client.prototype._processResults = function(q, res) {
    var rep = process.env.DELEGATE_RES + q.round.type + 'Round_' + q.round.id+ '/',
    file = 'idClient_' + q.idClient + '_dataset_' + q.dataset + '_idQuery_' + q.id,
    repResult =  rep + file;
    try {
	fs.statSync(repResult);
    } catch (error) {
	fs.appendFile(repResult, 'Query: ' + q.id, function(err) { if(err) throw err;});
    }
	fs.appendFile(repResult, res, function(err) { if(err) throw err;});
}

//Client.prototype.delegateQuery = function(q) {
Client.prototype.delegateQuery = function() {
//    var rankedNodes = this.rankNeighbors(q);
    var rankedNodes = this.rankNeighbors();
    if (rankedNodes.length === 0 && this._node._status != status.EXECUTING) {
 /*       if (q.round.type === "real") {
            console.time('timeExecLocal');
        }
	this._node.execQuery(q, false)*/
	var q = this._node._getUnprocessQuery();
	if (typeof(q) != 'undefined') {
	    if (q.status === status.WAITING) {
		if (q.id === 1 && q.round.id === 1)
                    fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Start " + q.round.type + " Phase: " + this._node.getCurrentDate() + "\n");
	    }
	    q.status = status.DELEGATING;
	    this._node.execQuery(q, false);
	}
    } else {
	
	this._node._log.incrementTryDelegate();

        // Shuffling neighbors to obtain a "real" random
        if (properties.get('ranking') === 'off') {
            var rankedNodesBase = rankedNodes;
            rankedNodes = [];
            while (rankedNodesBase.length !== 0) {
                var i = Math.floor(Math.random()*rankedNodesBase.length);
                var elem = rankedNodesBase[i];
                rankedNodesBase.splice(i, 1);
                rankedNodes.push(elem);
            }
        }
        if (properties.get('maxSelectedNeighbors')>0) {
            rankedNodes = rankedNodes.slice(0, properties.get('maxSelectedNeighbors'))
        }
//	console.log('Client.js - execQuery: ', q.id , q.round);
//	q.neighbors = 0;
	var connectionDelegate = this._connectionDelegate,
	listOfConnections = this._listOfConnections,
	log = this._node._log,
	node = this._node;

	if (this._node._status != status.EXECUTING) {
	    var q = this._node._getUnprocessQuery();
	    if (typeof(q) != 'undefined') {
		if (q.status === status.WAITING) {
		    if (q.id === 1 && q.round.id === 1)
			fs.appendFileSync(process.env.DELEGATE_RES + "client" + q.idClient + ".log", "Start " + q.round.type + " Phase: " + node.getCurrentDate() + "\n");
		}
		q.status = status.DELEGATING;
		console.log('Client - delegate: ', q.id, q.round);
		this._node.execQuery(q, false);
	    }
	}

	var self = this;

	rankedNodes.forEach(function(n) {
	    if (node._queriesQueue.length > 1 && node._hasWaitingQueries()) {
		var nodeAdr = 'http://' + n.ip + ':' + n.port;
		var socket = listOfConnections.get(nodeAdr);
		// TODO if connection does not exist create it
		// Do not send the delegate to a node already executing a delated query
		if (typeof(socket) != 'undefined' && connectionDelegate.indexOf(nodeAdr) === -1) {
		    console.log('\t Client.js - execQuery to: ', socket.address);
		
		    var q = node._getUnprocessQuery();
		    if (typeof(q) != 'undefined') {
			q.status = status.DELEGATING;
			socket.emit('executeQuery', q);

			if(self._connectionDelegate.indexOf(socket.address) === -1) 
			    self._connectionDelegate.push(socket.address);
			else
			    throw new Error('Cannot delegate to same client');

			console.log('\t\t Client - save connection: ', socket.address, self._connectionDelegate);
		    }

		    //		socket.emit('delegateQuery',q);
		    //		log.incrementClientNbAskSent();
		
//		q.neighbors++;
		}
	    }
	});

	// TODO if there is no delegate sended execute the query
	var node = this._node;
/*	setTimeout(function() {
	    console.log('queriesQueueGet in timeout');
	    var query = node.queriesQueueGet(q);
	    // Query can be already executed when timeout fire up
	    if (typeof(query) != 'undefined') {
		if (query.status === status.PENDING && node._status != status.EXECUTING) {
		    console.log('In timeout delegate - original: ', q.id , q.round, q.status); 
		    node._queriesQueue.forEach(function(value, node) {
			console.log('\t In queue: ', value.id, value.round, value.status);
		    });
		    console.log('Timeout: ', query.id, query.round);
                    if (query.round.type === "real") {
                        console.time('timeExecLocal');
                    }
		    node.execQuery(query, false);
		} else if (query.status === status.PENDING) {
		    console.log('In timeout delegate - original: ', q.id , q.round, q.status);
		    console.log('\t node status: ', node._status);
		    query.status = status.TIMEDOUT;
		}
	    }
	}, properties.get('timeAskDelegate'));*/
    }
}

// Obtains all the triple patterns in a query
function SparqlGroupsVisitor(groups) {
  return groups.reduce(function (lst, group) {
    return lst.concat(new SparqlGroupVisitor(group));
  }, []);
}

function SparqlGroupVisitor(group) {

  switch (group.type) {
  case 'bgp':
    return group.triples;
  case 'group':
    return new SparqlGroupsVisitor(group.patterns);
  case 'optional':
    return new SparqlGroupsVisitor(group.patterns);
  case 'filter':
    return [];
  case 'union':
    var mapped = group.patterns.map(function (patternToken) {
      return new SparqlGroupVisitor(patternToken);
    });
    return [].concat.apply([], mapped);
  default:
    throw new Error('Unsupported group type: ' + group.type);
  }
}

var compareNeighbors = function(n1,n2) {
    return compareDescriptions(n1.description, n2.description);
}

var compareDescriptions = function(d1, d2) { // inversed values to sort descending
        var fstN1 = d1[0];
        var sndN1 = d1[1];
        var fstN2 = d2[0];
        var sndN2 = d2[1];
        if ((fstN1 < fstN2) || ((fstN1 == fstN2) && (sndN1 < sndN2))) {
            return 1;
        } else if ((fstN1 == fstN2)&&(sndN1 == sndN2)) {
            return 0;
        } else {
            return -1;
        }
}

Client.prototype.rankNeighbors = function (queryInfos) {
    var node = this._node, tables = this._tables, profile = this._profile, connectionDelegate = this._connectionDelegate;
  if (properties.get('ranking') === 'on') {
    console.time('rank');
    var queryText = queryInfos.query;
    var query = new SparqlParser().parse(queryText);
    var patterns = query.where;
    var triples = new SparqlGroupsVisitor(patterns);
    var predicates = triples.map(function (triple) {
	return node._startFragment+triple.predicate;
    });
    var neighbors = [];
//      console.log('Client - Ranking');
    if (typeof(tables.getClusterPeers()) != 'undefined') {
       // neighbors = tables.getClusterPeers();
	tables.getClusterPeers().forEach(function(peer) {
	    if (connectionDelegate.indexOf('http://127.0.0.1:' + peer.port) === -1) {
//		console.log('\t add peer: ', peer.port);
//		console.log('\t\t connectionDelegate: ', connectionDelegate);
		neighbors.push(peer);
	    }
	});
    }

    if (typeof(tables.getRandomPeers()) != 'undefined') {
        var moreNeighbors = tables.getRandomPeers();

        for (var i = 0; i < moreNeighbors.length; i++) {
            var n = moreNeighbors[i];
            var add = true;
            for (var j = 0; j < neighbors.length; j++) {
                var n2 = neighbors[j];
                if (n.id === n2.id) {
                    add = false;
                }
            }
//            if (add) {
            if (add && (connectionDelegate.indexOf('http://127.0.0.1:' + n.port) === -1)) {
		console.log('\t add peer: ', n.port);
		console.log('\t\t connectionDelegate: ', connectionDelegate);
                neighbors.push(n);
            }
        }
    }
    neighbors.forEach(function(peer) {
        var description = [-1, -1];
        if ((typeof(peer) != 'undefined') && (typeof(peer.profile)!='undefined')) {
            var profile = (typeof(peer.profile) === 'string') ? JSON.parse(peer.profile) : peer.profile;
            description = descriptionFunction(predicates, toHashMap(profile));
        }
        peer.description = description;
    });
    var rankedNeighbors = neighbors;
    /*if (this.canExecute(queryInfos)) {
        var myProfile = profile.toHashMap();
        var myDescription = descriptionFunction(predicates, myProfile);
        rankedNeighbors = neighbors.filter(function(n, i, a) {
            return compareDescriptions(n.description, myDescription)<1;
        });
    }*/
    rankedNeighbors.sort(compareNeighbors);
    console.timeEnd('rank');
    console.log('rank: ', tables.getClusterPeers().length, ' ', tables.getRandomPeers().length);
    return rankedNeighbors;
  } else {
    var neighbors = [];
//      console.log('Client - Ranking');
    if (typeof(tables.getClusterPeers()) != 'undefined') {
//        neighbors = tables.getClusterPeers();
	tables.getClusterPeers().forEach(function(peer) {
            if (connectionDelegate.indexOf('http://127.0.0.1:' + peer.port) === -1) {
  //              console.log('\t add peer: ', peer.port);
    //            console.log('\t\t connectionDelegate: ', connectionDelegate);
                neighbors.push(peer);
            }
        });
    }

    if (typeof(tables.getRandomPeers()) != 'undefined') {
        var moreNeighbors = tables.getRandomPeers();

        for (var i = 0; i < moreNeighbors.length; i++) {
            var n = moreNeighbors[i];
            var add = true;
            for (var j = 0; j < neighbors.length; j++) {
                var n2 = neighbors[j];
                if (n.id === n2.id) {
                    add = false;
                }
            }
            if (add && (connectionDelegate.indexOf('http://127.0.0.1:' + n.port) === -1)) {
                console.log('\t add peer: ', n.port);
                console.log('\t\t connectionDelegate: ', connectionDelegate);

                neighbors.push(n);
            }
        }
    }
    return neighbors;
  }
};

Client.prototype.canExecute = function(query) {
    var ret, node = this._node;
    if (node._status === status.FREE || node._status === status.DELEGATING)
        ret = true;
    else
        ret = false;
    return ret;
}

Client.prototype._shuffleTables = function() {
    this._logger.debug('In shuffle tables');
    var oldestPeer = this._tables.oldestPeer();
    this._logger.debug('OldestPeer: ', oldestPeer);
    if (oldestPeer === 'undefined')
	this._logger.alert("No oldest peer to shuffle");
    
    if (typeof(oldestPeer) != 'undefined') {
	var peerAdr = 'http://' + oldestPeer.ip + ':' + oldestPeer.port;
	if (!this._listOfConnections.has(peerAdr)) {
	    this.connectTo(peerAdr, false);
	}
	var socket = this._listOfConnections.get(peerAdr);
        var content = this._sendNeigborhoodTables(oldestPeer.id);
        var msg = {'dst': oldestPeer.ip, 'src': {'id': this._id, 'adr': this._address, 'profile': JSON.stringify(this._profile.toObject())}, 'content': content};

	this._logger.debug('SendPeers to: ', oldestPeer.ip + ':' + oldestPeer.port);
	this._logger.debug('ClusterTable', content);
	
	socket.emit('exchangeNeighbourhoodTablesClientToServer', msg);
	this._node._log.incrementClientNbShufSent();
    }

}

Client.prototype._sendNeigborhoodTables = function (peerId) {
    return this._tables.sendNeigborhoodTables(peerId);
}

Client.prototype._receiveNeigborhoodTables = function (peers) {
    var peersToDelete = this._tables.receiveNeigborhoodTables(peers);
    if (peersToDelete.length > 0) this.removeConnections(peersToDelete);
    this.tryNewConnections(peers);
}


Client.prototype.tryNewConnections = function (peers) {
    this._logger.debug('Try new connections with: ', peers);
    var randomPeers = peers.randomPeers;
    var clusterPeers = peers.clusterPeers;
    var self = this;
    if (randomPeers.length > 0) {
	randomPeers.forEach(function (p) {
	    self.tryNewConnection(p);
	})
    }
    
    if (clusterPeers.length > 0) {
	clusterPeers.forEach(function (p){
	    self.tryNewConnection(p);
	})
    }
}

Client.prototype.tryNewConnection = function (peer) {
    var peerAdr =  "http://" + peer.ip + ":" + peer.port,
    alreadyConnectedTo = this._listOfConnections.has(peerAdr),
    isHimself = (peer.id === this.id) ? true : false;

    if (!alreadyConnectedTo && !isHimself) {
	this.connectTo(peerAdr, false);
    }
}

Client.prototype.removeConnections = function(peersToDelete) {
    var self = this;
    console.log('Client.js - peersToDelete: ', peersToDelete.length);
    console.log('\t', peersToDelete);
    peersToDelete.forEach(function(peer) {
	var peerAdr = 'http://' + peer.ip + ':' + peer.port;
	self._removeConnection(peerAdr);
    });
}

Client.prototype._removeConnection =  function (peerAdr){
    console.log('Client - going to remove peer connection: ',  peerAdr, this._connectionDelegate);
    console.log('\t Client - test going to remove: ', this._connectionDelegate.indexOf(peerAdr));
    if (this._listOfConnections.has(peerAdr) && this._connectionDelegate.indexOf(peerAdr) === -1) {
	console.log('\t Client - remove peer connection');
	var socket = this._listOfConnections.get(peerAdr);
	socket.close();
	this._listOfConnections.remove(peerAdr);
    }  
}

Client.prototype._removeDelegateConnection = function (peerAdr, peerId) {
    console.log('Client - going to remove peer connection delegate: ',  peerAdr, this._connectionDelegate);
    console.log('\t Client - has as RPS: ', this._tables.containRandomPeer(peerId));
    console.log('\t Client - has as Cluster: ', this._tables.containClusterPeer(peerId));
    if (!this._tables.containRandomPeer(peerId) && !this._tables.containClusterPeer(peerId)) {
	if (this._listOfConnections.has(peerAdr)) {
	    console.log('\t Client - remove peer connection');
	    var socket = this._listOfConnections.get(peerAdr);
            socket.close();
            this._listOfConnections.remove(peerAdr);
	}
    }
}

/*function alreadyConnectedTo(peer) {
    var peerAdr = 'http://' + peer.ip + ':' + peer.port;
    return (self._listOfConnections.has(peerAdr));
}

function himself(peer) {
    var isHimself = (self._id === peer.id) ? true : false;
    return isHimself;
}*/

module.exports = Client;
