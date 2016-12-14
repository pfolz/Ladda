/* Create a table of n close neighbors for a given node */

var HashMap = require('hashmap'),
PropertiesReader = require('properties-reader'),
Logger = require('./node_modules/Client.js-feature-asynciterator/ldf-client.js').Logger;

var properties = PropertiesReader(process.env.DELEGATE_HOME + '/bin/config.properties');

/**
 * @param {Integer} nbMaxPeers: maximum peers that the cluster table can contains
 * @param {Function} similarityMethod
 * @param {String} hostId: id of the current node
 * @param {Lru-cache} currentNodeCache
 * @param {Array} randomPeers: list of the randomPeers of the node
 */

function Cluster(nbMaxPeers, similarityMethod, hostId, profile, randomPeers) {
    this._table = new HashMap(); // (idNode, properties)
    this._maxSimilarity = 0;
    this._minSimilarity = 1;
    this._minSimilarityNodeId = [];
    this._nbMaxPeers = nbMaxPeers;
    this._similarityMethod = similarityMethod;
    this._hostId = hostId;
    this._profile = profile
    this._randomPeers = randomPeers;
    this._logger = new Logger('ClusterTable');
    
}

Cluster.prototype.printClusterTable = function () {
    this._table.forEach(function(value, key) {
    	console.log("cluster table: key:",key," value:",value);
    })
}

Cluster.prototype.getPeers = function() {
    var clusterAsTable = [];
    this._table.forEach(function(value, key) {
	var peer = {'id': key, 'ip': value.ip, 'port': value.port, 'profile': value.profile, 'timestamp': value.timestamp}
	clusterAsTable.push(peer);
    });
    return clusterAsTable;
}

/*
 * Get all the cluster peers excluding the peer in parameter
 * @param {String} peerId: the peer exclude from the list
 */
Cluster.prototype.getPeers = function(peerId) {
    var clusterAsTable = [];
    this._table.forEach(function(value, key) {
	var peer = {'id': key, 'ip': value.ip, 'port': value.port, 'profile': value.profile, 'timestamp': value.timestamp}
        if (peerId != peer.id) 
            clusterAsTable.push(peer);
    });
    return clusterAsTable;
}

Cluster.prototype.size = function () {
    return this._table.count();
}

Cluster.prototype.oldestPeer = function () {
    if (this._table.count() > 0) {
	var oldestPeer;
	var oldestPeerTimestamp = -1;
	this._table.forEach(function(value, key) {
	    if (value.timestamp > oldestPeerTimestamp) {
		oldestPeerTimestamp = value.timestamp;
		oldestPeer = value;
	    }
	});
	
	if (typeof(oldestPeer) === 'undefined') throw 'Oldest peer id undefined';
	
	return oldestPeer;
    }
    return undefined;
}

function toHashMap(obj) {
    var h = new HashMap();
    Object.keys(obj).forEach(function(key) {
	h.set(key, obj[key]);
    });
    return h;
}

Cluster.prototype.addPeers = function (peers) {
    var logger = this._logger, 
    similarityMethod = this._similarityMethod, 
    profile = this._profile,
    table =this._table
    nbMaxPeers = this._nbMaxPeers;

    logger.debug('Peers: ', peers);
    var candidates = peers.concat(this.getPeers()).concat(this._randomPeers.getPeers());
    logger.debug('This peers: ', this.getPeers());
    logger.debug('Random peers: ', this._randomPeers.getPeers());
    // Compute similarity for each candidate
    candidates.forEach(function (c) {
	logger.debug('C.profile: ', c.profile);
	logger.debug('Typeofc.profile: ', typeof(c.profile));
	var candidateProfile = (typeof(c.profile) === 'string') ? JSON.parse(c.profile) : c.profile;
	logger.debug('Typeofc.profile: ', typeof(candidateProfile));
	var p = toHashMap(candidateProfile);
	logger.debug('Candidate profile: ', profile);
	c.similarity = similarityMethod(profile.toHashMap(), p);
    });
    logger.debug('Finish compute similarity for candidate');
    this._table.clear();
    this._minSimilarity = 1;
    this._minSimilarityNodesId = [];
    this._maxSimilarity = 0;
    if (this._table.count() > 0) incrementTimestamp();
    
    candidates.sort(function(a,b) {
	if (a.similarity > b.similarity)
	    return -1;
	if (a.similarity < b.similarity)
	    return 1;
	return 0;
    });

    candidates.forEach(function(c) {
	if (table.count() < nbMaxPeers) {
	    table.set(c.id, c);
	}
    });
    
    var peerNotAdded = [];
    candidates.forEach(function(peer) {
	if(!table.has(peer.id)) peerNotAdded.push(peer);
    })
    
    return peerNotAdded;
}

function incrementTimestamp() {
    this._table.forEach(function(value, key) {
	value.timestamp +=1;
    });
}


Cluster.prototype.contain = function (peerId) {
    return this._table.has(peerId);
}

Cluster.prototype.remove = function (peerId) {
    this._table.remove(peerId);
}

Cluster.prototype.setProfile = function(peerId, profile) {
    this._table.get(peerId).profile = profile;
    this._table.get(peerId).timestamp = 0;
}

Cluster.prototype.contain = function (peerId) {
    return this._table.has(peerId);
}

module.exports = Cluster;



