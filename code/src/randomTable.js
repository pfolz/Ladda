/* Create a table of n neighbors for a given node */
var RandomLib = require('random-js');
var HashMap = require('hashmap');

/*
 * @nbMaxPeers: nb maximal peers in the random table
 */
function Random (nbMaxPeers, hostId) {
    this._nbMaxPeers = nbMaxPeers;
    this._hostId = hostId;
    this._randomPeersSended = [];
    this._table = new HashMap();
    
}

Random.prototype._add = function (peer) {
    if (this._table.has(peer.id)) {
	this._table.get(peer.id).timestamp = 0;
    } else {
	this._table.set(peer.id, {'id': peer.id, 'ip': peer.ip, 'port': peer.port, 'profile': peer.profile, 'timestamp': 0});
    }
}

Random.prototype.remove = function (peerId) {
    if (this._table.has(peerId)) {
    	this._table.remove(peerId);
    } else { 
    	throw ('The peer does not exist in the table: ' + peerId);
    }
}

// Handle first connection 
Random.prototype.addPeer = function (peer) {
    if (peer.id != this._hostId && !this._table.has(peer.id)) {
	if (this._table.count() === this._nbMaxPeers) {
	    var oldestPeerId = this.oldestPeer().id;                                          
	    this.remove(oldestPeerId);
	}
	this._add(peer);
    }
}


Random.prototype.addPeers = function (peers) { // array of peers
    
    var randomPeersToDelete = this._peersToExclude(this._randomPeersSended, peers),
    self = this;

    if (this._table.count() > 0) this._incrementTimestamp();
    
    if (peers.length > 0) {
    	peers.forEach(function(peer) {
    	    if (peer.id != self._hostId) {
    		self._add(peer);
    	    }
    	});
    }

    randomPeersToDelete.forEach(function (peerId) {
	if (self._table.count() > self._nbMaxPeers) {
	    self.remove(peerId);
	}
    });

    if (this._table.count() > this._nbMaxPeers) {
	this._table.keys().forEach(function(key) {
	    if (self._table.count() > self._nbMaxPeers) {
		var oldestPeer = self.oldestPeer();
		self.remove(oldestPeer.id);
	    }
	});
    }
    
    var peersRemoved = this._randomPeersSended.slice(0);
    this._randomPeersSended = [];
    return peersRemoved;
}

Random.prototype._peersToExclude = function (peersToDelete, peersToExclude) {
    var tmp = [];
    peersToDelete.forEach(function (peerD) {
	var found = false;
	peersToExclude.forEach(function (peerE) {
	    if (peerD.id === peerE.id) found = true; 
	});
	
	if (!found) tmp.push(peerD.id);
    });
    return tmp;
}

Random.prototype._incrementTimestamp = function () {
    this._table.forEach(function(value, key) {
	value.timestamp +=1;
    });
}

Random.prototype.RandomPeersFull = function() {
    return this._table.count() === this._nbMaxPeers;
}

Random.prototype.getPeers = function () {
    var randomAsTable = [];
    this._table.forEach(function(value, key) {
  var peer = {'id': key, 'ip': value.ip, 'port': value.port, 'profile': value.profile, 'timestamp': value.timestamp}
	randomAsTable.push(peer);
    });
    return randomAsTable;
}

Random.prototype.size = function () {
    return this._table.count();
}

Random.prototype.halfRandomPeers = function (peerId) {	
    if (!(this._table.count() < 2)) {
	var engine = RandomLib.engines.nativeMath;
	var tmp = this._table.keys().filter(excludeSendingPeer(peerId));
	var randomPeersIdToRemove = RandomLib.sample(engine, tmp, Math.round(tmp.length/2));
	this._randomPeersSended = this._buildListOfPeers(randomPeersIdToRemove);
	return this._randomPeersSended;
    }
    
    var halfPeers = this._table.keys().filter(excludeSendingPeer(peerId));
    this._randomPeersSended = this._buildListOfPeers(halfPeers);
    return this._randomPeersSended;
}

Random.prototype._buildListOfPeers = function (peersId) {
    var peers = [], table = this._table;
    peersId.forEach(function(id) {
	var properties = table.get(id);
peers.push({'id': id, 'ip': properties.ip, 'port': properties.port, 'profile': properties.profile,'timestamp': properties.timestamp});
    });
    return peers;
}

function excludeSendingPeer(peerIdToExclude) {
    return function(peerId) {
	return !(peerId === peerIdToExclude);
    }
}

Random.prototype.oldestPeer = function () {
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

Random.prototype.contain = function (peerId) {
    return this._table.has(peerId);
}

Random.prototype.setProfile = function(peerId, profile) {
    this._table.get(peerId).profile = profile;
    this._table.get(peerId).timestamp = 0;
}

module.exports = Random;